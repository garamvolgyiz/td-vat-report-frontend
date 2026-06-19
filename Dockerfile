FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

ENV FRONTEND_PORT=80
ENV API_PROTOCOL=https
ENV API_HOST=api.garamol.com
ENV API_PORT=
ENV API_BASE_URL=

EXPOSE 80
