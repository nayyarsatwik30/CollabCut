export const MAX_RAW_FILE_BYTES = 750 * 1024 * 1024

// Pure helpers (no Node imports) shared by the raw-upload API routes and the
// Raw Files UI. The kind of a file is never stored: it is derived from the
// extension (and the MIME type the browser reported), so no schema change is
// needed and old rows classify the same way as new ones.

export type RawFileKind = 'video' | 'audio' | 'photo' | 'other'

const VIDEO_EXT: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', mkv: 'video/x-matroska', webm: 'video/webm',
  avi: 'video/x-msvideo', mxf: 'application/mxf', mts: 'video/mp2t', m2ts: 'video/mp2t', mpg: 'video/mpeg',
  mpeg: 'video/mpeg', r3d: 'application/octet-stream', braw: 'application/octet-stream',
}
const AUDIO_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg',
  oga: 'audio/ogg', opus: 'audio/ogg', aif: 'audio/aiff', aiff: 'audio/aiff', wma: 'audio/x-ms-wma',
}
const PHOTO_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp',
  // Camera RAW: archived as photos but the browser cannot render them.
  dng: 'image/x-adobe-dng', cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3', nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw', raf: 'image/x-fuji-raf', orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2',
}

// Photo extensions a browser can draw in an <img>.
export const BROWSER_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp'])
// Audio extensions a browser <audio> element can generally play.
export const BROWSER_AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus'])

// Never accepted: would be active content if ever opened from storage.
const BLOCKED_EXT = new Set(['html', 'htm', 'xhtml', 'svg', 'svgz', 'js', 'mjs', 'exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'php', 'jsp'])

const AMBIGUOUS_EXT = new Set(['mp4', 'webm', 'ogg', 'm4a'])

export function fileExtension(name: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

function kindFromExtension(ext: string): RawFileKind {
  if (ext in VIDEO_EXT) return 'video'
  if (ext in AUDIO_EXT) return 'audio'
  if (ext in PHOTO_EXT) return 'photo'
  return 'other'
}

function kindFromMime(mime: string | null | undefined): RawFileKind | null {
  const m = (mime ?? '').toLowerCase()
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('image/')) return 'photo'
  return null
}

// Extension wins; the MIME type is only a fallback for extension-less or
// unknown-extension names.
export function classifyRawFile(fileName: string, contentType?: string | null): RawFileKind {
  const ext = fileExtension(fileName)
  const byExt = kindFromExtension(ext)
  const byMime = kindFromMime(contentType)
  // Containers that can hold either (audio-only .webm, video .ogg...) follow
  // the reported MIME type.
  if (AMBIGUOUS_EXT.has(ext) && (byMime === 'audio' || byMime === 'video')) return byMime
  if (byExt !== 'other') return byExt
  return byMime ?? 'other'
}

export type RawFileCheck = { ok: true; kind: RawFileKind; contentType: string } | { ok: false; error: string }

// Server-side gate for initiate. Files of unknown type are still archived
// (the section was always a catch-all), but a name/MIME that disagree about
// audio vs photo vs video, or an active-content extension, are refused.
export function validateRawFile(fileName: string, reportedType: unknown): RawFileCheck {
  const ext = fileExtension(fileName)
  if (BLOCKED_EXT.has(ext)) return { ok: false, error: `.${ext} files can't be uploaded.` }

  const extKind = kindFromExtension(ext)
  const reported = typeof reportedType === 'string' ? reportedType.trim().toLowerCase() : ''
  const mimeKind = kindFromMime(reported)

  // Browsers report '' or application/octet-stream for formats they don't
  // know (.heic, .mxf, .flac on some OSes): trust the extension then.
  if (extKind !== 'other' && mimeKind && mimeKind !== extKind) {
    // A few containers are legitimately audio-or-video (.mp4/.webm/.ogg/.m4a).
    if (!(AMBIGUOUS_EXT.has(ext) && (mimeKind === 'audio' || mimeKind === 'video'))) {
      return { ok: false, error: `"${fileName}" looks like a ${extKind} file but was sent as ${mimeKind}.` }
    }
  }

  // Active content is refused outright, whatever the extension says.
  if (/^(text\/(html|xml|javascript|x-javascript|ecmascript)|application\/(xml|xhtml|javascript|x-javascript|ecmascript)|image\/svg|[\w.+-]+\/[\w.+-]*\+xml)/.test(reported)) {
    return { ok: false, error: `"${fileName}" has a file type that can't be uploaded.` }
  }

  // The client-reported MIME is never stored: Content-Type comes from the
  // extension (audio/video split for ambiguous containers), else octet-stream.
  const kind = classifyRawFile(fileName, reported)
  return { ok: true, kind, contentType: canonicalContentType(fileName, kind) }
}

const AMBIGUOUS_MIME: Record<string, { audio: string; video: string }> = {
  mp4: { audio: 'audio/mp4', video: 'video/mp4' },
  m4a: { audio: 'audio/mp4', video: 'video/mp4' },
  webm: { audio: 'audio/webm', video: 'video/webm' },
  ogg: { audio: 'audio/ogg', video: 'video/ogg' },
}

export function canonicalContentType(fileName: string, kind?: RawFileKind): string {
  const ext = fileExtension(fileName)
  const amb = AMBIGUOUS_MIME[ext]
  if (amb && (kind === 'audio' || kind === 'video')) return amb[kind]
  return VIDEO_EXT[ext] ?? AUDIO_EXT[ext] ?? PHOTO_EXT[ext] ?? 'application/octet-stream'
}

// Whether the browser can show/play this file inline.
export function canPreviewRawFile(fileName: string, kind: RawFileKind): boolean {
  const ext = fileExtension(fileName)
  return (kind === 'photo' && BROWSER_IMAGE_EXT.has(ext)) || (kind === 'audio' && BROWSER_AUDIO_EXT.has(ext))
}

// Leading-bytes check for formats with an unambiguous signature, so a renamed
// non-image can't sit in the Photos column. Returns null for formats we don't
// sniff (treated as fine).
export function matchesSignature(fileName: string, head: Uint8Array): boolean | null {
  const ext = fileExtension(fileName)
  const at = (i: number, s: string) => s.split('').every((c, k) => head[i + k] === c.charCodeAt(0))
  switch (ext) {
    case 'jpg': case 'jpeg': return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case 'png': return head[0] === 0x89 && at(1, 'PNG')
    case 'gif': return at(0, 'GIF8')
    case 'webp': return at(0, 'RIFF') && at(8, 'WEBP')
    case 'wav': return at(0, 'RIFF') && at(8, 'WAVE')
    case 'flac': return at(0, 'fLaC')
    case 'ogg': case 'oga': case 'opus': return at(0, 'OggS')
    default: return null
  }
}
