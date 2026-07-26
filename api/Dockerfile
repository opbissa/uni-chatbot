FROM node:22-slim

WORKDIR /app
COPY tsconfig.base.json ./
COPY api/package.json api/package-lock.json* ./api/
RUN npm install --prefix api
COPY api/tsconfig.json ./api/
COPY api/src ./api/src
RUN npm run build --prefix api

WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/index.js"]
