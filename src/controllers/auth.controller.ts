
import type { Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { getUser } from "../repositories/user.repository.js";
import {
  createGoogleProfile,
  createEmailProfile,
  assignUsername,
} from "../services/auth.service.js";

export async function registerGoogle(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.uid || !req.authEmail) {
    throw new AppError(
      401,
      "Usuario no autenticado.",
      "UNAUTHENTICATED"
    );
  }

  const user = await createGoogleProfile(
    req.uid,
    req.authEmail,
    req.authName,
    req.authPhoto
  );

  res.status(200).json({ user });
}

export async function registerEmail(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.uid || !req.authEmail) {
    throw new AppError(
      401,
      "Usuario no autenticado.",
      "UNAUTHENTICATED"
    );
  }

  const user = await createEmailProfile(
    req.uid,
    req.authEmail
  );

  res.status(201).json({ user });
}

export async function getCurrentUser(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.uid) {
    throw new AppError(
      401,
      "Usuario no autenticado.",
      "UNAUTHENTICATED"
    );
  }

  const user = await getUser(req.uid);

  if (!user) {
    throw new AppError(
      404,
      "Usuario no encontrado.",
      "USER_NOT_FOUND"
    );
  }

  res.status(200).json({ user });
}

export async function updateUsername(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.uid) {
    throw new AppError(
      401,
      "Usuario no autenticado.",
      "UNAUTHENTICATED"
    );
  }

  if (typeof req.body?.username !== "string") {
    throw new AppError(
      400,
      "El username es obligatorio.",
      "INVALID_USERNAME"
    );
  }

  const user = await assignUsername(
    req.uid,
    req.body.username
  );

  res.status(200).json({ user });
}
