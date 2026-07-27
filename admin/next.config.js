import path from "node:path";
import { config } from "dotenv";

// This app's own env vars live in the monorepo root .env, not admin/.env
// (which Next.js would load automatically but doesn't exist here).
config({ path: path.resolve(import.meta.dirname, "../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
