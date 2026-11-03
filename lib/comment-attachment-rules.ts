// Pure rules shared by the browser (pre-flight checks) and the API routes
// (enforcement). No server imports here - this file is bundled client-side.

export const MAX_COMMENT_ATTACHMENT_BYTES = 250 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_COMMENT = 3

// Allowed by extension; the stored content type comes from this map, never
// from the client. SVG/HTML are deliberately absent (script-capable).
const EXT_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', heic: 'image/heic',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg',
  pdf: 'application/pdf', txt: 'text/plain',
}

export const ATTACHMENT_ACCEPT = Object.keys(EXT_TYPES).map((e) => `.${e}`).join(',')

export function attachmentContentType(fileName: string): string | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return Object.prototype.hasOwnProperty.call(EXT_TYPES, ext) ? EXT_TYPES[ext] : null
}

// Safe to render inline in the browser (preview); everything else downloads.
export function isInlineSafe(contentType: string | null): boolean {
  return !!contentType && /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|wav|mp4|aac|ogg|flac))$/.test(contentType)
}

