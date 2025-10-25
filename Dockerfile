# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist/kanni-poc /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Ensure assets directory exists and copy env.js
RUN mkdir -p /usr/share/nginx/html/assets
COPY --from=build /app/src/assets/env.js /usr/share/nginx/html/assets/env.js

# Add OpenTelemetry instrumentation
RUN apk add --no-cache curl

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]