import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();

  // Fill in the body of this function
  // In the middleware, we need to check if the request already has a visitor
  // session cookie. If it does, we can continue running the request handler,
  // otherwise we need to create a new visitor session and set the cookie.

  return res;
}

export const config = {
  unstable_allowDynamic: ['/node_modules/.pnpm/lodash@*/**']
};
