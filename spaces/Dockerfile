# Build stage for client
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy server files
COPY server/package*.json ./
RUN npm install --production

COPY server/src ./src

# Copy built client files
COPY --from=client-build /app/client/dist ./public

# Create generated directory for project outputs
RUN mkdir -p generated

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "src/index.js"]
