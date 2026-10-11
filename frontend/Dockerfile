# CredX web (Next.js standalone server).  Build context: frontend/
#   docker build -t credx-web frontend
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# Set to "true" to ship the self-contained demo (in-browser mock API, no backend needed).
ARG NEXT_PUBLIC_DEMO_MODE=false
# Next bakes rewrites into the build, so the API origin that /api/v1/* proxies to is a build argument.
ARG BACKEND_URL=http://api:8000
ENV NEXT_PUBLIC_DEMO_MODE=${NEXT_PUBLIC_DEMO_MODE} BACKEND_URL=${BACKEND_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S credx && adduser -S credx -G credx
COPY --from=build --chown=credx:credx /app/.next/standalone ./
COPY --from=build --chown=credx:credx /app/.next/static ./.next/static
COPY --from=build --chown=credx:credx /app/public ./public
USER credx
EXPOSE 3000
CMD ["node", "server.js"]
