// Lee y valida las variables de entorno una sola vez al arrancar.
// Si falta algo obligatorio, el servidor no arranca (falla rápido y con un mensaje claro).

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
}

// La clave privada de la service account llega de muchas formas según dónde se pegue
// (Render, .env, docker --env-file): con comillas, con "\n" literales o doblemente escapados,
// con saltos de línea reales, con espacios o sin las líneas BEGIN/END. Aquí se limpia todo y se
// reconstruye un PEM válido: se toma solo el cuerpo base64 y se vuelve a partir en líneas de 64.
function normalizePrivateKey(raw: string): string {
  const body = raw
    .replace(/\\+n/g, "\n") // "\n" literal (también "\\n") -> salto de línea
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/["'\s]/g, ""); // comillas, espacios y saltos de línea
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
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
    // Ver normalizePrivateKey: acepta la clave pegada de cualquiera de las formas habituales.
    privateKey: normalizePrivateKey(required("FIREBASE_PRIVATE_KEY")),
  },
  // Tiempo máximo de espera a Firestore antes de responder 503.
  firestoreTimeoutMs: Number(process.env.FIRESTORE_TIMEOUT_MS ?? 5000),
} as const;