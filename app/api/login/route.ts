import { NextResponse } from "next/server"

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isCorrectPassword,
} from "@/lib/auth"

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get("password")

  if (typeof password !== "string" || !isCorrectPassword(password)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), {
      status: 303,
    })
  }

  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  })

  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  return response
}
