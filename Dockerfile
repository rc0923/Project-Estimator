# Dockerfile — Radiant Toolkit Estimator
# Multi-stage: install deps in builder, copy only what's needed to final image.

# ── STAGE 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install production deps only
COPY package.json ./
RUN npm install --omit=dev


# ── STAGE 2: final image ──────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy installed node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY server.js  ./
COPY db.js      ./
COPY package.json ./

# Copy static frontend files into /app/public
COPY public/ ./public/

# The SQLite database will be stored in /app/data
# Mount a volume here to persist data outside the container
VOLUME ["/app/data"]

ENV PORT=3000
ENV DB_PATH=/app/data/radiant.db

EXPOSE 3000

CMD ["node", "server.js"]
