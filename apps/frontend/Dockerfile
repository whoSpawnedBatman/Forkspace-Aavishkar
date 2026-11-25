FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SUPABASE_URL=http://localhost:3100 \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-demo \
    NEXT_PUBLIC_API_URL=http://localhost:8100 \
    LOCAL_AUTH_UPSTREAM=http://auth:9999
RUN npm run build
USER node
CMD ["npm", "start"]
