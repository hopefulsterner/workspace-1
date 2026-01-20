# Backend Dockerfile - NestJS + gRPC
FROM node:20-alpine AS base

# Install dependencies for node-pty, OpenSSL, and gRPC
RUN apk add --no-cache python3 make g++ bash openssl openssl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY nest-cli.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

# Generate Prisma Client
RUN npx prisma generate

# Copy source files (both legacy Express and new NestJS)
COPY src ./src
COPY nest-src ./nest-src
COPY tsconfig*.json ./

# Build NestJS
RUN npm run build

# Production stage
FROM node:20-alpine AS production

RUN apk add --no-cache bash openssl

WORKDIR /app

# Copy built files
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/nest-cli.json ./

# Copy proto files for gRPC
COPY --from=base /app/nest-src/grpc/protos ./dist/nest-src/grpc/protos

# Create logs directory
RUN mkdir -p logs

# Environment
ENV NODE_ENV=production
ENV PORT=4000
ENV GRPC_URL=0.0.0.0:50051

# Expose HTTP and gRPC ports
EXPOSE 4000
EXPOSE 50051

# Run migrations and start NestJS
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/nest-src/main.js"]
