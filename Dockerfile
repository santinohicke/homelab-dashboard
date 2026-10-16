# ==============================================================================
# Multi-Stage Dockerfile for Homelab Dashboard SPA
# ==============================================================================

# STAGE 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias aprovechando la caché de Docker
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código fuente y compilar para producción
COPY . .
RUN npm run build

# STAGE 2: Serve with High-Performance Nginx Alpine
FROM nginx:alpine AS runner

# Copiar configuración optimizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los assets compilados desde la etapa anterior
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponer el puerto estándar HTTP
EXPOSE 80

# Healthcheck interno
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
