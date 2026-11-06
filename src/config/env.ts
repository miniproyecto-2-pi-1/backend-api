// Lee y valida las variables de entorno una sola vez al arrancar.
// Si falta algo obligatorio, el servidor no arranca (falla rápido y con un mensaje claro).

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  // Orígenes permitidos por CORS, separados por coma (p. ej. la URL de Vercel).
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  firebase: {
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    // Render y los .env guardan los saltos de línea como "\n" literales; aquí se restauran.
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  },
  // Tiempo máximo de espera a Firestore antes de responder 503.
  firestoreTimeoutMs: Number(process.env.FIRESTORE_TIMEOUT_MS ?? 5000),
} as const;
