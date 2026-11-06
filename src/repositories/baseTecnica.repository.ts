// Capa de acceso a datos: la ÚNICA que sabe que existe Firestore.
// Si mañana cambia la colección o la base de datos, solo se toca este archivo.

import { db } from "../config/firebase.js";

export interface BaseTecnicaDoc {
  mensaje: string;
  actualizadoEn: string; // ISO 8601, tomado del updateTime de Firestore
}

const COLECCION = "config";
const DOCUMENTO = "base-tecnica";

export async function obtenerBaseTecnica(): Promise<BaseTecnicaDoc | null> {
  const snapshot = await db.collection(COLECCION).doc(DOCUMENTO).get();

  if (!snapshot.exists) return null;

  const data = snapshot.data() ?? {};
  return {
    mensaje: typeof data.mensaje === "string" ? data.mensaje : "",
    actualizadoEn: snapshot.updateTime?.toDate().toISOString() ?? new Date().toISOString(),
  };
}
