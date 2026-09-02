import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { loadCmsContent } from "@/lib/cms"
import {
  CmsValidationError,
  icon,
  integer,
  optionalString,
  parentReference,
  redirectSlug,
  requiredString,
  sectionType,
  status,
  style,
  targetUrl,
  validatePublishedContent,
} from "@/lib/cms-validation"
import { supabaseAdmin } from "@/lib/supabase"

const CMS_PATH = "/cms"

function redirectToCms(request: Request, key: "notice" | "error", message: string) {
  const url = new URL(CMS_PATH, request.url)
  url.searchParams.set(key, message.slice(0, 500))
  return NextResponse.redirect(url, { status: 303 })
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    throw new CmsValidationError("Érvénytelen kérés eredet.")
  }
}

async function throwOnError(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message)
}

async function saveProfile(formData: FormData) {
  const client = supabaseAdmin()
  const id = optionalString(formData.get("id")) ?? randomUUID()
  await throwOnError(
    await client.from("site_profile").upsert({
      id,
      name: requiredString(formData.get("name"), "Név"),
      position: optionalString(formData.get("position")),
      description: optionalString(formData.get("description")),
      avatar_path: optionalString(formData.get("avatar_path")),
      location: optionalString(formData.get("location")),
      availability_text: optionalString(formData.get("availability_text")),
      footer_text: optionalString(formData.get("footer_text")),
      meta_title: optionalString(formData.get("meta_title")),
      meta_description: optionalString(formData.get("meta_description")),
      og_image_path: optionalString(formData.get("og_image_path")),
      expand_label: optionalString(formData.get("expand_label")),
      collapse_label: optionalString(formData.get("collapse_label")),
      status: status(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
  )
}

async function saveSection(formData: FormData) {
  const client = supabaseAdmin()
  await throwOnError(
    await client.from("sections").upsert({
      id: optionalString(formData.get("id")) ?? randomUUID(),
      key: requiredString(formData.get("key"), "Szekciókulcs"),
      title: optionalString(formData.get("title")),
      description: optionalString(formData.get("description")),
      section_type: sectionType(formData.get("section_type")),
      sort_order: integer(formData.get("sort_order"), "Sorrend"),
      status: status(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
  )
}

async function saveProject(formData: FormData) {
  const client = supabaseAdmin()
  const id = optionalString(formData.get("id")) ?? randomUUID()
  const selectedSectionIds = new Set(
    formData
      .getAll("section_id")
      .filter((value): value is string => typeof value === "string")
  )

  await throwOnError(
    await client.from("projects").upsert({
      id,
      title: requiredString(formData.get("title"), "Projektcím"),
      slug: requiredString(formData.get("slug"), "Projekt slug"),
      short_description: optionalString(formData.get("short_description")),
      expanded_description: optionalString(formData.get("expanded_description")),
      image_path: optionalString(formData.get("image_path")),
      status: status(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
  )

  const { data: currentRelations, error: relationsError } = await client
    .from("section_projects")
    .select("section_id")
    .eq("project_id", id)
  await throwOnError({ error: relationsError })

  const currentSectionIds = new Set(
    (currentRelations ?? []).map((relation) => relation.section_id as string)
  )
  const removedIds = [...currentSectionIds].filter(
    (sectionId) => !selectedSectionIds.has(sectionId)
  )
  if (removedIds.length > 0) {
    await throwOnError(
      await client
        .from("section_projects")
        .delete()
        .eq("project_id", id)
        .in("section_id", removedIds)
    )
  }

  const assignments = [...selectedSectionIds].map((sectionId) => ({
    section_id: sectionId,
    project_id: id,
    sort_order: integer(
      formData.get(`section_sort_order_${sectionId}`),
      "Projekt sorrendje"
    ),
  }))
  if (assignments.length > 0) {
    await throwOnError(
      await client
        .from("section_projects")
        .upsert(assignments, { onConflict: "section_id,project_id" })
    )
  }
}

async function saveLink(formData: FormData) {
  const client = supabaseAdmin()
  const trackable = formData.get("trackable") === "on"
  const slug = redirectSlug(formData.get("redirect_slug"))
  if (trackable && !slug) {
    throw new CmsValidationError("Trackelt linkhez redirect slug kötelező.")
  }

  await throwOnError(
    await client.from("links").upsert({
      id: optionalString(formData.get("id")) ?? randomUUID(),
      ...parentReference(formData.get("parent_ref")),
      label: requiredString(formData.get("label"), "Linkcímke"),
      description: optionalString(formData.get("description")),
      icon: icon(formData.get("icon")),
      target_url: targetUrl(formData.get("target_url")),
      redirect_slug: slug,
      trackable,
      open_in_new_tab: formData.get("open_in_new_tab") === "on",
      style: style(formData.get("style")),
      sort_order: integer(formData.get("sort_order"), "Sorrend"),
      status: status(formData.get("status")),
      updated_at: new Date().toISOString(),
    })
  )
}

async function deleteRecord(resource: string, formData: FormData) {
  const id = requiredString(formData.get("id"), "Azonosító")
  const table =
    resource === "section"
      ? "sections"
      : resource === "project"
        ? "projects"
        : resource === "link"
          ? "links"
          : null
  if (!table) throw new CmsValidationError("Ez a rekord nem törölhető.")
  await throwOnError(await supabaseAdmin().from(table).delete().eq("id", id))
}

async function triggerDeploy() {
  const issues = validatePublishedContent(await loadCmsContent())
  if (issues.length > 0) {
    throw new CmsValidationError(`Publikálás előtt javítsd: ${issues.join(" ")}`)
  }

  const hookUrl = process.env.NETLIFY_BUILD_HOOK_URL
  if (!hookUrl) {
    throw new CmsValidationError(
      "Hiányzik a NETLIFY_BUILD_HOOK_URL környezeti változó."
    )
  }
  if (new URL(hookUrl).protocol !== "https:") {
    throw new CmsValidationError("A Netlify build hooknak HTTPS URL-nek kell lennie.")
  }

  const response = await fetch(hookUrl, { method: "POST", cache: "no-store" })
  if (!response.ok) {
    throw new Error(`A Netlify build hook hibát adott (${response.status}).`)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    assertSameOrigin(request)
    const { resource } = await context.params
    const formData = await request.formData()
    const action = optionalString(formData.get("action")) ?? "save"

    if (resource === "deploy" && action === "deploy") {
      await triggerDeploy()
    } else if (action === "delete") {
      await deleteRecord(resource, formData)
    } else if (resource === "profile") {
      await saveProfile(formData)
    } else if (resource === "section") {
      await saveSection(formData)
    } else if (resource === "project") {
      await saveProject(formData)
    } else if (resource === "link") {
      await saveLink(formData)
    } else {
      throw new CmsValidationError("Ismeretlen CMS művelet.")
    }

    revalidatePath(CMS_PATH)
    return redirectToCms(
      request,
      "notice",
      resource === "deploy" ? "A build hook elindult." : "A módosítás mentve."
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba történt."
    return redirectToCms(request, "error", message)
  }
}
