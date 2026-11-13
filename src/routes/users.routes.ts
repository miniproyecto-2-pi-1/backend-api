import { Router } from "express";
import type { Request } from "express";
import { db } from "../config/firebase.js";
import { AppError } from "../errors/AppError.js";
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
