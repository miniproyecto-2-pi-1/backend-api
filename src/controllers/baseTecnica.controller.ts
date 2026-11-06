// Capa HTTP: recibe la petición, llama al servicio y arma la respuesta.
// No sabe nada de Firestore. En Express 5, si una función async lanza un error,
// este pasa solo al middleware de errores (no hace falta try/catch aquí).

import type { Request, Response } from "express";
import { consultarBaseTecnica } from "../services/baseTecnica.service.js";

export async function getBaseTecnica(_req: Request, res: Response): Promise<void> {
  const dato = await consultarBaseTecnica();
  res.status(200).json(dato);
}
