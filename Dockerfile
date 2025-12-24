# ============================================
# Buggy Shuttle - Production Dockerfile
# Multi-stage build for SvelteKit + Node.js
# ============================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./

# Clean install with legacy peer deps support
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Clear any cached build artifacts
RUN rm -rf .svelte-kit build

# Set dummy DATABASE_URL for build (actual value comes from runtime env)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/buggy_shuttle"

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

# Copy built application
COPY --from=builder --chown=sveltekit:nodejs /app/build ./build
COPY --from=builder --chown=sveltekit:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=sveltekit:nodejs /app/package.json ./

# Copy drizzle migrations (if any)
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=sveltekit:nodejs /app/drizzle.config.ts ./

# Copy static files
COPY --from=builder --chown=sveltekit:nodejs /app/static ./static

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Switch to non-root user
USER sveltekit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "build"]
