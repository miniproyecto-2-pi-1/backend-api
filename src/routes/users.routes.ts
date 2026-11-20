import { Router } from "express";
import type { Request } from "express";
import { db } from "../config/firebase.js";
import { AppError } from "../errors/AppError.js";
import { getAuth } from "firebase-admin/auth";
import { requireAuth } from "../middlewares/auth.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

type DatosPerfil = {
  nombres: string;
  apellidos: string;
  username: string;
  avatar: number;
};

function validarPerfil(body: unknown): DatosPerfil {
  const datos =
    body && typeof body === "object"
      ? body as Record<string, unknown>
      : {};

  const fields: Record<string, string> = {};

  const nombres =
    typeof datos.nombres === "string"
      ? datos.nombres.trim()
      : "";

  const apellidos =
    typeof datos.apellidos === "string"
      ? datos.apellidos.trim()
      : "";

  const username =
    typeof datos.username === "string"
      ? datos.username.trim()
      : "";

  const avatar = datos.avatar ?? 0;

  if (!nombres || nombres.length > 100) {
    fields.nombres = "Escribe nombres válidos.";
  }

  if (!apellidos || apellidos.length > 100) {
    fields.apellidos = "Escribe apellidos válidos.";
  }

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    fields.username =
      "Usa de 3 a 20 letras, números o guion bajo.";
  }

  if (
    typeof avatar !== "number" ||
    !Number.isInteger(avatar) ||
    avatar < 0 ||
    avatar > 5
  ) {
    fields.avatar = "Selecciona un avatar válido.";
  }

  if (Object.keys(fields).length > 0) {
    const error = new AppError(
      400,
      "Revisa los campos marcados.",
      "VALIDATION"
    );

    Object.assign(error, { fields });
    throw error;
  }

  return {
    nombres,
    apellidos,
    username,
    avatar: avatar as number
  };
}

function usuarioFrontend(
  uid: string,
  data: Record<string, unknown>
) {
  const nombreCompleto =
    typeof data.displayName === "string"
      ? data.displayName.trim()
      : "";

  const partes = nombreCompleto.split(/\s+/).filter(Boolean);

  return {
    uid,
    nombres:
      typeof data.nombres === "string"
        ? data.nombres
        : partes[0] ?? "",
    apellidos:
      typeof data.apellidos === "string"
        ? data.apellidos
        : partes.slice(1).join(" "),
    username: data.username as string,
    correo: data.email as string,
    avatar:
      typeof data.avatar === "number"
        ? data.avatar
        : 0
  };
}

async function guardarPerfil(
  req: Request,
  body: unknown,
  soloGoogle: boolean
) {
  if (!req.uid || !req.authEmail) {
    throw new AppError(
      401,
      "La sesión no tiene un correo válido.",
      "UNAUTHENTICATED"
    );
  }

  if (soloGoogle && req.authProvider !== "google.com") {
    throw new AppError(
      403,
      "Debes iniciar sesión con Google.",
      "GOOGLE_AUTH_REQUIRED"
    );
  }

  if (!soloGoogle && req.authProvider !== "password") {
    throw new AppError(
      403,
      "Debes registrarte con correo y contraseña.",
      "EMAIL_AUTH_REQUIRED"
    );
  }

  const datos = validarPerfil(body);
  const uid = req.uid;
  const email = req.authEmail;
  const normalized = datos.username.toLowerCase();

  const userRef = db.collection("users").doc(uid);
  const usernameRef =
    db.collection("usernames").doc(normalized);

  const resultado = await db.runTransaction(async (tx) => {
    // Todas las lecturas deben ocurrir antes de escribir.
    const userDoc = await tx.get(userRef);
    const usernameDoc = await tx.get(usernameRef);

    const actual = userDoc.data() ?? {};

    if (usernameDoc.exists &&
        usernameDoc.data()?.uid !== uid) {
      throw new AppError(
        409,
        "Ese nombre de usuario ya existe. Elige otro.",
        "USERNAME_TAKEN"
      );
    }

    if (actual.username &&
        actual.username.toLowerCase() !== normalized) {
      throw new AppError(
        409,
        "El usuario ya tiene un username asignado.",
        "USERNAME_ALREADY_SET"
      );
    }

    const now = new Date().toISOString();

    const perfil = {
      ...actual,
      uid,
      email,
      username: normalized,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      displayName:
        `${datos.nombres} ${datos.apellidos}`,
      avatar: datos.avatar,
      provider: soloGoogle ? "google" : "password",
      photoURL: actual.photoURL ?? null,
      createdAt: actual.createdAt ?? now,
      updatedAt: now
    };

    tx.set(usernameRef, {
      uid,
      username: normalized
    });

    tx.set(userRef, perfil, { merge: true });

    return {
      nuevo: !userDoc.exists,
      perfil
    };
  });

  return {
    status: resultado.nuevo ? 201 : 200,
    usuario: usuarioFrontend(uid, resultado.perfil)
  };
}

// GET /api/v1/users/me
usersRouter.get("/me", async (req, res) => {
  if (!req.uid) {
    throw new AppError(
      401,
      "Debes iniciar sesión.",
      "UNAUTHENTICATED"
    );
  }

  const doc = await db.collection("users").doc(req.uid).get();
  const data = doc.data();

  if (!data?.username) {
    throw new AppError(
      404,
      "Elige un nombre de usuario para continuar.",
      "PROFILE_INCOMPLETE"
    );
  }

  res.status(200).json(usuarioFrontend(req.uid, data));
});

