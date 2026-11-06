// Arma la aplicación Express (middlewares, rutas, Swagger y manejo de errores).
// Se separa de server.ts para poder probar la app sin abrir un puerto.

import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./docs/openapi.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  // Swagger UI usa scripts y estilos en línea; se monta antes de helmet para que su CSP no lo bloquee.
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/v1", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
