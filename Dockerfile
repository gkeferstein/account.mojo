# ========================================
# accounts.mojo - Production Dockerfile
# Multi-stage build for Next.js standalone
# Build from /root/projects context
# ========================================

# Base image
FROM node:22-slim AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files from web app
COPY accounts.mojo/apps/web/package.json ./package.json

# Note: @gkeferstein/design will be installed via npm install
# Ensure .npmrc is configured with GitHub Packages token before this step
# Install dependencies (including @gkeferstein/design from GitHub Packages)
RUN npm install --legacy-peer-deps

# Builder stage
FROM base AS builder

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy web app source
COPY accounts.mojo/apps/web/ ./

# Build arguments for environment
ARG NEXT_PUBLIC_API_URL=https://dev.account.mojo-institut.de/api
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PAYMENTS_API_URL=https://payments.mojo-institut.de/api

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_PAYMENTS_API_URL=${NEXT_PUBLIC_PAYMENTS_API_URL}

# Build the Next.js app
RUN npm run build

# Production runner stage
FROM base AS runner

# Install wget for healthcheck
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3020

ENV PORT=3020
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "server.js"]
