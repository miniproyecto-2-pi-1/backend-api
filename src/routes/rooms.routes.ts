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
const LIMITE_MENSAJES_POR_DEFECTO = 50;
const LIMITE_MENSAJES_MAXIMO = 100;
const MENSAJE_SALA_NO_ENCONTRADA = "Sala no encontrada. Revisa el ID.";
const MENSAJE_SOLO_ANFITRION = "Solo el anfitrión puede editar o eliminar la sala.";

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

function errorValidacion(campo: string, mensaje: string): AppError {
  const error = new AppError(400, "Revisa los campos marcados.", "VALIDATION");
  Object.assign(error, { fields: { [campo]: mensaje } });
  return error;
}

function normalizarIdDeSala(idCrudo: string): string {
  const id = idCrudo.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(id)) {
    throw new AppError(404, MENSAJE_SALA_NO_ENCONTRADA, "ROOM_NOT_FOUND");
  }
  return id;
}

function validarAnfitrion(datos: Record<string, unknown>, uid: string): void {
  if (datos.ownerUid !== uid) {
    throw new AppError(403, MENSAJE_SOLO_ANFITRION, "FORBIDDEN");
  }
}

// Así se ve una sala hacia afuera; el uid del anfitrión permite identificarlo en presencia.
function salaParaElFrontend(id: string, datos: Record<string, unknown>, uid: string) {
  return {
    id,
    nombre: datos.nombre as string,
    creadaEn: datos.creadaEn as string,
    esAdministrador: datos.ownerUid === uid,
    anfitrionUid: datos.ownerUid as string,
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
  const id = normalizarIdDeSala(req.params.id); // acepta el ID escrito en minúsculas

  const doc = await db.collection("rooms").doc(id).get();
  if (!doc.exists) {
    throw new AppError(404, MENSAJE_SALA_NO_ENCONTRADA, "ROOM_NOT_FOUND");
  }

  res.status(200).json(salaParaElFrontend(doc.id, doc.data() ?? {}, uid));
});

// PATCH /api/v1/rooms/:id → el anfitrión cambia el nombre sin modificar el ID ni la fecha.
roomsRouter.patch("/:id", async (req, res) => {
  const uid = req.uid as string;
  const id = normalizarIdDeSala(req.params.id);
  const referencia = db.collection("rooms").doc(id);
  const doc = await referencia.get();

  if (!doc.exists) {
    throw new AppError(404, MENSAJE_SALA_NO_ENCONTRADA, "ROOM_NOT_FOUND");
  }

  const datos = doc.data() ?? {};
  validarAnfitrion(datos, uid);
  const nombre = validarNombre(req.body);
  await referencia.update({ nombre });

  res.status(200).json(salaParaElFrontend(id, { ...datos, nombre }, uid));
});

// DELETE /api/v1/rooms/:id → elimina la sala y todas sus subcolecciones, incluido el chat.
roomsRouter.delete("/:id", async (req, res) => {
  const uid = req.uid as string;
  const id = normalizarIdDeSala(req.params.id);
  const referencia = db.collection("rooms").doc(id);
  const doc = await referencia.get();

  if (!doc.exists) {
    throw new AppError(404, MENSAJE_SALA_NO_ENCONTRADA, "ROOM_NOT_FOUND");
  }

  validarAnfitrion(doc.data() ?? {}, uid);
  await db.recursiveDelete(referencia);
  res.status(204).send();
});

function validarLimiteMensajes(valor: unknown): number {
  if (valor === undefined) return LIMITE_MENSAJES_POR_DEFECTO;
  if (typeof valor !== "string" || !/^\d+$/.test(valor)) {
    throw errorValidacion("limite", "El límite debe ser un número entre 1 y 100.");
  }

  const limite = Number(valor);
  if (!Number.isSafeInteger(limite) || limite < 1 || limite > LIMITE_MENSAJES_MAXIMO) {
    throw errorValidacion("limite", "El límite debe ser un número entre 1 y 100.");
  }
  return limite;
}

function validarAntes(valor: unknown): string | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== "string") {
    throw errorValidacion("antes", "Escribe una fecha ISO válida.");
  }
  const partes = valor.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/i,
  );
  if (!partes) {
    throw errorValidacion("antes", "Escribe una fecha ISO válida.");
  }

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const hora = Number(partes[4]);
  const minuto = Number(partes[5]);
  const segundo = Number(partes[6]);
  const diasPorMes = [31, anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    dia > diasPorMes[mes - 1] ||
    hora > 23 ||
    minuto > 59 ||
    segundo > 59 ||
    (partes[8] !== undefined && Number(partes[8]) > 23) ||
    (partes[9] !== undefined && Number(partes[9]) > 59)
  ) {
    throw errorValidacion("antes", "Escribe una fecha ISO válida.");
  }

  const milisegundos = Date.parse(valor);
  if (Number.isNaN(milisegundos)) {
    throw errorValidacion("antes", "Escribe una fecha ISO válida.");
  }
  return new Date(milisegundos).toISOString();
}

// GET /api/v1/rooms/:id/messages → página de mensajes antiguos, del más viejo al más nuevo.
roomsRouter.get("/:id/messages", async (req, res) => {
  const id = normalizarIdDeSala(req.params.id);
  const sala = await db.collection("rooms").doc(id).get();
  if (!sala.exists) {
    throw new AppError(404, MENSAJE_SALA_NO_ENCONTRADA, "ROOM_NOT_FOUND");
  }

  const limite = validarLimiteMensajes(req.query.limite);
  const antes = validarAntes(req.query.antes);
  const mensajesRef = db.collection("rooms").doc(id).collection("messages");
  const consulta =
    antes !== undefined ? mensajesRef.where("creadoEn", "<", antes) : mensajesRef;

  const resultado = await consulta.orderBy("creadoEn", "desc").limit(limite + 1).get();
  const hayMas = resultado.docs.length > limite;
  const mensajes = resultado.docs.slice(0, limite).reverse().map((doc) => {
    const datos = doc.data();
    return {
      id: doc.id,
      uid: datos.uid as string,
      username: datos.username as string,
      texto: datos.texto as string,
      creadoEn: datos.creadoEn as string,
    };
  });

  res.status(200).json({ mensajes, hayMas });
});
