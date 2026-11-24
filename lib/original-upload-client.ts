// Browser half of an asset upload: sends the file to B2 in multipart chunks
// using presigned URLs, then asks the server to finish it (which hands the
// file to Mux server-to-server). The file leaves the browser exactly once.
//
// Built for very slow, flaky uplinks (~14-65 KB/s): parts go strictly one at
// a time, so there is only ever a single send loop; every part is retried on
// its own (a failed part is re-sent whole, never the file); a dropped
// connection pauses the upload until the browser is back online; and success
// is only reported after the server has confirmed every byte.

export class UploadCancelledError extends Error {
  constructor() { super('Upload cancelled') }
}

class UploadHttpError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

export const NO_CONNECTION_MESSAGE = 'Upload failed: no internet connection. Check your connection and try again.'
const DROPPED_MESSAGE = 'Upload failed: the connection kept dropping. Check your connection and try again.'
const STALLED_MESSAGE = 'Upload failed: the connection stopped sending data. Check your connection and try again.'

// A dead connection must end in a real error instead of a frozen progress bar.
const OFFLINE_GIVE_UP_MS = 60_000
// Progress counts bytes handed to the OS socket buffer, so on a slow uplink it
// can sit still while that buffer drains. 12 minutes = one 8 MB part at the
// slowest measured speed (~14 KB/s, ~9.8 minutes) plus headroom.
const STALL_GIVE_UP_MS = 12 * 60_000
const PART_ATTEMPTS = 10
const COMPLETE_ATTEMPTS = 5

export interface OriginalUploadSession {
  uploadToken: string
  partSize: number
  totalParts: number
}

interface Handlers {
  onProgress: (percent: number) => void
  onStatus: (message: string) => void
  signal?: AbortSignal
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new UploadCancelledError()
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new UploadCancelledError()); return }
    const onAbort = () => { clearTimeout(timer); reject(new UploadCancelledError()) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve() }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// Resolves at once when online; otherwise pauses until the browser reports it
// is back, and gives up after OFFLINE_GIVE_UP_MS.
function waitForOnline({ onStatus, signal }: Handlers): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve()
  onStatus('Connection lost - upload paused, it will resume automatically')
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener('online', onOnline)
      signal?.removeEventListener('abort', onAbort)
    }
    const onOnline = () => { cleanup(); onStatus('Connection restored - resuming upload'); resolve() }
    const onAbort = () => { cleanup(); reject(new UploadCancelledError()) }
    const timer = setTimeout(() => { cleanup(); reject(new Error(NO_CONNECTION_MESSAGE)) }, OFFLINE_GIVE_UP_MS)
    window.addEventListener('online', onOnline)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function postJson(path: string, body: object): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new UploadHttpError(DROPPED_MESSAGE)
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) {
    throw new UploadHttpError(typeof data.error === 'string' ? data.error : 'Upload failed. Please try again.', res.status)
  }
  return data
}

// One PUT straight to B2. No Authorization or custom headers: the presigned
// URL carries its own signature. Rejects with status 0 / undefined when the
// request never got a response (dropped connection, stall).
function putPart(url: string, blob: Blob, onLoaded: (bytes: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let stallTimer: ReturnType<typeof setTimeout> | undefined
    let stalled = false
    const done = () => { clearTimeout(stallTimer); signal?.removeEventListener('abort', onAbort) }
    const armStallTimer = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => { stalled = true; xhr.abort() }, STALL_GIVE_UP_MS)
    }
    const onAbort = () => xhr.abort()

    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => { onLoaded(e.loaded); armStallTimer() }
    xhr.onload = () => {
      done()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new UploadHttpError(`Part upload failed (${xhr.status})`, xhr.status))
    }
    xhr.onerror = () => { done(); reject(new UploadHttpError(DROPPED_MESSAGE)) }
    xhr.onabort = () => {
      done()
      reject(stalled ? new UploadHttpError(STALLED_MESSAGE) : new UploadCancelledError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    armStallTimer()
    xhr.send(blob)
  })
}

async function fetchPartUrl(uploadToken: string, partNumber: number): Promise<string> {
  const data = await postJson('/api/assets/original/part', { uploadToken, partNumbers: [partNumber] })
  const urls = data.urls as { partNumber: number; url: string }[] | undefined
  const url = urls?.find((u) => u.partNumber === partNumber)?.url
  if (!url) throw new UploadHttpError('Could not prepare the upload. Please try again.', 502)
  return url
}

// Transient: no response at all, timeouts, throttling and server errors.
const isRetryable = (status?: number) => status === undefined || status === 0 || status === 408 || status === 429 || status >= 500

async function uploadPart(file: File, session: OriginalUploadSession, partNumber: number, handlers: Handlers, onLoaded: (bytes: number) => void) {
  const start = (partNumber - 1) * session.partSize
  const blob = file.slice(start, Math.min(start + session.partSize, file.size))
  if (blob.size === 0) throw new Error('Upload failed: the file changed while uploading. Please try again.')

  let url: string | null = null
  for (let attempt = 1; ; attempt++) {
    throwIfCancelled(handlers.signal)
    await waitForOnline(handlers)
    let sending = false
    try {
      url ??= await fetchPartUrl(session.uploadToken, partNumber)
      sending = true
      await putPart(url, blob, onLoaded, handlers.signal)
      handlers.onStatus('')
      return
    } catch (err) {
      if (err instanceof UploadCancelledError) throw err
      const status = err instanceof UploadHttpError ? err.status : undefined
      // A 403 from B2 itself is an expired presigned URL: ask for a fresh one.
      const expiredUrl = sending && status === 403
      if (!isRetryable(status) && !expiredUrl) throw err
      if (attempt >= PART_ATTEMPTS) throw err
      onLoaded(0)
      if (expiredUrl) url = null
      handlers.onStatus(`Connection problem - retrying (${PART_ATTEMPTS - attempt} attempts left)`)
      await sleep(Math.min(3000 * attempt, 30_000), handlers.signal)
    }
  }
}

// Uploads every part, then finalizes. Resolves only once the server confirmed
// the whole file; rejects with UploadCancelledError when cancelled.
export async function uploadOriginal(file: File, session: OriginalUploadSession, handlers: Handlers): Promise<void> {
  const reportProgress = (bytes: number) => handlers.onProgress(Math.min(99, Math.floor((bytes / file.size) * 100)))

  let uploadedBytes = 0
  for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
    await uploadPart(file, session, partNumber, handlers, (loaded) => reportProgress(uploadedBytes + loaded))
    uploadedBytes += Math.min(session.partSize, file.size - (partNumber - 1) * session.partSize)
    reportProgress(uploadedBytes)
  }

  // A 502/409 (or a lost response) can mean the server is still finishing or
  // finished but we never heard back; completing again is always safe.
  for (let attempt = 1; ; attempt++) {
    throwIfCancelled(handlers.signal)
    await waitForOnline(handlers)
    try {
      await postJson('/api/assets/original/complete', { uploadToken: session.uploadToken })
      handlers.onProgress(100)
      return
    } catch (err) {
      const status = err instanceof UploadHttpError ? err.status : undefined
      const retryable = status === undefined || status === 409 || status >= 500
      if (!retryable || attempt >= COMPLETE_ATTEMPTS) throw err
      await sleep(2000 * attempt, handlers.signal)
    }
  }
}
