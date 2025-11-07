import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/"];

export default function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const cookie = req.cookies.get("amigo_secreto_user");
  const userCookie = cookie?.value?.trim();

  // check protected routes
  const isProtected = protectedRoutes.some(
    (route) => url.pathname === route || url.pathname.startsWith(route + "/")
  );

  if (isProtected && !userCookie) {
    if (url.pathname !== "/login") {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (url.pathname === "/login" && userCookie) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|images).*)"],
};
