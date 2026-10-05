FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Server settings and open tickets live here; mount a volume to keep them.
RUN mkdir data && chown node:node data
VOLUME /app/data
USER node
CMD ["node", "dist/index.js"]
