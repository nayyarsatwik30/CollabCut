require('dotenv').config({ path: '.env.migration', quiet: true })

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['image.mux.com', 'stream.mux.com'],
  },
}

module.exports = nextConfig
