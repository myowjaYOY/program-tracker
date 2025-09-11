import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: true,
  },
  // Reduce CSS preload warnings in development
  webpack: (config, { dev }) => {
    if (dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            styles: {
              name: 'styles',
              test: /\.(css|scss)$/,
              chunks: 'all',
              enforce: true,
            },
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
