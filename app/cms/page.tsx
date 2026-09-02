import Link from "next/link"
import { connection } from "next/server"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiLogoutBoxRLine,
  RiSaveLine,
  RiSendPlane2Line,
} from "@remixicon/react"

import { CmsNativeSelect, CmsTextarea } from "@/components/cms-form-controls"
import { CmsFeedbackToast } from "@/components/cms-feedback-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CONTENT_STATUSES,
  LINK_ICONS,
  LINK_STYLES,
  SECTION_TYPES,
  loadCmsContent,
  type CmsLink,
  type CmsProject,
  type CmsSection,
  type ContentStatus,
} from "@/lib/cms"

type EditTarget = "section" | "project" | "link" | null

function parseEdit(value: string | undefined): { type: EditTarget; id: string | null } {
  if (!value) return { type: null, id: null }
  const [type, id] = value.split(":", 2)
  if (!id || !["section", "project", "link"].includes(type)) {
    return { type: null, id: null }
  }
  return { type: type as EditTarget, id }
}

function valueOf(value: string | null | undefined) {
  return value ?? ""
}

function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge variant={status === "published" ? "default" : "secondary"}>
      {status === "published" ? "Közzétéve" : status === "draft" ? "Piszkozat" : "Archivált"}
    </Badge>
  )
}

function StatusField({ value }: { value: ContentStatus }) {
  return (
    <Field>
      <FieldLabel htmlFor="status">Státusz</FieldLabel>
      <CmsNativeSelect id="status" name="status" defaultValue={value}>
        {CONTENT_STATUSES.map((item) => (
          <option key={item} value={item}>
            {item === "published" ? "Közzétéve" : item === "draft" ? "Piszkozat" : "Archivált"}
          </option>
        ))}
      </CmsNativeSelect>
    </Field>
  )
}

