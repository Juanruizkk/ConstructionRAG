# Build context = repo root (pnpm workspace). Build: docker build -f apps/api/Dockerfile -t ssi-api .
FROM node:22-slim
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ENV PORT=3001
EXPOSE 3001
# tsx runs the TypeScript entrypoint directly (no separate build step).
CMD ["pnpm", "--filter", "@ssi/api", "exec", "tsx", "src/server.ts"]
