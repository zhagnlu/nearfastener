import { NextRequest, NextResponse } from 'next/server';
import routes from './content/routes.json';
import { resolvePageRequest } from './scripts/localization.mjs';

export function proxy(request: NextRequest) {
  const page = resolvePageRequest(request.nextUrl.pathname, request.nextUrl.search, routes);
  if (page?.redirect) return NextResponse.redirect(new URL(page.redirect, request.url), 301);
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_vinext|assets|site\\.|replica\\.).*)'] };
