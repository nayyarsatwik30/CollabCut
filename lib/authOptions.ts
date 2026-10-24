import { randomBytes } from 'crypto'
import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { migrationDb } from './migrationDb'
import { verifyPassword } from './password'

// Thrown from authorize() for a correct password on an unverified account;
// signIn(..., { redirect: false }) surfaces it as result.error, which the
// login page maps to a "please verify your email" message + resend button.
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED'

type SessionToken = { id?: string; sessionToken?: string; valid?: boolean }

export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const normalizedEmail = credentials.email.trim().toLowerCase()
        const result = await migrationDb.query(
          `SELECT p.id, p.name, p.email, a.password_hash, a.email_verified_at
           FROM auth_credentials a
           JOIN profiles p ON p.id = a.id
           WHERE a.email = $1`,
          [normalizedEmail]
        )
        const user = result.rows[0]
        if (!user) return null
        const valid = await verifyPassword(credentials.password, user.password_hash)
        if (!valid) return null
        // Checked only after the password matches, so the error can't be used
        // to probe which emails have accounts.
        if (!user.email_verified_at) throw new Error(EMAIL_NOT_VERIFIED)

        // Single active session: a fresh token per login replaces whatever
        // was stored, so every JWT carrying the previous token fails the
        // check in the jwt callback on its next request.
        const sessionToken = randomBytes(32).toString('base64url')
        await migrationDb.query(
          `UPDATE auth_credentials SET current_session_token = $1 WHERE id = $2`,
          [sessionToken, user.id]
        )
        return { id: user.id, name: user.name, email: user.email, sessionToken } as { id: string }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as typeof token & SessionToken
      if (user) {
        t.id = user.id
        t.sessionToken = (user as { sessionToken?: string }).sessionToken
        t.valid = true
        return t
      }
      // Client calls next-auth/react's update({ name }) after a profile
      // rename (see settings.tsx saveChanges) so every mounted component
      // reading session.user.name picks up the change without forcing a
      // re-login - JWT sessions don't live-update like Supabase's did.
      if (trigger === 'update' && session?.name) token.name = session.name

      // Runs on every request that reads the session (useSession polling and
      // every requireAuth -> getServerSession), so a login elsewhere
      // invalidates this JWT on its very next request. `valid` is recomputed
      // each time rather than latched: a transient DB error fails this one
      // request closed without destroying a session that is still the
      // current one (throwing here would make next-auth clear the cookie).
      // JWTs issued before this check existed have no sessionToken and are
      // rejected, i.e. everyone signs in once more after the deploy.
      try {
        const result = await migrationDb.query(
          `SELECT current_session_token FROM auth_credentials WHERE id = $1`,
          [t.id]
        )
        const current = result.rows[0]?.current_session_token as string | null | undefined
        t.valid = !!t.sessionToken && !!current && current === t.sessionToken
      } catch (err) {
        console.error('session validity check failed', err)
        t.valid = false
      }
      return t
    },
    async session({ session, token }) {
      // A revoked/invalid session is returned without a user and flagged, so
      // requireAuth 401s (with X-Auth-Reason) and AuthProvider sends the
      // client to the login page with the "logged in elsewhere" message.
      if ((token as SessionToken).valid !== true) {
        return { expires: session.expires, invalid: true } as typeof session
      }
      if (session.user) (session.user as { id?: string }).id = token.id as string
      return session
    },
  },
  pages: { signIn: '/auth/login' },
}
