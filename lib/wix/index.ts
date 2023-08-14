import { items } from '@wix/data';
import { currentCart, recommendations } from '@wix/ecom';
import { OAuthStrategy, createClient, media } from '@wix/sdk';
import { collections, products } from '@wix/stores';
import { ApplicationError } from '@wix/stores/build/cjs/src/stores-catalog-v1-product.public';
import { SortKey, WIX_REFRESH_TOKEN_COOKIE } from 'lib/constants';
import { cookies } from 'next/headers';
import { Cart, Collection, Menu, Page, Product } from './types';

const reshapeCart = (cart: currentCart.Cart): Cart => {
  return {
    id: cart._id!,
    checkoutUrl: '/',
    cost: {
      subtotalAmount: {
        amount: String(
          cart.lineItems!.reduce((acc, item) => {
            return acc + Number.parseFloat(item.price?.amount!) * item.quantity!;
          }, 0)
        ),
        currencyCode: 'USD'
      },
      totalAmount: {
        amount: String(
          cart.lineItems!.reduce((acc, item) => {
            return acc + Number.parseFloat(item.price?.amount!) * item.quantity!;
          }, 0)
        ),
        currencyCode: 'USD'
      },
      totalTaxAmount: {
        amount: '0',
        currencyCode: 'USD'
      }
    },
    lines: cart.lineItems!.map((item) => {
      const featuredImage = media.getImageUrl(item.image!);
      return {
        id: item._id!,
        quantity: item.quantity!,
        cost: {
          totalAmount: {
            amount: String(Number.parseFloat(item.price?.amount!) * item.quantity!),
            currencyCode: 'USD'
          }
        },
        merchandise: {
          id: item._id!,
          title: item.productName?.original!,
          selectedOptions: [],
          product: {
            handle: item.url?.split('/').pop() ?? '',
            featuredImage: {
              altText: 'altText' in featuredImage ? featuredImage.altText : 'alt text',
              url: media.getImageUrl(item.image!).url,
              width: media.getImageUrl(item.image!).width,
              height: media.getImageUrl(item.image!).height
            }
          } as any as Product,
          url: `/product/${item.url?.split('/').pop() ?? ''}`
        }
      };
    }),
    totalQuantity: cart.lineItems!.reduce((acc, item) => {
      return acc + item.quantity!;
    }, 0)
  };
};

const reshapeCollection = (collection: collections.Collection) =>
  ({
    path: `/search/${collection.slug}`,
    handle: collection.slug,
    title: collection.name,
    description: collection.description,
    seo: {
      title: collection.name
    },
    updatedAt: new Date().toISOString()
  }) as Collection;

const reshapeCollections = (collections: collections.Collection[]) => {
  return collections.map(reshapeCollection);
};

const reshapeProduct = (item: products.Product) => {
  return {
    id: item._id!,
    title: item.name!,
    description: item.description!,
    descriptionHtml: item.description!,
    availableForSale: true,
    handle: item.slug!,
    images:
      item.media
        ?.items!.filter((x) => x.image)
        .map((image) => ({
          url: image.image!.url!,
          altText: image.image?.altText! ?? 'alt text',
          width: image.image?.width!,
          height: image.image?.height!
        })) || [],
    priceRange: {
      minVariantPrice: {
        amount: String(item.price?.price!),
        currencyCode: 'USD'
      },
      maxVariantPrice: {
        amount: String(item.price?.price!),
        currencyCode: 'USD'
      }
    },
    options: [],
    featuredImage: {
      url: item.media?.mainMedia?.image?.url!,
      altText: item.media?.mainMedia?.image?.altText! ?? 'alt text',
      width: item.media?.mainMedia?.image?.width!,
      height: item.media?.mainMedia?.image?.height!
    },
    tags: [],
    variants: item.variants?.map((variant) => ({
      id: variant._id!,
      // todo: is this correct?
      title: item.name!,
      price: {
        amount: String(variant.variant?.priceData?.price),
        currencyCode: 'USD'
      },
      availableForSale: true,
      selectedOptions: []
    })),
    seo: {
      description: item.description!,
      title: item.name!
    },
    updatedAt: item.lastUpdated?.toString()!
  } as Product;
};

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const { addToCurrentCart } = getWixClient().use(currentCart);
  const { cart } = await addToCurrentCart({
    lineItems: lines.map(({ merchandiseId, quantity }) => ({
      catalogReference: {
        catalogItemId: merchandiseId,
        appId: '1380b703-ce81-ff05-f115-39571d94dfcd'
      },
      quantity
    }))
  });

  return reshapeCart(cart!);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const { removeLineItemsFromCurrentCart } = getWixClient().use(currentCart);

  const { cart } = await removeLineItemsFromCurrentCart(lineIds);

  return reshapeCart(cart!);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  const { updateCurrentCartLineItemQuantity } = getWixClient().use(currentCart);

  const { cart } = await updateCurrentCartLineItemQuantity(
    lines.map(({ id, quantity }) => ({
      id: id,
      quantity
    }))
  );

  return reshapeCart(cart!);
}

