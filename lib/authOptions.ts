import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { migrationDb } from './migrationDb'
import { verifyPassword } from './password'

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
          `SELECT p.id, p.name, p.email, a.password_hash
           FROM auth_credentials a
           JOIN profiles p ON p.id = a.id
           WHERE a.email = $1`,
          [normalizedEmail]
        )
        const user = result.rows[0]
        if (!user) return null
        const valid = await verifyPassword(credentials.password, user.password_hash)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) token.id = user.id
      // Client calls next-auth/react's update({ name }) after a profile
      // rename (see settings.tsx saveChanges) so every mounted component
      // reading session.user.name picks up the change without forcing a
      // re-login - JWT sessions don't live-update like Supabase's did.
      if (trigger === 'update' && session?.name) token.name = session.name
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string
      return session
    },
  },
  pages: { signIn: '/auth/login' },
}
