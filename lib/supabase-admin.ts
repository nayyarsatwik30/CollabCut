import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    // Next.js patches global fetch to cache GET requests by default in
    // Route Handlers. supabase-js issues its REST calls via fetch, so
    // without this every query here gets frozen at whatever it first
    // returned instead of hitting the DB on each call.
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
})