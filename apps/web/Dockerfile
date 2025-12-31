FROM node:22-slim AS base
WORKDIR /app

# Install dependencies
FROM base AS deps

# Copy package.json
COPY apps/web/package.json ./

# Create .npmrc from build arg (token passed from CI)
ARG NPM_TOKEN
RUN if [ -n "$NPM_TOKEN" ]; then \
      echo "@gkeferstein:registry=https://npm.pkg.github.com" > .npmrc && \
      echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc && \
      echo "always-auth=true" >> .npmrc && \
      cp .npmrc /root/.npmrc; \
    fi

# Remove @mojo/design from package.json so npm install doesn't fail
RUN sed -i '/@mojo\/design/d' package.json

# Install other dependencies
RUN npm install --legacy-peer-deps

# Note: @mojo/design is removed from package.json above
# If design.mojo is available, it will be copied in the build step

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/ .

# Build-time environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PAYMENTS_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_PAYMENTS_API_URL=${NEXT_PUBLIC_PAYMENTS_API_URL}

RUN npm run build

# Production
FROM base AS runner

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
