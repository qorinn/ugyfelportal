"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { RiDeleteBinLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"

export function DeleteSessionButton({
  sessionId,
  identity,
  runCount,
  hasLead,
}: {
  sessionId: string
  identity: string
  runCount: number
  hasLead: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    // A törlés visszavonhatatlan, és a teljes munkamenetet viszi — a
    // megerősítés ezért mondja ki, pontosan mi tűnik el.
    const message = [
      `Biztosan törlöd a(z) ${identity} munkamenetét?`,
      "",
      `Ez törli a munkamenet összes eseményét${hasLead ? " és a hozzá tartozó leadet (név, e-mail, telefon)" : ""}.`,
      runCount > 1
        ? `Figyelem: ehhez a munkamenethez ${runCount} futás tartozik, mind eltűnik.`
        : "",
      "",
      "A művelet nem vonható vissza.",
    ]
      .filter(Boolean)
      .join("\n")

    if (!window.confirm(message)) {
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/session-delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      if (!response.ok) {
        window.alert("A törlés nem sikerült. Nézd meg a szerver naplóját.")
        return
      }

      router.refresh()
    } catch (error) {
      console.error("törlés nem sikerült", error)
      window.alert("A törlés nem sikerült.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="xs"
      variant="destructive"
      disabled={pending}
      onClick={handleClick}
    >
      <RiDeleteBinLine data-icon="inline-start" />
      Törlés
    </Button>
  )
}
