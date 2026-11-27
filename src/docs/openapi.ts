// Especificación OpenAPI 3 publicada en /api-docs (Swagger UI).
// Cada endpoint nuevo debe documentarse en el mismo PR que lo implementa.

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        fields: { type: "object", additionalProperties: { type: "string" } },
      },
    },
  },
};

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorSchema } },
});

const profileSchema = {
  type: "object",
  required: ["uid", "email", "username", "provider", "createdAt", "updatedAt"],
  properties: {
    uid: { type: "string" },
    email: { type: "string", format: "email" },
    username: { type: "string", nullable: true, example: "andres123" },
    displayName: { type: "string", nullable: true },
    photoURL: { type: "string", nullable: true },
    provider: { type: "string", enum: ["google", "password"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const authProfileResponse = {
  type: "object",
  required: ["user"],
  properties: { user: profileSchema },
};

const frontendUserSchema = {
  type: "object",
  required: ["uid", "nombres", "apellidos", "username", "correo", "avatar"],
  properties: {
    uid: { type: "string" },
    nombres: { type: "string" },
    apellidos: { type: "string" },
    username: { type: "string", example: "andres123" },
    correo: { type: "string", format: "email" },
    avatar: { type: "integer", minimum: 0, maximum: 5 },
  },
};

const userInputSchema = {
  type: "object",
  required: ["nombres", "apellidos", "username"],
  properties: {
    nombres: { type: "string", minLength: 1, maxLength: 100, example: "Andres" },
    apellidos: { type: "string", minLength: 1, maxLength: 100, example: "Narvaez" },
    username: { type: "string", minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_]{3,20}$", example: "andres123" },
    avatar: { type: "integer", minimum: 0, maximum: 5, default: 0 },
  },
};

const roomInputSchema = {
  type: "object",
  required: ["nombre"],
  properties: {
    nombre: { type: "string", minLength: 1, maxLength: 50, example: "Cálculo II" },
  },
};

const roomSchema = {
  type: "object",
  required: ["id", "nombre", "creadaEn", "esAdministrador", "anfitrionUid"],
  properties: {
    id: { type: "string", example: "K7P2-91XQ" },
    nombre: { type: "string", example: "Cálculo II" },
    creadaEn: { type: "string", format: "date-time" },
    esAdministrador: { type: "boolean", description: "true si quien consulta creó la sala" },
    anfitrionUid: { type: "string", description: "UID de quien creó la sala" },
  },
};

const mensajeSchema = {
  type: "object",
  required: ["id", "uid", "username", "texto", "creadoEn"],
  properties: {
    id: { type: "string" },
    uid: { type: "string" },
    username: { type: "string" },
    texto: { type: "string" },
    creadoEn: { type: "string", format: "date-time" },
  },
};

const bearerSecurity = [{ bearerAuth: [] }];
const jsonResponse = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Salón de Estudio Colaborativo — API",
    version: "0.1.0",
    description: "API principal del Mini-proyecto 2 (750018C, Univalle). Lee y escribe en Firestore; el frontend utiliza Firebase Auth para obtener el token y accede a los perfiles mediante la API.",
  },
  tags: [
    { name: "Sistema", description: "Estado del servicio" },
    { name: "Base técnica", description: "TS-00: dato de prueba end-to-end" },
    { name: "Usuarios", description: "Autenticación y perfiles de usuario" },
    { name: "Salas", description: "Crear, consultar, editar y eliminar salas; consultar el historial del chat" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Comprueba que el servicio está vivo",
        description: "No consulta Firestore. Sirve para monitoreo y para despertar el servicio en Render.",
        responses: {
          "200": jsonResponse("Servicio activo", {
            type: "object",
            properties: { status: { type: "string", example: "ok" } },
          }),
        },
      },
    },
    "/api/v1/base-tecnica": {
      get: {
        tags: ["Base técnica"],
        summary: "Obtiene el dato de la base técnica desde Firestore",
        description: "Lee el documento `config/base-tecnica` de Firestore y devuelve su campo `mensaje`.",
        responses: {
          "200": jsonResponse("Dato leído correctamente", {
            type: "object",
            required: ["mensaje", "actualizadoEn"],
            properties: {
              mensaje: { type: "string", example: "¡Hola desde Firestore!" },
              actualizadoEn: { type: "string", format: "date-time" },
            },
          }),
          "404": errorResponse("El documento no existe en Firestore (BASE_TECNICA_NOT_FOUND)"),
          "503": errorResponse("Firestore no está disponible (FIRESTORE_UNAVAILABLE)"),
        },
      },
    },
    "/api/v1/auth/email/profile": {
      post: {
        tags: ["Usuarios"],
        summary: "Crear o recuperar perfil de usuario autenticado con correo",
        description: "Obtiene el UID y correo del token Firebase. No recibe contraseña ni crea la cuenta de Firebase Authentication.",
        security: bearerSecurity,
        responses: {
          "201": jsonResponse("Perfil creado o recuperado", authProfileResponse),
          "401": errorResponse("Token inválido, ausente o sin correo"),
        },
      },
    },
    "/api/v1/auth/google/profile": {
      post: {
        tags: ["Usuarios"],
        summary: "Crear o actualizar perfil Google",
        description: "Utiliza los datos de identidad del token de Google autenticado con Firebase.",
        security: bearerSecurity,
        responses: {
          "200": jsonResponse("Perfil guardado correctamente", authProfileResponse),
          "401": errorResponse("Token inválido, ausente o sin correo"),
          "403": errorResponse("El token no corresponde a Google (GOOGLE_AUTH_REQUIRED)"),
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Usuarios"],
        summary: "Consultar perfil del usuario autenticado",
        security: bearerSecurity,
        responses: {
          "200": jsonResponse("Perfil encontrado", authProfileResponse),
          "401": errorResponse("Token inválido o ausente"),
          "404": errorResponse("Usuario no encontrado (USER_NOT_FOUND)"),
        },
      },
    },
    "/api/v1/auth/username": {
      put: {
        tags: ["Usuarios"],
        summary: "Asignar username único al perfil existente",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: {
                  username: { type: "string", minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_]{3,20}$", example: "andres123" },
                },
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("Username asignado correctamente", authProfileResponse),
          "400": errorResponse("Username inválido (INVALID_USERNAME)"),
          "401": errorResponse("Token inválido o ausente"),
          "404": errorResponse("Perfil no encontrado (PROFILE_NOT_FOUND)"),
          "409": errorResponse("Username ocupado o ya asignado (USERNAME_TAKEN / USERNAME_ALREADY_SET)"),
        },
      },
    },
    "/api/v1/users/me": {
      delete: {
        tags: ["Usuarios"],
        summary: "Eliminar la cuenta (US-05)",
        description: "Borra el perfil, libera el username, borra las salas que la persona creó (con sus mensajes) y elimina la cuenta de Firebase Auth. Es definitivo. El frontend debe pedir confirmación antes de llamarla.",
        security: bearerSecurity,
        responses: {
          "204": { description: "Cuenta eliminada" },
          "401": errorResponse("Token inválido o ausente"),
        },
      },
      get: {
        tags: ["Usuarios"],
        summary: "Consultar datos del usuario para el frontend",
        description: "Requiere un token Firebase válido y un perfil con username asignado.",
        security: bearerSecurity,
        responses: {
          "200": jsonResponse("Datos del usuario", frontendUserSchema),
          "401": errorResponse("Token inválido o ausente"),
          "404": errorResponse("Perfil sin username (PROFILE_INCOMPLETE)"),
        },
      },
      patch: {
        tags: ["Usuarios"],
        summary: "Editar el perfil (US-04)",
        description: "Edita nombres, apellidos, avatar y username. El correo es opcional: si se envía y es distinto, se cambia en Firebase Auth y en Firestore (solo para cuentas con correo y contraseña; con Google no se puede). El username y el correo no pueden ser de otra persona.",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                ...userInputSchema,
                properties: {
                  ...userInputSchema.properties,
                  correo: { type: "string", format: "email", example: "nuevo@correo.com" },
                },
              },
            },
          },
        },
        responses: {
          "200": jsonResponse("Perfil actualizado", frontendUserSchema),
          "400": errorResponse("Datos inválidos (VALIDATION); puede incluir error.fields"),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Cuenta de Google: no se puede cambiar el correo (EMAIL_CHANGE_NOT_ALLOWED)"),
          "404": errorResponse("Perfil sin completar (PROFILE_INCOMPLETE)"),
          "409": errorResponse("Username o correo ya usados por otra persona (USERNAME_TAKEN / EMAIL_TAKEN)"),
        },
      },
    },
    "/api/v1/users": {
      post: {
        tags: ["Usuarios"],
        summary: "Guardar perfil de usuario autenticado con correo y contraseña",
        description: "Requiere un token Firebase cuyo proveedor sea `password`. El correo se obtiene del token, no del cuerpo de la petición. Reserva el username de forma transaccional.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: userInputSchema } } },
        responses: {
          "201": jsonResponse("Perfil creado", frontendUserSchema),
          "200": jsonResponse("Perfil actualizado o ya existente", frontendUserSchema),
          "400": errorResponse("Datos inválidos (VALIDATION); puede incluir error.fields"),
          "401": errorResponse("Token inválido, ausente o sin correo"),
          "403": errorResponse("El token no corresponde al proveedor password (EMAIL_AUTH_REQUIRED)"),
          "409": errorResponse("Username ocupado o ya asignado (USERNAME_TAKEN / USERNAME_ALREADY_SET)"),
        },
      },
    },
    "/api/v1/users/me/username": {
      post: {
        tags: ["Usuarios"],
        summary: "Guardar o completar perfil de usuario Google",
        description: "Requiere un token Firebase cuyo proveedor sea `google.com`. Valida los datos y reserva el username de forma transaccional.",
        security: bearerSecurity,
        requestBody: { required: true, content: { "application/json": { schema: userInputSchema } } },
        responses: {
          "201": jsonResponse("Perfil creado", frontendUserSchema),
          "200": jsonResponse("Perfil actualizado o ya existente", frontendUserSchema),
          "400": errorResponse("Datos inválidos (VALIDATION); puede incluir error.fields"),
          "401": errorResponse("Token inválido, ausente o sin correo"),
          "403": errorResponse("El token no corresponde a Google (GOOGLE_AUTH_REQUIRED)"),
          "409": errorResponse("Username ocupado o ya asignado (USERNAME_TAKEN / USERNAME_ALREADY_SET)"),
        },
      },
    },
    "/api/v1/rooms": {
      post: {
        tags: ["Salas"],
        summary: "Crear una sala (US-06)",
        description: "Crea una sala con un ID único y corto (por ejemplo `K7P2-91XQ`). Quien la crea queda como administrador. Requiere sesión y el perfil completo.",
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: roomInputSchema } },
        },
        responses: {
          "201": jsonResponse("Sala creada", roomSchema),
          "400": errorResponse("Nombre vacío o de más de 50 caracteres (VALIDATION); incluye error.fields.nombre"),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar (PROFILE_INCOMPLETE)"),
        },
      },
      get: {
        tags: ["Salas"],
        summary: "Listar mis salas (US-06)",
        description: "Devuelve solo las salas que creó la persona con la sesión iniciada, las más nuevas primero. Si no tiene ninguna, devuelve una lista vacía.",
        security: bearerSecurity,
        responses: {
          "200": jsonResponse("Lista de salas", { type: "array", items: roomSchema }),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar (PROFILE_INCOMPLETE)"),
        },
      },
    },
    "/api/v1/rooms/{id}": {
      get: {
        tags: ["Salas"],
        summary: "Consultar una sala por su ID",
        description: "Sirve para comprobar que una sala existe antes de entrar. El ID se acepta en mayúsculas o minúsculas.",
        security: bearerSecurity,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "K7P2-91XQ" } },
        ],
        responses: {
          "200": jsonResponse("La sala", roomSchema),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar (PROFILE_INCOMPLETE)"),
          "404": errorResponse("Sala no encontrada (ROOM_NOT_FOUND)"),
        },
      },
      patch: {
        tags: ["Salas"],
        summary: "Editar el nombre de una sala (US-07)",
        description: "Solo el anfitrión puede cambiar el nombre. El ID, la fecha de creación y el anfitrión no cambian.",
        security: bearerSecurity,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "K7P2-91XQ" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: roomInputSchema } },
        },
        responses: {
          "200": jsonResponse("Sala actualizada", roomSchema),
          "400": errorResponse("Nombre inválido (VALIDATION); incluye error.fields.nombre"),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar o usuario no anfitrión (PROFILE_INCOMPLETE / FORBIDDEN)"),
          "404": errorResponse("Sala no encontrada (ROOM_NOT_FOUND)"),
        },
      },
      delete: {
        tags: ["Salas"],
        summary: "Eliminar una sala y su chat (US-07)",
        description: "Solo el anfitrión puede eliminarla. También se borran los mensajes guardados en la subcolección.",
        security: bearerSecurity,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "K7P2-91XQ" } },
        ],
        responses: {
          "204": { description: "Sala y mensajes eliminados" },
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar o usuario no anfitrión (PROFILE_INCOMPLETE / FORBIDDEN)"),
          "404": errorResponse("Sala no encontrada (ROOM_NOT_FOUND)"),
        },
      },
    },
    "/api/v1/rooms/{id}/messages": {
      get: {
        tags: ["Salas"],
        summary: "Consultar el historial de mensajes (US-11)",
        description: "Devuelve como máximo 100 mensajes ordenados del más viejo al más nuevo. Sin `antes`, empieza por los más recientes; con `antes`, devuelve mensajes anteriores a esa fecha.",
        security: bearerSecurity,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", example: "K7P2-91XQ" } },
          { name: "limite", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "antes", in: "query", required: false, schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": jsonResponse("Página del historial", {
            type: "object",
            required: ["mensajes", "hayMas"],
            properties: {
              mensajes: { type: "array", items: mensajeSchema },
              hayMas: { type: "boolean", description: "true si hay mensajes anteriores a esta página" },
            },
          }),
          "400": errorResponse("Fecha o límite inválido (VALIDATION)"),
          "401": errorResponse("Token inválido o ausente"),
          "403": errorResponse("Perfil sin completar (PROFILE_INCOMPLETE)"),
          "404": errorResponse("Sala no encontrada (ROOM_NOT_FOUND)"),
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
        description: "Token ID de Firebase Authentication. En Swagger Authorize, pega el token sin el prefijo Bearer.",
      },
    },
  },
};
