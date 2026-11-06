// Capa de lógica: decide qué hacer con lo que devuelve el repositorio
// y traduce los fallos técnicos a errores con mensajes claros.

import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { obtenerBaseTecnica, type BaseTecnicaDoc } from "../repositories/baseTecnica.repository.js";

// Si Firestore no responde a tiempo, cortamos para no dejar al usuario esperando indefinidamente.
function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("FIRESTORE_TIMEOUT")), ms);
    promesa.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function consultarBaseTecnica(): Promise<BaseTecnicaDoc> {
  let doc: BaseTecnicaDoc | null;

  try {
    doc = await conTimeout(obtenerBaseTecnica(), env.firestoreTimeoutMs);
  } catch (error) {
    console.error("[baseTecnica] Error al leer Firestore:", error);
    throw new AppError(
      503,
      "No pudimos obtener el dato en este momento. Intenta de nuevo en unos segundos.",
      "FIRESTORE_UNAVAILABLE",
    );
  }

  if (!doc) {
    throw new AppError(404, "El dato de la base técnica todavía no existe.", "BASE_TECNICA_NOT_FOUND");
  }

  return doc;
}
