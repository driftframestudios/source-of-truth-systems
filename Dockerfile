FROM postgres:18.7-bookworm@sha256:ece55f7868da684e400f82f1030a050718adbdd65c23aa500c486f6e2950dc0f AS database
COPY scripts/clone/bootstrap.sql /docker-entrypoint-initdb.d/10-local-roles.sql

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN npm run build && pnpm prune --prod

FROM node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS app
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/LICENSE ./LICENSE
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/scripts/serve.mjs ./scripts/serve.mjs
COPY --from=build --chown=node:node /app/scripts/clone ./scripts/clone
USER node
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]
