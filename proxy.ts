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
    // Az api/lead$ horgony szándékos: az /api/lead szerver-szerver hívás Bearer
    // tokennel, de az /api/lead-followup dashboard-művelet, aminek védve KELL
    // maradnia. Horgony nélkül a prefix-illesztés azt is kiengedné.
    "/((?!api/event|api/lead$|api/login|login|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
}
