FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY . .

RUN pnpm install

RUN npx prisma generate

RUN chmod +x ./entrypoint.sh

CMD ["./entrypoint.sh"]
