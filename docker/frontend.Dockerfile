FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend ./frontend
COPY components.json tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY tailwind.config.ts postcss.config.js vite.config.mjs eslint.config.js index.html ./

RUN npm install
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
