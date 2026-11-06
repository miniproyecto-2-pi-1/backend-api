// Middleware central de errores: TODA respuesta de error sale de aquí con el mismo formato.
// Nunca expone stack traces ni detalles internos al cliente; esos van solo a los logs.

import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error("[errorHandler] Error inesperado:", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Ocurrió un error inesperado. Intenta de nuevo más tarde.",
    },
  });
}
