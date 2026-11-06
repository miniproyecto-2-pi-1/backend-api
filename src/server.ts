import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

// Render asigna el puerto en la variable PORT; escuchar en 0.0.0.0 es necesario dentro de Docker.
app.listen(env.port, "0.0.0.0", () => {
  console.log(`[backend-api] Escuchando en el puerto ${env.port} (${env.nodeEnv})`);
  console.log(`[backend-api] Swagger en /api-docs`);
});
