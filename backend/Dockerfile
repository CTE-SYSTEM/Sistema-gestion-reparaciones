FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat postgresql16-client

FROM base AS dev
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm prune --omit=dev
EXPOSE 5000
CMD ["npm", "start"]
