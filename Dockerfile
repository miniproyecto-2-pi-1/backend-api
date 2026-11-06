# ---------- Etapa 1: compilar TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Etapa 2: imagen final (solo lo necesario para correr) ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# No correr como root dentro del contenedor.
USER node

# Render inyecta PORT; 3000 es el valor por defecto en local.
EXPOSE 3000
CMD ["node", "dist/server.js"]
