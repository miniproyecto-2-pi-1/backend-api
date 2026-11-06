# backend-api — Salón de Estudio Colaborativo

API principal del Mini-proyecto 2 (750018C Proyecto Integrador I, Univalle).
Node.js + TypeScript + Express 5, con Firestore a través de Firebase Admin SDK.

El frontend **nunca** consulta Firestore directamente: todo dato pasa por esta API.

## Endpoints (Sprint 0)

| Método | Ruta                   | Qué hace                                                 |
| ------ | ---------------------- | -------------------------------------------------------- |
| GET    | `/health`              | Comprueba que el servicio está vivo (no toca Firestore)  |
| GET    | `/api/v1/base-tecnica` | Lee `config/base-tecnica` en Firestore y devuelve `mensaje` |
| GET    | `/api-docs`            | Documentación Swagger                                    |

Respuestas de error, siempre con el mismo formato:

```json
{ "error": { "code": "FIRESTORE_UNAVAILABLE", "message": "No pudimos obtener el dato..." } }
```

## Estructura (por capas)

```
src/
├── server.ts            # Arranca el servidor (puerto)
├── app.ts               # Middlewares, rutas, Swagger, errores
├── config/              # Variables de entorno y Firebase Admin
├── routes/              # Rutas HTTP → controller
├── controllers/         # Petición/respuesta HTTP → service
├── services/            # Lógica y traducción de errores → repository
├── repositories/        # Único lugar que habla con Firestore
├── middlewares/         # 404 y manejador central de errores
├── errors/              # AppError (errores controlados)
└── docs/openapi.ts      # Especificación Swagger
```

## Variables de entorno

Ver `.env.example`. Ninguna credencial real va al repositorio.

| Variable                | Obligatoria | Descripción                                             |
| ----------------------- | ----------- | ------------------------------------------------------- |
| `PORT`                  | No          | Puerto (Render lo asigna solo; local: 3000)             |
| `CORS_ORIGINS`          | No          | Orígenes permitidos, separados por coma (URL de Vercel) |
| `FIREBASE_PROJECT_ID`   | Sí          | ID del proyecto de Firebase                             |
| `FIREBASE_CLIENT_EMAIL` | Sí          | `client_email` de la service account                    |
| `FIREBASE_PRIVATE_KEY`  | Sí          | `private_key` de la service account (con `\n`)          |
| `FIRESTORE_TIMEOUT_MS`  | No          | Espera máxima a Firestore antes de responder 503        |

## Cómo ejecutarlo

### Con Docker (recomendado)

```bash
cp .env.example .env      # y llenar los valores
docker build -t backend-api .
docker run --env-file .env -p 3000:3000 backend-api
```

### Todo el sistema (frontend + API) con docker-compose

Frontend y backend están en repositorios distintos. `docker-compose.yml` vive en este repo y
busca el frontend en `../frontend`, así que hay que clonar ambos lado a lado:

```bash
mkdir salon-estudio && cd salon-estudio
git clone <url-de-este-repo> backend-api
git clone <url-del-repo-frontend> frontend
cd backend-api
cp .env.example .env      # y llenar los valores
docker compose up --build
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000> · Swagger: <http://localhost:3000/api-docs>

### Sin Docker (desarrollo)

```bash
npm install
cp .env.example .env      # y llenar los valores
npm run dev               # recarga automática
```

Abrir <http://localhost:3000/api-docs>.

## Despliegue en Render

1. New → Web Service → conectar este repositorio (Root Directory vacío: el `Dockerfile` está en la raíz).
2. **Runtime: Docker** (Render detecta el `Dockerfile`).
3. En *Environment* agregar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y `CORS_ORIGINS` con la URL de Vercel.
4. **Health Check Path**: `/health`.

## Reglas de Firestore

`firestore.rules` niega todo acceso directo de clientes. Se publican en la consola de Firebase
(Firestore → Reglas). El Admin SDK que usa esta API no está sujeto a ellas.
