export type ProfileUrlKind =
  | 'github_url'
  | 'linkedin_url'
  | 'instagram_url'
  | 'website_url'

const SOCIAL_HOSTS: Record<Exclude<ProfileUrlKind, 'website_url'>, string[]> = {
  github_url: ['github.com', 'www.github.com'],
  linkedin_url: ['linkedin.com', 'www.linkedin.com'],
  instagram_url: ['instagram.com', 'www.instagram.com'],
}

function parseHttpsUrl(value?: string | null): URL | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 200) return null

  // Reject an explicit non-HTTP(S) scheme before adding a default scheme.
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed) && !/^https:\/\//i.test(trimmed)) {
    return null
  }

  const candidate = /^https:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function normalizeProfileUrl(
  value?: string | null,
  kind: ProfileUrlKind = 'website_url'
): string {
  const parsed = parseHttpsUrl(value)
  if (!parsed) return ''

  if (kind !== 'website_url') {
    const allowedHosts = SOCIAL_HOSTS[kind]
    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) return ''
  }

  return parsed.toString()
}

export function normalizeExternalHttpsUrl(value?: string | null): string {
  const parsed = parseHttpsUrl(value)
  return parsed?.toString() || ''
}

export function isAllowedAttachmentFileUrl(value?: string | null): boolean {
  const normalized = normalizeExternalHttpsUrl(value)
  if (!normalized) return false

  const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!configuredSupabaseUrl) return false

  try {
    const attachmentUrl = new URL(normalized)
    const supabaseUrl = new URL(configuredSupabaseUrl)
    return (
      attachmentUrl.hostname === supabaseUrl.hostname &&
      attachmentUrl.pathname.startsWith('/storage/v1/object/')
    )
  } catch {
    return false
  }
}

export function validateAttachments(value: unknown): string | null {
  if (value == null) return null
  if (!Array.isArray(value)) return 'Attachments harus berupa daftar URL yang valid.'

  for (const attachment of value) {
    if (!attachment || typeof attachment !== 'object') {
      return 'Format attachment tidak valid.'
    }

    const item = attachment as { name?: unknown; url?: unknown; type?: unknown }
    if (
      typeof item.name !== 'string' ||
      item.name.length > 200 ||
      typeof item.url !== 'string' ||
      item.url.length > 2048 ||
      (item.type !== 'file' && item.type !== 'link')
    ) {
      return 'Format attachment tidak valid.'
    }

    const validUrl = item.type === 'file'
      ? isAllowedAttachmentFileUrl(item.url)
      : Boolean(normalizeExternalHttpsUrl(item.url))
    if (!validUrl) {
      return item.type === 'file'
        ? 'File attachment harus berasal dari storage Supabase proyek ini.'
        : 'Link attachment harus menggunakan URL HTTPS yang valid.'
    }
  }

  return null
}
