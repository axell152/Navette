/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs tente de charger "canvas" côté Node : inutile ici (tout se passe dans le navigateur)
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
