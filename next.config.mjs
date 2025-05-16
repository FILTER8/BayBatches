/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings
  // https://github.com/WalletConnect/walletconnect-monorepo/issues/1908
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  transpilePackages: ["geist"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-bd7c5d8a825145c691a3ad40196fd45c.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;