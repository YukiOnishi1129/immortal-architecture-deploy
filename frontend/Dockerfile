# =============================================================================
# Frontend Dockerfile for Cloud Run
# Multi-stage build for Next.js (standalone output)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2: Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables needed at build time
# These are public variables that get embedded in the client bundle
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Build the application
# Note: Database connection is NOT needed at build time for Next.js
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 3: Runtime
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# standalone output includes all necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy drizzle migrations for Cloud Build migration step
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/external/client/database ./src/external/client/database
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Cloud Run uses PORT environment variable (default 3000 for Next.js)
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Switch to non-root user
USER nextjs

# Start the server
CMD ["node", "server.js"]
