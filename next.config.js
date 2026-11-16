require('dotenv').config({ path: '.env.migration', quiet: true })

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Iconoir ships ~1.5k icons; only the ones components/ui/icons.tsx imports are bundled.
  experimental: { optimizePackageImports: ['iconoir-react'] },
}

module.exports = nextConfig
