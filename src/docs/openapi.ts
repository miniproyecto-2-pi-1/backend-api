// Especificación OpenAPI 3 que se publica en /api-docs (Swagger UI).
// Regla del curso: cada endpoint nuevo se documenta aquí en el mismo PR que lo crea.

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
      required: ["code", "message"],
    },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Salón de Estudio Colaborativo — API",
    version: "0.1.0",
    description:
      "API principal del Mini-proyecto 2 (750018C, Univalle). Lee y escribe en Firestore; el frontend nunca consulta Firestore directamente.",
  },
  tags: [
  { name: "Sistema", description: "Estado del servicio" },
  { name: "Base técnica", description: "TS-00: dato de prueba end-to-end" },
  { name: "Usuarios", description: "Autenticación y perfiles de usuario" },
],
  paths: {
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Comprueba que el servicio está vivo",
        description: "No consulta Firestore. Sirve para monitoreo y para despertar el servicio en Render.",
        responses: {
          "200": {
            description: "Servicio activo",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/base-tecnica": {
      get: {
        tags: ["Base técnica"],
        summary: "Obtiene el dato de la base técnica desde Firestore",
        description: "Lee el documento `config/base-tecnica` de Firestore y devuelve su campo `mensaje`.",
        responses: {
          "200": {
            description: "Dato leído correctamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    mensaje: { type: "string", example: "¡Hola desde Firestore!" },
                    actualizadoEn: { type: "string", format: "date-time" },
                  },
                  required: ["mensaje", "actualizadoEn"],
                },
              },
            },
          },
          "404": {
            description: "El documento no existe en Firestore",
            content: {
              "application/json": {
                schema: errorSchema,
                example: {
                  error: { code: "BASE_TECNICA_NOT_FOUND", message: "El dato de la base técnica todavía no existe." },
                },
              },
            },
          },
          "503": {
            description: "Firestore no respondió a tiempo o falló",
            content: {
              "application/json": {
                schema: errorSchema,
                example: {
                  error: {
                    code: "FIRESTORE_UNAVAILABLE",
                    message: "No pudimos obtener el dato en este momento. Intenta de nuevo en unos segundos.",
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/email/profile": {
      post: {
        tags: ["Usuarios"],
        summary: "Crear perfil de usuario con correo",
        security: [{ bearerAuth: [] }],
        responses: {
          "201": {
            description: "Perfil creado correctamente",
          },
          "401": {
            description: "Token inválido o ausente",
          },
        },
      },
    },

    "/api/v1/auth/google/profile": {
      post: {
        tags: ["Usuarios"],
        summary: "Crear o actualizar perfil Google",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Perfil guardado correctamente",
          },
          "401": {
            description: "Token inválido o ausente",
          },
        },
      },
    },

    "/api/v1/auth/me": {
      get: {
        tags: ["Usuarios"],
        summary: "Consultar perfil del usuario autenticado",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Perfil encontrado",
          },
          "404": {
            description: "Perfil no encontrado",
          },
        },
      },
    },

    "/api/v1/auth/username": {
      put: {
        tags: ["Usuarios"],
        summary: "Asignar username único",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: {
                  username: {
                    type: "string",
                    example: "andres123",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Username asignado correctamente",
          },
          "400": {
            description: "Username inválido",
          },
          "409": {
            description: "Username ocupado",
          },
        },
      },
    },
  },
    components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};
