import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 64

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

// Unused until the public /r/[token] page verifies a visitor-entered
// password against this - kept alongside hashSharePassword rather than
// splitting the pair across two commits.
export function verifySharePassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const candidate = scryptSync(password, salt, hashBuffer.length)
  return hashBuffer.length === candidate.length && timingSafeEqual(hashBuffer, candidate)
}
