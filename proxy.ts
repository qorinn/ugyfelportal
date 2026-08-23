import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth"

// Next 16: a middleware konvenció neve proxy. Ez a kapu csak a dashboardot védi —
// az /api/event a saját Bearer tokenjével hitelesít, ezért ki van hagyva a matcherből.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (isValidSessionToken(token)) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/login", request.url))
}

export const config = {
  matcher: [
    "/((?!api/event|api/login|login|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
}
