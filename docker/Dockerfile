# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./

# Production image with Node.js and PostgreSQL
FROM node:20-alpine

# Install PostgreSQL and supervisord
RUN apk add --no-cache postgresql postgresql-contrib supervisor

# Create app directory
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend ./backend

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Docker-specific files
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create PostgreSQL data directory and Noteer data directory
RUN mkdir -p /var/lib/postgresql/data && \
    chown -R postgres:postgres /var/lib/postgresql && \
    mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql && \
    mkdir -p /var/lib/noteer

# Create log directory
RUN mkdir -p /var/log/supervisor

# Environment variables with defaults (JWT_SECRET auto-generated if not set)
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=postgresql://noteer:noteer@localhost:5432/noteer \
    REGISTRATION_ENABLED=true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
