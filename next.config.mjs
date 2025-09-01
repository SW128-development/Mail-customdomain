/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Mitigate WasmHash._updateWithBuffer length error by disabling realContentHash
    if (!config.optimization) config.optimization = {}
    config.optimization.realContentHash = false

    // Ensure a stable hashFunction (fallback for environments with wasm hashing issues)
    config.output = config.output || {}
    config.output.hashFunction = 'xxhash64'

    return config
  }
}

export default nextConfig
