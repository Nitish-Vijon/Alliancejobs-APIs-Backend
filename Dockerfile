# Use official Node.js LTS image
FROM node:18-alpine

WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Run built code
CMD ["node", "dist/index.js"]
