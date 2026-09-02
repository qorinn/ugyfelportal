import "server-only"

import { supabaseAdmin } from "@/lib/supabase"

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const
export const SECTION_TYPES = [
  "primary_links",
  "social_links",
  "links",
  "projects",
] as const
export const LINK_STYLES = ["default", "primary", "subtle"] as const
export const LINK_ICONS = [
  "github",
  "linkedin",
  "instagram",
  "mail",
  "file-text",
  "globe",
  "external-link",
  "youtube",
] as const

export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export type SectionType = (typeof SECTION_TYPES)[number]
export type LinkStyle = (typeof LINK_STYLES)[number]
export type LinkIcon = (typeof LINK_ICONS)[number]

export type SiteProfile = {
  id: string
  name: string
  position: string | null
  description: string | null
  avatar_path: string | null
  location: string | null
  availability_text: string | null
  footer_text: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_path: string | null
  expand_label: string | null
  collapse_label: string | null
  status: ContentStatus
}

export type CmsSection = {
  id: string
  key: string
  title: string | null
  description: string | null
  section_type: SectionType
  sort_order: number
  status: ContentStatus
}

export type CmsProject = {
  id: string
  title: string
  slug: string
  short_description: string | null
  expanded_description: string | null
  image_path: string | null
  status: ContentStatus
}

export type SectionProject = {
  section_id: string
  project_id: string
  sort_order: number
}

export type CmsLink = {
  id: string
  section_id: string | null
  project_id: string | null
  label: string
  description: string | null
  icon: LinkIcon | null
  target_url: string
  redirect_slug: string | null
  trackable: boolean
  open_in_new_tab: boolean
  style: LinkStyle | null
  sort_order: number
  status: ContentStatus
}

export type CmsContent = {
  profile: SiteProfile | null
  sections: CmsSection[]
  projects: CmsProject[]
  sectionProjects: SectionProject[]
  links: CmsLink[]
}

function ensureData<T>(data: T | null, error: { message: string } | null): T {
  if (error) {
    throw new Error(error.message)
  }
  if (data === null) {
    throw new Error("A CMS lekérdezés nem adott vissza adatot.")
  }
  return data
}

export async function loadCmsContent(): Promise<CmsContent> {
  const client = supabaseAdmin()
  const [profileResult, sectionsResult, projectsResult, relationsResult, linksResult] =
    await Promise.all([
      client.from("site_profile").select("*").order("created_at").limit(1).maybeSingle(),
      client.from("sections").select("*").order("sort_order").order("created_at"),
      client.from("projects").select("*").order("title"),
      client.from("section_projects").select("*").order("sort_order"),
      client.from("links").select("*").order("sort_order").order("created_at"),
    ])

  if (profileResult.error) throw new Error(profileResult.error.message)

  return {
    profile: (profileResult.data as SiteProfile | null) ?? null,
    sections: ensureData(sectionsResult.data, sectionsResult.error) as CmsSection[],
    projects: ensureData(projectsResult.data, projectsResult.error) as CmsProject[],
    sectionProjects: ensureData(
      relationsResult.data,
      relationsResult.error
    ) as SectionProject[],
    links: ensureData(linksResult.data, linksResult.error) as CmsLink[],
  }
}
