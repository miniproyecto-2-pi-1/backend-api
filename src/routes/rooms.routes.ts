// US-06: crear salas y ver las propias.
//
// Cada sala es un documento en la colección "rooms" de Firestore. Su ID es un código corto
// y fácil de dictar (por ejemplo K7P2-91XQ). Ese mismo ID es el que se usa para unirse a la
// sala y el que usa el servidor de tiempo real (backend-realtime).
//
// Campos de cada sala:
//   nombre     → nombre que escribió quien la creó
//   ownerUid   → uid de quien la creó (el administrador de la sala)
//   creadaEn   → fecha de creación

import { randomInt } from "node:crypto";
import { Router } from "express";
import { db } from "../config/firebase.js";
import { AppError } from "../errors/AppError.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireCompleteProfile } from "../middlewares/requireCompleteProfile.js";

export const roomsRouter = Router();

// Todas las rutas de salas piden sesión iniciada y el perfil completo (con username).
roomsRouter.use(requireAuth, requireCompleteProfile);

const MAXIMO_NOMBRE = 50;
const INTENTOS_PARA_ID = 5;

// Letras y números sin los que se confunden (sin 0, O, 1, I).
const CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Crea un código como "K7P2-91XQ": 4 caracteres, guion y otros 4.
function crearIdDeSala(): string {
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += CARACTERES[randomInt(CARACTERES.length)];
    if (i === 3) id += "-";
  }
  return id;
}

// Comprueba el nombre de la sala y lo devuelve limpio. Si no sirve, responde 400.
function validarNombre(body: unknown): string {
  const crudo = (body as { nombre?: unknown } | null)?.nombre;
  const nombre = typeof crudo === "string" ? crudo.trim() : "";

  if (nombre.length < 1 || nombre.length > MAXIMO_NOMBRE) {
    const error = new AppError(400, "Revisa los campos marcados.", "VALIDATION");
    Object.assign(error, {
      fields: { nombre: `Escribe un nombre de 1 a ${MAXIMO_NOMBRE} caracteres.` },
    });
    throw error;
  }

  return nombre;
}

// Así se ve una sala hacia afuera. No se muestra ownerUid, solo si quien pregunta es el admin.
function salaParaElFrontend(id: string, datos: Record<string, unknown>, uid: string) {
  return {
    id,
    nombre: datos.nombre as string,
    creadaEn: datos.creadaEn as string,
    esAdministrador: datos.ownerUid === uid,
  };
}

// POST /api/v1/rooms  → crea una sala y devuelve su ID
roomsRouter.post("/", async (req, res) => {
  const uid = req.uid as string;
  const nombre = validarNombre(req.body);
  const datos = { nombre, ownerUid: uid, creadaEn: new Date().toISOString() };

  // "create" falla si el ID ya existe. Si pasa (es muy raro), se prueba con otro código.
  for (let intento = 0; intento < INTENTOS_PARA_ID; intento++) {
    const id = crearIdDeSala();
    try {
      await db.collection("rooms").doc(id).create(datos);
      res.status(201).json(salaParaElFrontend(id, datos, uid));
      return;
    } catch (error) {
      const yaExiste = (error as { code?: number }).code === 6; // 6 = ALREADY_EXISTS
      if (!yaExiste) throw error;
    }
  }

  throw new AppError(
    503,
    "No pudimos crear la sala. Intenta de nuevo.",
    "ROOM_ID_UNAVAILABLE"
  );
});

// GET /api/v1/rooms  → las salas que creó esta persona (las más nuevas primero)
roomsRouter.get("/", async (req, res) => {
  const uid = req.uid as string;
  const resultado = await db.collection("rooms").where("ownerUid", "==", uid).get();

  const salas = resultado.docs
    .map((doc) => salaParaElFrontend(doc.id, doc.data(), uid))
    .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn));

  res.status(200).json(salas);
});

// GET /api/v1/rooms/:id  → una sala por su ID
roomsRouter.get("/:id", async (req, res) => {
  const uid = req.uid as string;
  const id = String(req.params.id).trim().toUpperCase(); // acepta el ID escrito en minúsculas

  // Un ID con caracteres raros no puede existir (y Firestore no lo aceptaría como nombre).
  if (!/^[A-Z0-9-]{1,20}$/.test(id)) {
    throw new AppError(404, "Sala no encontrada. Revisa el ID.", "ROOM_NOT_FOUND");
  }

  const doc = await db.collection("rooms").doc(id).get();
  if (!doc.exists) {
    throw new AppError(404, "Sala no encontrada. Revisa el ID.", "ROOM_NOT_FOUND");
  }

  res.status(200).json(salaParaElFrontend(doc.id, doc.data() ?? {}, uid));
});
