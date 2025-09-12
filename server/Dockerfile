FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Healthcheck script will run inside container before node starts
CMD ["/bin/sh", "-c", "node ./scripts/check-redis.js || true; node dist/index.js"]
