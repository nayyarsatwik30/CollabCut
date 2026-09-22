import Mux from '@mux/mux-node'

export const mux = new Mux({
  tokenId:     process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export const { video } = mux

// NEXT_PUBLIC_APP_URL is baked in at build time, so it's wrong on any
// deployment target it wasn't set for (e.g. Preview) - the browser's own
// Origin header is the actual origin the direct-to-Mux upload will come
// from, so it's the correct source of truth here. VERCEL_URL (a runtime env
// var Vercel sets on every deployment) and NEXT_PUBLIC_APP_URL are just
// fallbacks for requests that don't carry an Origin header.
export function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin')
  if (origin) return origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}