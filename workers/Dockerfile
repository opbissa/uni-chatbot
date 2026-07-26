# Uses the Playwright base image so Crawlee's browser crawling works
# out of the box (bundles Chromium + system deps).
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app
COPY tsconfig.base.json ./
COPY workers/package.json workers/package-lock.json* ./workers/
RUN npm install --prefix workers
COPY workers/tsconfig.json ./workers/
COPY workers/src ./workers/src
RUN npm run build --prefix workers

WORKDIR /app/workers
CMD ["node", "dist/index.js"]
