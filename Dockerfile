FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./

# Install both production and development dependencies (needed for react-scripts build)
RUN npm install

# Copy the rest of the application
COPY . .

# Build the React frontend (this outputs to /app/build)
RUN npm run build

# Expose the backend port
EXPOSE 5001

# Set production environment variable
ENV NODE_ENV=production
ENV PORT=5001

# Docker native healthcheck to monitor container status
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5001/health || exit 1

# Start the Node backend, which will serve the frontend build
CMD ["node", "server/index.js"]
