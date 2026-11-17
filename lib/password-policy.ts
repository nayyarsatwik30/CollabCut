// Single source of truth for the account-password rules. The server routes
// (signup, reset) enforce it; the signup and reset forms import the same list
// for their live checklist, so the two can't drift.
//
// Not applied at login (authOptions authorize): accounts created before this
// policy keep working with their existing passwords.
//
// Built with the RegExp constructor because tsconfig targets ES2017, where a
// \p{...} regex literal is a compile error; the runtime (Node, modern
// browsers) supports it.

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 64

const UPPERCASE = new RegExp('\\p{Lu}', 'u')
const LOWERCASE = new RegExp('\\p{Ll}', 'u')
const DIGIT = new RegExp('\\p{Nd}', 'u')
// Anything that is not a letter, a digit or whitespace.
const SPECIAL = new RegExp('[^\\p{L}\\p{N}\\s]', 'u')
const WHITESPACE = /\s/

export type PasswordRule = { id: string; label: string; test: (pw: string) => boolean }

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'min-length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'max-length', label: `At most ${PASSWORD_MAX_LENGTH} characters`, test: (pw) => pw.length <= PASSWORD_MAX_LENGTH },
  { id: 'uppercase', label: 'An uppercase letter', test: (pw) => UPPERCASE.test(pw) },
  { id: 'lowercase', label: 'A lowercase letter', test: (pw) => LOWERCASE.test(pw) },
  { id: 'digit', label: 'A number', test: (pw) => DIGIT.test(pw) },
  { id: 'special', label: 'A special character (not a letter, number or space)', test: (pw) => SPECIAL.test(pw) },
  { id: 'no-whitespace', label: 'No spaces', test: (pw) => !WHITESPACE.test(pw) },
]

// Labels of the rules `pw` fails; an empty array means the password is valid.
export function validatePassword(pw: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(pw)).map((rule) => rule.label)
}
