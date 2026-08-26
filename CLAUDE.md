# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # next dev
npm run build      # next build
npm run start      # next start (needs a prior build)
npm run lint       # eslint (flat config, next core-web-vitals + typescript)
npm run typecheck  # tsc --noEmit
npm run format     # prettier --write "**/*.{ts,tsx}"
```

Package manager is npm (`package-lock.json`). No test runner is configured — don't
assume one exists or invent test commands.

## Next.js 16 — do not code from memory

`AGENTS.md` states this: the installed Next.js (16.2.6, React 19.2) has breaking
changes versus older training data. Before writing routing, data-fetching, caching,
`params`/`searchParams`, or config code, read the vendored docs in
`node_modules/next/dist/docs/` (`01-app/01-getting-started`, `01-app/02-guides`,
`01-app/03-api-reference`). Heed deprecation notices there.

Already hit in this repo:

- **`middleware.ts` is renamed `proxy.ts`** — the file exports a function named
  `proxy`, lives at the project root, and defaults to the **Node.js** runtime (the
  `runtime` segment config throws there). See
  `01-app/03-api-reference/03-file-conventions/proxy.md`.
- `cookies()`, `searchParams`, and `params` are async — always `await` them.

## shadcn/ui — Base UI, not Radix

The `shadcn` skill is vendored at [.agents/skills/shadcn/](.agents/skills/shadcn/) and
pinned by [skills-lock.json](skills-lock.json). Read
[SKILL.md](.agents/skills/shadcn/SKILL.md) plus the relevant `rules/*.md` before
adding or editing UI. The three settings from [components.json](components.json) most
likely to be gotten wrong:

- **`base` primitives** (`style: base-mira`, dependency `@base-ui/react`) — composition
  uses the `render` prop, **not** Radix's `asChild`. See
  [rules/base-vs-radix.md](.agents/skills/shadcn/rules/base-vs-radix.md).
- **`iconLibrary: remixicon`** — import from `@remixicon/react`, never `lucide-react`.
- **`rsc: true`** — anything with hooks, handlers, or browser APIs needs `"use client"`.

Add components through the CLI (`npx shadcn@latest add <name>`), which writes into
[components/ui/](components/ui/); don't hand-write files there or fetch registry
sources manually.

## Conventions

- Import alias `@/*` maps to the repo root — `@/components/ui/button`, `@/lib/utils`.
- `cn()` from [lib/utils.ts](lib/utils.ts) for all conditional/merged class names.
- Prettier: **no semicolons**, double quotes, 2-space, 80 cols, `es5` trailing commas.
  `prettier-plugin-tailwindcss` sorts classes and is configured to also sort inside
  `cn()` and `cva()` calls, against [app/globals.css](app/globals.css).
- Tailwind v4 — no `tailwind.config.js`. Theme tokens live in the `@theme inline` block
  and the `:root` / `.dark` custom-property blocks of [app/globals.css](app/globals.css).
  Edit that file for theming; never create a new global stylesheet.
- Dark mode is class-based via `next-themes` in
  [components/theme-provider.tsx](components/theme-provider.tsx), which also binds a
  global `d` hotkey to toggle themes. Use semantic tokens (`bg-background`,
  `text-muted-foreground`) rather than `dark:` overrides.

## Project intent

**Scope: build only [kalkulator-analitika-terv.md](kalkulator-analitika-terv.md).**
[ugyfelportal-terv.md](ugyfelportal-terv.md) describes the multi-tenant customer
portal this may grow into later (auth, memberships/RLS policies, form-submissions,
CMS, file storage, path-based tenants). That document is background only — do not
implement any of it, and do not add auth, tenancy, or extra modules "in preparation".
The one concession to it is that `app_id` exists in the schema from day one so the
later migration is free.

The plan being built is a first-party analytics app for the paladi-web quote
calculator. Key decisions from it that constrain implementation:

- Single Supabase `events` table (`app_id`, `session_id`, `name`, `props`,
  `created_at`) with RLS **on and no policies** — only the server-side `service_role`
  key reads it. `app_id` is present from the start so the later customer portal needs
  no migration.
- Ingest is `POST /api/event`, authorized by `Bearer ${INGEST_SECRET}`, with an
  event-name whitelist. Browsers never call it directly; paladi-web proxies through
  its own first-party `/api/track` (ad-blocker and CORS avoidance).
- The funnel is data, not code — defined as arrays in `lib/funnel.ts`. The dashboard
  fetches raw events and aggregates in TypeScript, deliberately not in SQL.
- No personal data in `props` — no e-mail, phone, or free text. No persistent visitor
  id; `session_id` is a `sessionStorage` UUID only.
- The dashboard must stay `noindex` (robots.txt, meta tag, `X-Robots-Tag` in
  `next.config.ts`) and gated by a password-checking `middleware.ts`.

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `INGEST_SECRET`, `DASHBOARD_PASSWORD`) are
server-only — never prefixed `NEXT_PUBLIC_`. See [.env.example](.env.example); local
values go in a gitignored `.env.local`.

## Where things live

- [lib/funnel.ts](lib/funnel.ts) — the funnel/outcome definitions, the known-event
  whitelist, and `ALLOWED_PROP_KEYS`. Changing what the dashboard measures should mean
  editing these arrays, not the dashboard.
- [lib/analytics.ts](lib/analytics.ts) — pure aggregation over raw events; no Supabase
  or React imports, so it stays trivially checkable.
- [lib/supabase.ts](lib/supabase.ts) — lazily built `service_role` client, `server-only`.
  Lazy on purpose: `next build` must succeed without env vars.
- [lib/auth.ts](lib/auth.ts) — the dashboard cookie is `<expiry>.<HMAC(expiry)>` keyed by
  `DASHBOARD_PASSWORD`; the password itself is never stored in the cookie. Throws when
  the env var is missing, so the gate fails closed.
- [lib/leads.ts](lib/leads.ts) — lead status ranking, the two merge rules (status only
  strengthens; empty values never overwrite), and the Gmail follow-up template. Pure
  functions, deliberately separate from the route handler.
- [lib/errors.ts](lib/errors.ts) — `calculator_error` aggregation. **Count distinct
  sessions, never rows**: one failed request emits both a client and a server error with
  the same `session_id`. Client errors are also capped at 5 per session upstream, so
  event counts are a lower bound while the session rate is exact.
- [lib/props.ts](lib/props.ts) — the ingest clamp (24 keys, 300 chars, 4096 bytes,
  scalars only). Replaced the old key whitelist because error props are stage-dependent.
  Consequence: `props` is no longer trusted data — the paladi-web `/api/track` proxy that
  feeds it is public and unauthenticated, so always render `message` as text, never HTML.
- [proxy.ts](proxy.ts) — the gate. Its matcher excludes `/api/event` and `/api/lead`,
  which authenticate with their own `Bearer INGEST_SECRET`. **The `api/lead$` anchor is
  load-bearing**: without it the prefix match would also unprotect
  `/api/lead-followup`, which is a dashboard action and must stay behind the gate.
- [supabase/migrations/](supabase/migrations/) — SQL to run by hand in the Supabase SQL
  editor. There is no migration tooling.
