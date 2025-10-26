# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Build arguments for environment variables (with defaults to prevent empty values)
ARG SUPABASE_URL=""
ARG SUPABASE_ANON_KEY=""
ARG INTERESTS=""

# Debug: Show what build args were received
RUN echo "Build args received:" && \
    echo "SUPABASE_URL: ${SUPABASE_URL}" && \
    echo "SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:+[SET]}" && \
    echo "INTERESTS: ${INTERESTS:+[SET]}"

# Set environment variables for the build (ensure they're set even if empty)
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
ENV INTERESTS=${INTERESTS}

# Debug: Verify environment variables are set
RUN echo "Environment variables set:" && \
    echo "SUPABASE_URL: ${SUPABASE_URL}" && \
    echo "SUPABASE_ANON_KEY exists: ${SUPABASE_ANON_KEY:+YES}" && \
    echo "INTERESTS exists: ${INTERESTS:+YES}"

RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist/kanni-poc /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Add OpenTelemetry instrumentation
RUN apk add --no-cache curl

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]