# Frontend Angular, servido por nginx con reverse proxy de /api hacia el backend.
# Build (contexto = raiz del repo): docker build -t rtattooai-frontend .
# Runtime necesita la env var BACKEND_URL (p. ej. https://rtattooai-backend...azurecontainerapps.io)

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY --from=build /app/dist/rtattooai-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080
