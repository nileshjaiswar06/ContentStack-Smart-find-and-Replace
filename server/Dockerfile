FROM node:20-alpine

WORKDIR /usr/src/app

# Install build dependencies and production deps separately to avoid copying local node_modules
COPY package*.json ./
RUN npm ci

# Copy source code (after installing deps) - avoids pulling host node_modules into image
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies for smaller runtime image
RUN npm prune --production

# Expose port
EXPOSE 3001

# Ensure check script exists before running. The script logs Redis connectivity and does not error on failure.
CMD ["/bin/sh", "-c", "[ -f ./scripts/check-redis.js ] && node ./scripts/check-redis.js || echo 'check-redis.js not found, skipping'; node dist/index.js"]