// POST /api/v1/users
usersRouter.post("/", async (req, res) => {
  const resultado = await guardarPerfil(
    req,
    req.body,
    false
  );

  res.status(resultado.status).json(resultado.usuario);
});

// POST /api/v1/users/me/username
usersRouter.post("/me/username", async (req, res) => {
  const resultado = await guardarPerfil(
    req,
    req.body,
    true
  );

  res.status(resultado.status).json(resultado.usuario);
});

// ---------------------------------------------------------------------------
// US-04: editar el perfil
// ---------------------------------------------------------------------------

// El correo es opcional al editar: si no viene, se deja el que ya tiene.
// Devuelve el correo en minúsculas, o undefined si no se mandó.
function validarCorreo(body: unknown): string | undefined {
  const crudo = (body as { correo?: unknown } | null)?.correo;

  if (crudo === undefined || crudo === "") return undefined;

  const correo = typeof crudo === "string" ? crudo.trim().toLowerCase() : "";
  const esValido = correo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

  if (!esValido) {
    const error = new AppError(400, "Revisa los campos marcados.", "VALIDATION");
    Object.assign(error, { fields: { correo: "Escribe un correo válido." } });
    throw error;
  }

  return correo;
}

// Paso 1 del cambio de correo: comprueba que sea posible y que nadie más lo use.
async function revisarCambioDeCorreo(req: Request, correoNuevo: string) {
  // Con Google el correo lo manda Google: no se puede cambiar desde aquí.
  if (req.authProvider !== "password") {
    throw new AppError(
      403,
      "Con una cuenta de Google no se puede cambiar el correo.",
      "EMAIL_CHANGE_NOT_ALLOWED"
    );
  }

  try {
    const otraPersona = await getAuth().getUserByEmail(correoNuevo);
    if (otraPersona.uid !== req.uid) {
      throw new AppError(409, "Ese correo ya está registrado. Usa otro.", "EMAIL_TAKEN");
    }
  } catch (error) {
    // "No existe nadie con ese correo" es lo que queremos: el correo está libre.
    const noExiste = (error as { code?: string }).code === "auth/user-not-found";
    if (!noExiste) throw error;
  }
}

// PATCH /api/v1/users/me  → edita nombres, apellidos, avatar, username y (opcional) correo
usersRouter.patch("/me", async (req, res) => {
  if (!req.uid) {
    throw new AppError(401, "Debes iniciar sesión.", "UNAUTHENTICATED");
  }

  const uid = req.uid;
  const datos = validarPerfil(req.body);
  const correoNuevo = validarCorreo(req.body);

  const userRef = db.collection("users").doc(uid);
  const usernameNuevoRef = db.collection("usernames").doc(datos.username.toLowerCase());

  const antes = (await userRef.get()).data();
  if (!antes?.username) {
    throw new AppError(404, "Primero completa tu perfil.", "PROFILE_INCOMPLETE");
  }

  const cambiaElCorreo = correoNuevo !== undefined && correoNuevo !== antes.email;
  if (cambiaElCorreo) {
    await revisarCambioDeCorreo(req, correoNuevo);
  }

  // Paso 2: guardar en Firestore. Todo ocurre junto: o se guarda todo o no se guarda nada.
  const perfil = await db.runTransaction(async (tx) => {
    const usuario = (await tx.get(userRef)).data() ?? {};
    const usernameNuevo = await tx.get(usernameNuevoRef);

    // El username nuevo no puede ser de otra persona.
    if (usernameNuevo.exists && usernameNuevo.data()?.uid !== uid) {
      throw new AppError(409, "Ese nombre de usuario ya existe. Elige otro.", "USERNAME_TAKEN");
    }

    // Si cambió de username, se libera el anterior y se reserva el nuevo.
    const usernameAnterior = String(usuario.username).toLowerCase();
    if (usernameAnterior !== usernameNuevoRef.id) {
      tx.delete(db.collection("usernames").doc(usernameAnterior));
      tx.set(usernameNuevoRef, { uid, username: usernameNuevoRef.id });
    }

    const actualizado = {
      ...usuario,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      displayName: `${datos.nombres} ${datos.apellidos}`,
      username: usernameNuevoRef.id,
      avatar: datos.avatar,
      email: cambiaElCorreo ? correoNuevo : usuario.email,
      updatedAt: new Date().toISOString()
    };

    tx.set(userRef, actualizado);
    return actualizado;
  });

  // Paso 3: si cambió el correo, también se cambia en Firebase Auth (el que usa para ingresar).
  if (cambiaElCorreo) {
    try {
      await getAuth().updateUser(uid, { email: correoNuevo });
    } catch (error) {
      // Si falla, se deja el correo anterior en Firestore para que no queden dos distintos.
      await userRef.update({ email: antes.email });
      const yaExiste = (error as { code?: string }).code === "auth/email-already-exists";
      if (yaExiste) {
        throw new AppError(409, "Ese correo ya está registrado. Usa otro.", "EMAIL_TAKEN");
      }
      throw error;
    }
  }

  res.status(200).json(usuarioFrontend(uid, perfil));
});
