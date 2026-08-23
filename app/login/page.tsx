import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SESSION_COOKIE_NAME, isValidSessionToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const cookieStore = await cookies()
  if (isValidSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)) {
    redirect("/")
  }

  const hasError = (await searchParams).error === "1"

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Belépés</CardTitle>
          <CardDescription>
            A dashboard jelszóval védett. A jelszót a DASHBOARD_PASSWORD
            környezeti változó adja.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="post" action="/api/login">
            <FieldGroup>
              <Field data-invalid={hasError || undefined}>
                <FieldLabel htmlFor="password">Jelszó</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  aria-invalid={hasError || undefined}
                />
              </Field>
              <Button type="submit">Belépés</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
