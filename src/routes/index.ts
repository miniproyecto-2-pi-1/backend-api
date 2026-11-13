// Punto único donde se registran las rutas de la API versionada (/api/v1/...).
// En los siguientes sprints aquí se agregan usuarios, salas, etc.

import { Router } from "express";
import { baseTecnicaRouter } from "./baseTecnica.routes.js";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";

export const apiRouter = Router();

apiRouter.use("/base-tecnica", baseTecnicaRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
