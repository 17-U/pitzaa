import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Le .env canonique vit à la racine du monorepo (voir apps/api) ; on le charge ici
// pour que NEXT_PUBLIC_API_BASE_URL et consorts soient disponibles avant la build.
config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
