FROM node:20-alpine
WORKDIR /app

RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

EXPOSE 3900
CMD ["node", "dist/index.js"]
