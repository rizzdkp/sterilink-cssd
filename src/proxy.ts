import { NextResponse, type NextRequest } from 'next/server';

// Teruskan jalur yang diminta ke layout, supaya pengguna yang belum masuk
// dikembalikan ke halaman yang sama setelah login.
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-cssd-path', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Halaman kerja memuat data operasional: jangan disimpan cache peramban atau proxy.
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/cssd/:path*'],
};
