FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src/
RUN apk add --no-cache openssl && npx prisma generate && npx tsc -p tsconfig.build.json

FROM node:20-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app

COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=node:node prisma ./prisma

USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
