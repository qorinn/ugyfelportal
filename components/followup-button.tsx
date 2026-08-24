"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { RiMailSendLine } from "@remixicon/react"

import { Button } from "@/components/ui/button"

export function FollowupButton({
  sessionId,
  gmailUrl,
  followedUp,
}: {
  sessionId: string
  gmailUrl: string
  followedUp: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    // A window.open-nak a kattintás szinkron ágában kell lefutnia, különben a
    // popup-blokkoló megeszi. Ezért nyitunk előbb, és csak utána mentünk.
    window.open(gmailUrl, "_blank", "noopener,noreferrer")

    setPending(true)
    try {
      await fetch("/api/lead-followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      router.refresh()
    } catch (error) {
      console.error("follow-up mentése nem sikerült", error)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      size="xs"
      variant={followedUp ? "ghost" : "outline"}
      disabled={pending}
      onClick={handleClick}
    >
      <RiMailSendLine data-icon="inline-start" />
      {followedUp ? "Follow-up újra" : "Follow-up küldése"}
    </Button>
  )
}