function RecordActions({ type, id }: { type: Exclude<EditTarget, null>; id: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/cms?edit=${type}:${id}`} />}>
        Szerkesztés
      </Button>
      <form method="post" action={`/api/cms/${type}`}>
        <input type="hidden" name="action" value="delete" />
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm" variant="destructive">
          <RiDeleteBinLine data-icon="inline-start" />
          Törlés
        </Button>
      </form>
    </div>
  )
}

function ProfileForm({ profile }: { profile: Awaited<ReturnType<typeof loadCmsContent>>["profile"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil és metaadatok</CardTitle>
        <CardDescription>
          Egyetlen site setting. A képútvonal a Link Hub repository <code>public/</code> mappájára mutasson.
        </CardDescription>
      </CardHeader>
      <form method="post" action="/api/cms/profile">
        <input type="hidden" name="id" value={profile?.id ?? ""} />
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="profile-name">Név</FieldLabel>
              <Input id="profile-name" name="name" required defaultValue={valueOf(profile?.name)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="position">Pozíció</FieldLabel>
              <Input id="position" name="position" defaultValue={valueOf(profile?.position)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-description">Bemutatkozás</FieldLabel>
              <CmsTextarea id="profile-description" name="description" defaultValue={valueOf(profile?.description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="avatar-path">Avatar útvonala</FieldLabel>
              <Input id="avatar-path" name="avatar_path" placeholder="/images/profile.webp" defaultValue={valueOf(profile?.avatar_path)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="location">Helyszín</FieldLabel>
              <Input id="location" name="location" defaultValue={valueOf(profile?.location)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="availability">Elérhetőségi szöveg</FieldLabel>
              <Input id="availability" name="availability_text" defaultValue={valueOf(profile?.availability_text)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="footer">Láblécszöveg</FieldLabel>
              <Input id="footer" name="footer_text" defaultValue={valueOf(profile?.footer_text)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="meta-title">Meta cím</FieldLabel>
              <Input id="meta-title" name="meta_title" defaultValue={valueOf(profile?.meta_title)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="meta-description">Meta leírás</FieldLabel>
              <CmsTextarea id="meta-description" name="meta_description" defaultValue={valueOf(profile?.meta_description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="og-image">OG-kép útvonala</FieldLabel>
              <Input id="og-image" name="og_image_path" placeholder="/images/og.webp" defaultValue={valueOf(profile?.og_image_path)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="expand-label">Kibontó felirat</FieldLabel>
              <Input id="expand-label" name="expand_label" placeholder="More" defaultValue={valueOf(profile?.expand_label)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="collapse-label">Visszazáró felirat</FieldLabel>
              <Input id="collapse-label" name="collapse_label" placeholder="Less" defaultValue={valueOf(profile?.collapse_label)} />
            </Field>
            <StatusField value={profile?.status ?? "draft"} />
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit">
            <RiSaveLine data-icon="inline-start" />
            Profil mentése
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function SectionForm({ section }: { section: CmsSection | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{section ? "Szekció szerkesztése" : "Új szekció"}</CardTitle>
        <CardDescription>A megjelenő cím szabadon megadható; a key csak belső, stabil azonosító.</CardDescription>
      </CardHeader>
      <form method="post" action="/api/cms/section">
        <input type="hidden" name="id" value={section?.id ?? ""} />
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="section-key">Key</FieldLabel>
              <Input id="section-key" name="key" required defaultValue={valueOf(section?.key)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="section-title">Látható cím</FieldLabel>
              <Input id="section-title" name="title" defaultValue={valueOf(section?.title)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="section-description">Leírás</FieldLabel>
              <CmsTextarea id="section-description" name="description" defaultValue={valueOf(section?.description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="section-type">Típus</FieldLabel>
              <CmsNativeSelect id="section-type" name="section_type" defaultValue={section?.section_type ?? "links"}>
                {SECTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </CmsNativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="section-order">Sorrend</FieldLabel>
              <Input id="section-order" name="sort_order" type="number" required defaultValue={String(section?.sort_order ?? 0)} />
            </Field>
            <StatusField value={section?.status ?? "draft"} />
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit"><RiSaveLine data-icon="inline-start" />Mentés</Button>
          {section && <Button variant="outline" nativeButton={false} render={<Link href="/cms" />}>Mégse</Button>}
        </CardFooter>
      </form>
    </Card>
  )
}

function ProjectForm({
  project,
  sections,
  assignments,
}: {
  project: CmsProject | undefined
  sections: CmsSection[]
  assignments: Map<string, number>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{project ? "Projekt szerkesztése" : "Új projekt"}</CardTitle>
        <CardDescription>A projektnek nincs saját route-ja. Jelöld be azokat a szekciókat, amelyekben megjelenik.</CardDescription>
      </CardHeader>
      <form method="post" action="/api/cms/project">
        <input type="hidden" name="id" value={project?.id ?? ""} />
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="project-title">Cím</FieldLabel>
              <Input id="project-title" name="title" required defaultValue={valueOf(project?.title)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-slug">Slug</FieldLabel>
              <Input id="project-slug" name="slug" required defaultValue={valueOf(project?.slug)} />
              <FieldDescription>Stabil CMS-kulcs; nem publikus route.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="short-description">Rövid leírás</FieldLabel>
              <CmsTextarea id="short-description" name="short_description" defaultValue={valueOf(project?.short_description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="expanded-description">Kibontott leírás</FieldLabel>
              <CmsTextarea id="expanded-description" name="expanded_description" defaultValue={valueOf(project?.expanded_description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-image">Képútvonal</FieldLabel>
              <Input id="project-image" name="image_path" placeholder="Jelenleg nem renderelődik" defaultValue={valueOf(project?.image_path)} />
            </Field>
            <Field>
              <FieldLabel>Szekció-hozzárendelések</FieldLabel>
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                {sections.length === 0 ? <p className="text-xs text-muted-foreground">Előbb hozz létre legalább egy szekciót.</p> : sections.map((section) => {
                  const selected = assignments.has(section.id)
                  return (
                    <label key={section.id} className="flex flex-wrap items-center gap-2 text-xs/relaxed">
                      <input type="checkbox" name="section_id" value={section.id} defaultChecked={selected} className="size-3.5 accent-primary" />
                      <span>{section.title || section.key}</span>
                      <Input name={`section_sort_order_${section.id}`} type="number" defaultValue={String(assignments.get(section.id) ?? 0)} className="max-w-20" aria-label={`${section.title || section.key} projekt sorrendje`} />
                    </label>
                  )
                })}
              </div>
              <FieldDescription>Az utolsó mező az adott szekción belüli sorrend.</FieldDescription>
            </Field>
            <StatusField value={project?.status ?? "draft"} />
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit"><RiSaveLine data-icon="inline-start" />Mentés</Button>
          {project && <Button variant="outline" nativeButton={false} render={<Link href="/cms" />}>Mégse</Button>}
        </CardFooter>
      </form>
    </Card>
  )
}

function LinkForm({ link, sections, projects }: { link: CmsLink | undefined; sections: CmsSection[]; projects: CmsProject[] }) {
  const parentReference = link?.section_id ? `section:${link.section_id}` : link?.project_id ? `project:${link.project_id}` : ""
  return (
    <Card>
      <CardHeader>
        <CardTitle>{link ? "Link szerkesztése" : "Új link"}</CardTitle>
        <CardDescription>Minden kattintható elem itt szerepel, közvetlenül egy szekció vagy egy projekt alatt.</CardDescription>
      </CardHeader>
      <form method="post" action="/api/cms/link">
        <input type="hidden" name="id" value={link?.id ?? ""} />
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="parent-ref">Szülő</FieldLabel>
              <CmsNativeSelect id="parent-ref" name="parent_ref" required defaultValue={parentReference}>
                <option value="" disabled>Válassz szülőt</option>
                <optgroup label="Szekciók">
                  {sections.map((section) => <option key={section.id} value={`section:${section.id}`}>{section.title || section.key}</option>)}
                </optgroup>
                <optgroup label="Projektek">
                  {projects.map((project) => <option key={project.id} value={`project:${project.id}`}>{project.title}</option>)}
                </optgroup>
              </CmsNativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-label">Címke</FieldLabel>
              <Input id="link-label" name="label" required defaultValue={valueOf(link?.label)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="link-description">Leírás</FieldLabel>
              <CmsTextarea id="link-description" name="description" defaultValue={valueOf(link?.description)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="target-url">Cél URL</FieldLabel>
              <Input id="target-url" name="target_url" required placeholder="https://… vagy mailto:…" defaultValue={valueOf(link?.target_url)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="redirect-slug">Redirect slug</FieldLabel>
              <Input id="redirect-slug" name="redirect_slug" placeholder="stabil_slug" defaultValue={valueOf(link?.redirect_slug)} />
              <FieldDescription>Trackelt linkhez kötelező és stabilan hagyandó.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-icon">Ikon</FieldLabel>
              <CmsNativeSelect id="link-icon" name="icon" defaultValue={valueOf(link?.icon)}>
                <option value="">Nincs ikon</option>
                {LINK_ICONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </CmsNativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-style">Stílus</FieldLabel>
              <CmsNativeSelect id="link-style" name="style" defaultValue={valueOf(link?.style)}>
                <option value="">Alapértelmezett</option>
                {LINK_STYLES.map((item) => <option key={item} value={item}>{item}</option>)}
              </CmsNativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="link-order">Sorrend</FieldLabel>
              <Input id="link-order" name="sort_order" type="number" required defaultValue={String(link?.sort_order ?? 0)} />
            </Field>
            <Field>
              <label className="flex items-center gap-2 text-xs/relaxed">
                <input type="checkbox" name="trackable" defaultChecked={link?.trackable ?? false} className="size-3.5 accent-primary" />
                Trackelt redirectet használ
              </label>
            </Field>
            <Field>
              <label className="flex items-center gap-2 text-xs/relaxed">
                <input type="checkbox" name="open_in_new_tab" defaultChecked={link?.open_in_new_tab ?? true} className="size-3.5 accent-primary" />
                Új fülön nyíljon meg
              </label>
            </Field>
            <StatusField value={link?.status ?? "draft"} />
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit"><RiSaveLine data-icon="inline-start" />Mentés</Button>
          {link && <Button variant="outline" nativeButton={false} render={<Link href="/cms" />}>Mégse</Button>}
        </CardFooter>
      </form>
    </Card>
  )
}

export default async function CmsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; notice?: string; error?: string }>
}) {
  // A CMS mindig az aktuális admin tartalmat mutatja, ezért nem kerülhet be a
  // build idején készülő statikus HTML-be.
  await connection()
  const content = await loadCmsContent()
  const params = await searchParams
  const edit = parseEdit(params.edit)
  const section = edit.type === "section" ? content.sections.find((item) => item.id === edit.id) : undefined
  const project = edit.type === "project" ? content.projects.find((item) => item.id === edit.id) : undefined
  const link = edit.type === "link" ? content.links.find((item) => item.id === edit.id) : undefined
  const projectAssignments = new Map(
    content.sectionProjects.filter((item) => item.project_id === project?.id).map((item) => [item.section_id, item.sort_order])
  )
  const sectionTitles = new Map(content.sections.map((item) => [item.id, item.title || item.key]))
  const projectTitles = new Map(content.projects.map((item) => [item.id, item.title]))

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Developer Link Hub</p>
          <h1 className="text-lg font-medium">Tartalomkezelés</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/link-hub" />}>
            <RiArrowLeftLine data-icon="inline-start" />
            Link Hub analitika
          </Button>
          <form method="post" action="/api/cms/deploy">
            <input type="hidden" name="action" value="deploy" />
            <Button type="submit"><RiSendPlane2Line data-icon="inline-start" />Publikálás és build</Button>
          </form>
          <Separator orientation="vertical" className="h-6" />
          <form method="post" action="/api/logout">
            <Button type="submit" variant="ghost"><RiLogoutBoxRLine data-icon="inline-start" />Kijelentkezés</Button>
          </form>
        </div>
      </header>

      <CmsFeedbackToast notice={params.notice} error={params.error} />

      <ProfileForm profile={content.profile} />

      <Separator />
      {edit.type === "section" ? <SectionForm section={section} /> : null}
      {edit.type === "project" ? <ProjectForm project={project} sections={content.sections} assignments={projectAssignments} /> : null}
      {edit.type === "link" ? <LinkForm link={link} sections={content.sections} projects={content.projects} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Szekciók</CardTitle>
          <CardDescription>A szekciók <code>sort_order</code> szerint jelennek meg. Az üres szekciókat a Link Hub nem rendereli.</CardDescription>
          <CardAction><Button nativeButton={false} render={<Link href="/cms?edit=section:new" />}><RiAddLine data-icon="inline-start" />Új szekció</Button></CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Cím</TableHead><TableHead>Típus</TableHead><TableHead>Sorrend</TableHead><TableHead>Státusz</TableHead><TableHead>Művelet</TableHead></TableRow></TableHeader>
            <TableBody>
              {content.sections.map((item) => <TableRow key={item.id}><TableCell>{item.title || item.key}<div className="text-xs text-muted-foreground">{item.key}</div></TableCell><TableCell>{item.section_type}</TableCell><TableCell>{item.sort_order}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell><RecordActions type="section" id={item.id} /></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projektek</CardTitle>
          <CardDescription>Egy projekt több szekcióban is megjelenhet, külön sorrenddel.</CardDescription>
          <CardAction><Button nativeButton={false} render={<Link href="/cms?edit=project:new" />}><RiAddLine data-icon="inline-start" />Új projekt</Button></CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Projekt</TableHead><TableHead>Szekciók</TableHead><TableHead>Státusz</TableHead><TableHead>Művelet</TableHead></TableRow></TableHeader>
            <TableBody>
              {content.projects.map((item) => <TableRow key={item.id}><TableCell>{item.title}<div className="text-xs text-muted-foreground">{item.slug}</div></TableCell><TableCell>{content.sectionProjects.filter((relation) => relation.project_id === item.id).map((relation) => sectionTitles.get(relation.section_id)).filter(Boolean).join(", ") || "—"}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell><RecordActions type="project" id={item.id} /></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linkek</CardTitle>
          <CardDescription>A trackelt linkek a publikus oldalon <code>/go/slug</code> útvonalat kapnak.</CardDescription>
          <CardAction><Button nativeButton={false} render={<Link href="/cms?edit=link:new" />}><RiAddLine data-icon="inline-start" />Új link</Button></CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Link</TableHead><TableHead>Szülő</TableHead><TableHead>Sorrend</TableHead><TableHead>Státusz</TableHead><TableHead>Művelet</TableHead></TableRow></TableHeader>
            <TableBody>
              {content.links.map((item) => <TableRow key={item.id}><TableCell>{item.label}<div className="max-w-64 truncate text-xs text-muted-foreground">{item.trackable ? `/go/${item.redirect_slug || "—"}` : item.target_url}</div></TableCell><TableCell>{item.section_id ? sectionTitles.get(item.section_id) : item.project_id ? projectTitles.get(item.project_id) : "—"}</TableCell><TableCell>{item.sort_order}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell><TableCell><RecordActions type="link" id={item.id} /></TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter><Button variant="outline" nativeButton={false} render={<Link href="https://app.netlify.com" target="_blank" />}><RiExternalLinkLine data-icon="inline-start" />Netlify deployek</Button></CardFooter>
      </Card>
    </main>
  )
}