export async function getCart(): Promise<Cart | undefined> {
  const { getCurrentCart } = getWixClient().use(currentCart);
  try {
    const cart = await getCurrentCart();

    return reshapeCart(cart);
  } catch (e) {
    if ((e as any).details.applicationError.code === 'OWNED_CART_NOT_FOUND') {
      return undefined;
    }
  }
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  const { getCollectionBySlug } = getWixClient().use(collections);

  try {
    const { collection } = await getCollectionBySlug(handle);

    if (!collection) {
      return undefined;
    }

    return reshapeCollection(collection);
  } catch (e) {
    if ((e as ApplicationError).code === '404') {
      return undefined;
    }
  }
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const { getCollectionBySlug } = getWixClient().use(collections);
  let resolvedCollection;
  try {
    const { collection: wixCollection } = await getCollectionBySlug(collection);
    resolvedCollection = wixCollection;
  } catch (e) {
    if ((e as any)?.details?.applicationError?.code !== 404) {
      throw e;
    }
  }

  if (!resolvedCollection) {
    console.log(`No collection found for \`${collection}\``);
    return [];
  }

  const { items } = await sortedProductsQuery(sortKey, reverse)
    .hasSome('collectionIds', [resolvedCollection._id])
    .find();

  return items.map(reshapeProduct);
}

function sortedProductsQuery(sortKey?: string, reverse?: boolean) {
  const { queryProducts } = getWixClient().use(products);
  const query = queryProducts();
  if (reverse) {
    return query.descending((sortKey! as SortKey) ?? 'name');
  } else {
    return query.ascending((sortKey! as SortKey) ?? 'name');
  }
}

export async function getCollections(): Promise<Collection[]> {
  const { queryCollections } = getWixClient().use(collections);
  const { items } = await queryCollections().find();

  const wixCollections = [
    {
      handle: '',
      title: 'All',
      description: 'All products',
      seo: {
        title: 'All',
        description: 'All products'
      },
      path: '/search',
      updatedAt: new Date().toISOString()
    },
    // Filter out the `hidden` collections.
    // Collections that start with `hidden-*` need to be hidden on the search page.
    ...reshapeCollections(items).filter((collection) => !collection.handle.startsWith('hidden'))
  ];

  return wixCollections;
}

export async function getMenu(handle: string): Promise<Menu[]> {
  const { queryDataItems } = getWixClient().use(items);

  const { items: menus } = await queryDataItems({
    dataCollectionId: 'Menus',
    includeReferencedItems: ['pages']
  })
    .eq('slug', handle)
    .find();

  const menu = menus[0];

  return (
    menu?.data!.pages.map((page: { title: string; slug: string }) => ({
      title: page.title,
      path: page.slug
    })) || []
  );
}

export async function getPage(handle: string): Promise<Page> {
  const { queryDataItems } = getWixClient().use(items);

  const { items: pages } = await queryDataItems({
    dataCollectionId: 'Pages'
  })
    .eq('slug', handle)
    .find();

  const page = pages[0]!;

  return {
    id: page._id!,
    title: page.data!.title,
    handle: page.data!.slug,
    body: page.data!.body,
    bodySummary: '',
    createdAt: page.data!._createdDate.$date,
    seo: {
      title: page.data!.seoTitle,
      description: page.data!.seoDescription
    },
    updatedAt: page.data!._updatedDate.$date
  };
}

export async function getPages(): Promise<Page[]> {
  const { queryDataItems } = getWixClient().use(items);

  const { items: pages } = await queryDataItems({
    dataCollectionId: 'Pages'
  }).find();

  return pages.map((item) => ({
    id: item._id!,
    title: item.data!.title,
    handle: item.data!.slug,
    body: item.data!.body,
    bodySummary: '',
    createdAt: item.data!._createdDate.$date,
    seo: {
      title: item.data!.seoTitle,
      description: item.data!.seoDescription
    },
    updatedAt: item.data!._updatedDate.$date
  }));
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  const { queryProducts } = getWixClient().use(products);
  const { items } = await queryProducts().eq('slug', handle).limit(1).find();
  const product = items[0];

  if (!product) {
    return undefined;
  }

  return reshapeProduct(product);
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const { getRecommendation } = getWixClient().use(recommendations);

  const { recommendation } = await getRecommendation(
    [
      {
        _id: '5dd69f67-9ab9-478e-ba7c-10c6c6e7285f',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e'
      },
      {
        _id: 'ba491fd2-b172-4552-9ea6-7202e01d1d3c',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e'
      },
      {
        _id: '68ebce04-b96a-4c52-9329-08fc9d8c1253',
        appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e'
      }
    ],
    {
      items: [
        {
          catalogItemId: productId,
          appId: '215238eb-22a5-4c36-9e7b-e7c08025e04e'
        }
      ],
      minimumRecommendedItems: 3
    }
  );

  if (!recommendation) {
    return [];
  }

  const { queryProducts } = getWixClient().use(products);
  const { items } = await queryProducts()
    .in(
      '_id',
      recommendation.items!.map((item) => item.catalogItemId)
    )
    .find();
  return items.slice(0, 6).map(reshapeProduct);
}

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  const { items } = await sortedProductsQuery(sortKey, reverse)
    .startsWith('name', query || '')
    .find();

  return items.map(reshapeProduct);
}

export const getWixClient = () => {
  let refreshToken;
  try {
    const cookieStore = cookies();
    refreshToken = JSON.parse(cookieStore.get(WIX_REFRESH_TOKEN_COOKIE)?.value || '{}');
  } catch (e) {}
  const wixClient = createClient({
    auth: OAuthStrategy({
      clientId: process.env.WIX_CLIENT_ID!,
      tokens: {
        refreshToken,
        accessToken: { value: '', expiresAt: 0 }
      }
    })
  });
  return wixClient;
};
