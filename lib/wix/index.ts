import { currentCart } from '@wix/ecom';
import { WixClient, createClient, media } from '@wix/sdk';
import { collections, products } from '@wix/stores';
import { SortKey } from 'lib/constants';
import { Cart, Collection, Menu, Page, Product } from './types';

export const getWixClient = (): WixClient => {
  // In this function we want to return a new WixClient that has been initialized
  // with the visitor session that we created in the middleware. We need to make sure
  // to read the tokens from the cookies and initialize the client correctly.
  
  return createClient({});
};

export async function getProducts({
  query,
  reverse,
  sortKey
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  // Here we should get all the products that match the requested parameters:
  // query - A search query that was entered in the UI
  // reverse - if true - should be descending sort, otherwise - ascending
  // sortKey - the key to sort by (price, title, etc.)

  return [];
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  // Here we need to get a specific product by it's handle - in Wix terms it's called the slug.
  // Note: you can use the reshapeProduct function to transform the Wix product to the product type that we use in the app.

  return undefined;
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  // In this function we want to return a list of recommended products for the given product ID.
  // Those will be displayed on the product page, suggesting other related products to the user.
  // Try to see if you can find the correct API to call to get the product recommendations.
  // Note: you can use the reshapeProduct function to transform the Wix product to the product type that we use in the app.
  
  return [];
}

export async function getCollections(): Promise<Collection[]> {
  // This function retrieves all the product collections (in Wix Dashborad called Categories).
  // Get all the collections and pass them here where they will be reshaped for the app.

  const wixCollections: collections.Collection[] = [];

  const productCollections = [
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
    ...reshapeCollections(wixCollections).filter((collection) => !collection.handle.startsWith('hidden'))
  ];

  return productCollections;
}

export async function getCollection(handle: string): Promise<Collection | undefined> {
  // This function retrieves a specific collection by it's handle (slug).
  // Note: you can use the `reshapeCollection` function to reshape the collection for this app.

  return undefined;
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: SortKey;
}): Promise<Product[]> {
  // This function returns all the products in a given collection. Note that
  // the collection parameter here is the collection handle (/ slug). This function should
  // also respect the `reverse` and `sortKey` paramteres like `getProducts`.

  return [];
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  // This function adds the given lines to the current visitor cart. Note that the merchandiseId is the product ID.
  // You can use the reshapeCart function to reshape the cart for the app.

  throw new Error('addToCart is not implemented')
}

export async function getCart(): Promise<Cart | undefined> {
  // This function returns the current visitor cart. You can use the reshapeCart function to reshape the cart for the app.
  // Note that the visitor might not have a cart yet, so this function should return undefined if there is no cart.
  
  return undefined;
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  // This function removes the given lines from the current visitor cart. Note that the lineId is the cart line ID.
  // You can use the reshapeCart function to reshape the cart for the app.

  throw new Error('removeFromCart is not implemented')
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[]
): Promise<Cart> {
  // This function updates the given lines in the current visitor cart. Note that the lineId is the cart line ID.
  // You can use the reshapeCart function to reshape the cart for the app.

  throw new Error('updateCart is not implemented')
}

export async function createCheckoutUrl(postFlowUrl: string) {
  // Here we should create a checkout URL for the user to complete the purchase.
  // We should use the postFlowUrl to redirect the user back to the site after the purchase is complete.
  // The checkout URL is based on redirect sessions, see the full documentation at:
  // https://dev.wix.com/docs/sdk/api-reference/redirects/redirects/introduction

  return 'https://google.com';
}

export async function getMenu(handle: string): Promise<Menu[]> {
  // This app also manages its menu using the API provider as a dynamic CMS data.
  // This functon should return the menu items for the given menu handle.
  // Think how you can model the menu in a way that will allow to easily retrieve
  // the path of the relevant page for each menu item.

  return [];
}

export async function getPage(handle: string): Promise<Page> {
  // This function is used to retrieve a specific page by it's handle (slug).
  // Depending on how you modeled your pages, this function should be able to
  // return only a specific page by handle / slug.

  throw new Error('getPage is not implemented')
}

export async function getPages(): Promise<Page[]> {
  // This template also uses the API provider as a CMS - allowing it to define
  // dynamic pages that will be retrieved from Wix at runtime.
  // Check out how we can use Wix as a CMS here - How would you model and manage the pages?

  return [];
}

const reshapeCart = (cart: currentCart.Cart): Cart => {
  return {
    id: cart._id!,
    checkoutUrl: '/cart-checkout',
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