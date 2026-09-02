"use client"

import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { RiCheckLine, RiCloseLine, RiErrorWarningLine } from "@remixicon/react"

type CmsFeedbackToastProps = {
  notice?: string
  error?: string
}

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return toasts.map((toast) => {
    const isError = toast.type === "error"

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        swipeDirection="right"
        className="w-full rounded-lg border border-border bg-background p-4 shadow-lg outline-none transition data-ending-style:translate-x-4 data-ending-style:opacity-0"
      >
        <Toast.Content className="flex items-start gap-3">
          {isError ? (
            <RiErrorWarningLine className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
          ) : (
            <RiCheckLine className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-sm font-medium" />
            <Toast.Description className="mt-1 text-sm text-muted-foreground" />
          </div>
          <Toast.Close
            className="shrink-0 rounded-sm text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Visszajelzés bezárása"
          >
            <RiCloseLine aria-hidden="true" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    )
  })
}

function FeedbackEffect({ notice, error }: CmsFeedbackToastProps) {
  const toastManager = Toast.useToastManager()
  const displayed = React.useRef<string | null>(null)
  const isError = error !== undefined
  const message = isError
    ? error?.trim() || "A művelet nem sikerült. Próbáld újra."
    : notice?.trim() || "A művelet sikeresen befejeződött."

  React.useEffect(() => {
    if (notice === undefined && error === undefined) return

    const key = `${isError ? "error" : "notice"}:${message}`
    if (displayed.current === key) return
    displayed.current = key

    toastManager.add({
      title: isError ? "Nem sikerült menteni" : "Sikeres művelet",
      description: message,
      type: isError ? "error" : "success",
      timeout: isError ? 8000 : 5000,
    })

    const url = new URL(window.location.href)
    url.searchParams.delete("notice")
    url.searchParams.delete("error")
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
  }, [error, isError, message, notice, toastManager])

  return null
}

export function CmsFeedbackToast({ notice, error }: CmsFeedbackToastProps) {
  if (notice === undefined && error === undefined) return null

  return (
    <Toast.Provider>
      <FeedbackEffect notice={notice} error={error} />
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 top-4 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
