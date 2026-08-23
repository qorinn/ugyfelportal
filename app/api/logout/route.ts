import { NextResponse } from "next/server"

import { SESSION_COOKIE_NAME } from "@/lib/auth"

// POST, nem GET: egy link-előtöltés vagy egy idegen oldalról betöltött kép
// nem léptethet ki. A proxy erre az útvonalra is fut, tehát csak belépve érhető el.
export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  })

  response.cookies.delete(SESSION_COOKIE_NAME)

  return response
}
