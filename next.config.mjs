/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['studio', 'ai-agent', 'workflow-builder'],
  // Brand website analysis uses Playwright only on the server. Keep it out of client bundles.
  serverExternalPackages: ['playwright', '@resvg/resvg-js', '@aws-sdk/client-s3'],
};

export default nextConfig;
