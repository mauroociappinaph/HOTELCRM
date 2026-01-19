# ===========================================
# Multi-stage Docker build for HOTELCRM Auth Service
# ===========================================

# ===========================================
# BUILD STAGE
# ===========================================
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY pnpm-lock.yaml package.json ./
COPY apps/auth-service/package.json ./apps/auth-service/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared packages first
RUN pnpm --filter @hotel-crm/shared build

# Build auth-service
RUN pnpm --filter @hotel-crm/auth-service build

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
RUN adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Change ownership of the working directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Copy package files
COPY --chown=nestjs:nodejs pnpm-lock.yaml package.json ./
COPY --chown=nestjs:nodejs apps/auth-service/package.json ./apps/auth-service/
COPY --chown=nestjs:nodejs packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --chown=nestjs:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=nestjs:nodejs --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist

# Copy migration files (if needed for startup)
COPY --chown=nestjs:nodejs supabase/migrations ./supabase/migrations

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/auth-service/dist/main.js"]
