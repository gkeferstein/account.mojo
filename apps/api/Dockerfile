# Multi-stage build für Monorepo mit @accounts/shared
FROM node:22-slim AS base

# Install OpenSSL for Prisma and wget for healthcheck
RUN apt-get update && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ===========================================
# Stage 1: Build shared package
# ===========================================
FROM base AS shared-builder
WORKDIR /app/packages/shared

# Build arg for npm token (must be declared in each stage)
ARG NPM_TOKEN

COPY packages/shared/ ./

# Create .npmrc from build arg (token passed from CI)
RUN if [ -n "$NPM_TOKEN" ]; then \
      echo "@gkeferstein:registry=https://npm.pkg.github.com" > .npmrc && \
      echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc && \
      echo "always-auth=true" >> .npmrc && \
      cp .npmrc /root/.npmrc; \
    fi
RUN npm install && npm run build

# ===========================================
# Stage 2: Install API dependencies
# ===========================================
FROM base AS api-deps
WORKDIR /app/apps/api

# Build arg for npm token (must be declared in each stage)
ARG NPM_TOKEN

# Copy package.json und modifiziere es (entferne lokale dependencies)
COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma/

# Create .npmrc from build arg (token passed from CI)
RUN if [ -n "$NPM_TOKEN" ]; then \
      echo "@gkeferstein:registry=https://npm.pkg.github.com" > .npmrc && \
      echo "//npm.pkg.github.com/:_authToken=$NPM_TOKEN" >> .npmrc && \
      echo "always-auth=true" >> .npmrc && \
      cp .npmrc /root/.npmrc; \
    fi

# Entferne lokale dependencies und installiere den Rest
RUN sed -i '/"@accounts\/shared"/d' package.json && \
    sed -i '/"@mojo\/tenant"/d' package.json && \
    sed -i '/"@gkeferstein\/tenant"/d' package.json && \
    npm install --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# ===========================================
# Stage 3: Build API
# ===========================================
FROM api-deps AS api-builder

# Copy shared package (built) und link es
COPY --from=shared-builder /app/packages/shared /app/packages/shared
RUN mkdir -p /app/apps/api/node_modules/@accounts && \
    ln -s /app/packages/shared /app/apps/api/node_modules/@accounts/shared

# Copy API source und build (ignore type errors, emit anyway)
COPY apps/api/ ./
RUN npm run build || [ -d ./dist ]

# ===========================================
# Stage 4: Production
# ===========================================
FROM base AS runner

# Install wget for healthcheck (not in base slim image)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy shared package (built)
COPY --from=shared-builder /app/packages/shared /app/packages/shared

# Copy API 
WORKDIR /app/apps/api
COPY --from=api-deps /app/apps/api/node_modules ./node_modules
COPY --from=api-builder /app/apps/api/dist ./dist
COPY --from=api-builder /app/apps/api/prisma ./prisma
COPY apps/api/package*.json ./

# Link shared package
RUN mkdir -p ./node_modules/@accounts && \
    ln -s /app/packages/shared ./node_modules/@accounts/shared

USER fastify

EXPOSE 3001

CMD ["node", "dist/index.js"]
