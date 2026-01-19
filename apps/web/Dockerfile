# ===========================================
# Multi-stage Docker build for HOTELCRM Web App
# ===========================================

# ===========================================
# BUILDER STAGE
# ===========================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY pnpm-lock.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared packages first
RUN pnpm --filter @hotel-crm/shared build

# Build web application
RUN pnpm --filter @hotel-crm/web build

# ===========================================
# PRODUCTION STAGE
# ===========================================
FROM node:20-alpine AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Change ownership of the working directory
RUN chown -R nextjs:nodejs /app
USER nextjs

# Copy package files
COPY --chown=nextjs:nodejs pnpm-lock.yaml package.json ./
COPY --chown=nextjs:nodejs apps/web/package.json ./apps/web/
COPY --chown=nextjs:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --chown=nextjs:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=nextjs:nodejs --from=builder /app/apps/web/.next ./apps/web/.next
COPY --chown=nextjs:nodejs --from=builder /app/apps/web/public ./apps/web/public
COPY --chown=nextjs:nodejs --from=builder /app/apps/web/package.json ./apps/web/package.json

# Copy Next.js config and other necessary files
COPY --chown=nextjs:nodejs apps/web/next.config.ts ./apps/web/
COPY --chown=nextjs:nodejs apps/web/tsconfig.json ./apps/web/

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Set working directory to web app
WORKDIR /app/apps/web

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "start"]
