import {
  CONTENT_STATUSES,
  LINK_ICONS,
  LINK_STYLES,
  SECTION_TYPES,
  type CmsContent,
  type ContentStatus,
  type LinkIcon,
  type LinkStyle,
  type SectionType,
} from "@/lib/cms"

export class CmsValidationError extends Error {}

export function optionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

export function requiredString(
  value: FormDataEntryValue | null,
  label: string
): string {
  const result = optionalString(value)
  if (!result) throw new CmsValidationError(`${label} megadása kötelező.`)
  return result
}

export function integer(value: FormDataEntryValue | null, label: string): number {
  const parsed = Number(typeof value === "string" ? value : "")
  if (!Number.isInteger(parsed)) {
    throw new CmsValidationError(`${label} egész szám legyen.`)
  }
  return parsed
}

function member<T extends readonly string[]>(
  value: FormDataEntryValue | null,
  options: T,
  label: string
): T[number] {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new CmsValidationError(`${label} érvénytelen.`)
  }
  return value as T[number]
}

export function status(value: FormDataEntryValue | null): ContentStatus {
  return member(value, CONTENT_STATUSES, "Státusz")
}

export function sectionType(value: FormDataEntryValue | null): SectionType {
  return member(value, SECTION_TYPES, "Szekció típusa")
}

export function style(value: FormDataEntryValue | null): LinkStyle | null {
  const result = optionalString(value)
  if (result === null) return null
  return member(result, LINK_STYLES, "Linkstílus")
}

export function icon(value: FormDataEntryValue | null): LinkIcon | null {
  const result = optionalString(value)
  if (result === null) return null
  return member(result, LINK_ICONS, "Ikon")
}

export function targetUrl(value: FormDataEntryValue | null): string {
  const url = requiredString(value, "Cél URL")
  try {
    const protocol = new URL(url).protocol
    if (!["https:", "http:", "mailto:"].includes(protocol)) throw new Error()
  } catch {
    throw new CmsValidationError(
      "A cél URL csak https:, http: vagy mailto: sémát használhat."
    )
  }
  return url
}

export function redirectSlug(value: FormDataEntryValue | null): string | null {
  const slug = optionalString(value)
  if (slug !== null && !/^[A-Za-z0-9_-]+$/.test(slug)) {
    throw new CmsValidationError(
      "A redirect slug csak betűt, számot, kötőjelet és aláhúzást tartalmazhat."
    )
  }
  return slug
}

export function parentReference(value: FormDataEntryValue | null): {
  section_id: string | null
  project_id: string | null
} {
  const reference = requiredString(value, "Szülő")
  const separator = reference.indexOf(":")
  const type = reference.slice(0, separator)
  const id = reference.slice(separator + 1)
  if (!id || !["section", "project"].includes(type)) {
    throw new CmsValidationError("Válassz egy szekciót vagy projektet szülőnek.")
  }
  return {
    section_id: type === "section" ? id : null,
    project_id: type === "project" ? id : null,
  }
}

export function validatePublishedContent(content: CmsContent): string[] {
  const issues: string[] = []
  const publishedProfile = content.profile?.status === "published" ? content.profile : null
  if (!publishedProfile || !publishedProfile.name.trim()) {
    issues.push("Pontosan egy, névvel kitöltött publikált profil szükséges.")
  }

  const publishedSections = new Set(
    content.sections.filter((section) => section.status === "published").map((section) => section.id)
  )
  const publishedProjects = new Set(
    content.projects.filter((project) => project.status === "published").map((project) => project.id)
  )
  const publishedProjectRelations = new Set(
    content.sectionProjects
      .filter(
        (relation) =>
          publishedSections.has(relation.section_id) &&
          publishedProjects.has(relation.project_id)
      )
      .map((relation) => relation.project_id)
  )

  for (const section of content.sections.filter(
    (item) => item.status === "published"
  )) {
    if (!section.key || !section.section_type || !Number.isInteger(section.sort_order)) {
      issues.push(`A(z) „${section.title ?? section.key}” szekció hiányos.`)
    }
  }

  for (const project of content.projects.filter(
    (item) => item.status === "published"
  )) {
    if (!project.title || !project.slug) {
      issues.push(`Egy publikált projekt címe és slugja kötelező.`)
    }
  }

  const seenSlugs = new Set<string>()
  for (const link of content.links.filter((item) => item.status === "published")) {
    const parentIsPublished = link.section_id
      ? publishedSections.has(link.section_id)
      : link.project_id
        ? publishedProjects.has(link.project_id) && publishedProjectRelations.has(link.project_id)
        : false
    if (!parentIsPublished) {
      issues.push(`A(z) „${link.label}” link publikálva van, de a szülője nem elérhető.`)
    }
    if (!link.label || !link.target_url || !Number.isInteger(link.sort_order)) {
      issues.push(`A(z) „${link.label || "névtelen"}” link hiányos.`)
    }
    try {
      targetUrl(link.target_url)
    } catch {
      issues.push(`A(z) „${link.label}” link cél URL-je érvénytelen.`)
    }
    if (link.trackable) {
      if (!link.redirect_slug || !/^[A-Za-z0-9_-]+$/.test(link.redirect_slug)) {
        issues.push(`A(z) „${link.label}” trackelt linkhez érvényes slug kell.`)
      } else if (seenSlugs.has(link.redirect_slug)) {
        issues.push(`A(z) „${link.redirect_slug}” redirect slug nem egyedi.`)
      } else {
        seenSlugs.add(link.redirect_slug)
      }
    }
  }

  return issues
}
