
import type { NextFunction, Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { AppError } from "../errors/AppError.js";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
      authEmail?: string;
      authName?: string;
      authPhoto?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    throw new AppError(
      401,
      "Debes iniciar sesión.",
      "UNAUTHENTICATED"
    );
  }

  try {
    const token = header.slice(7).trim();

    const decoded = await getAuth().verifyIdToken(token);

    req.uid = decoded.uid;
    req.authEmail = decoded.email;
    req.authName = decoded.name;
    req.authPhoto = decoded.picture;

    next();
  } catch {
    throw new AppError(
      401,
      "Token inválido o expirado.",
      "INVALID_TOKEN"
    );
  }
}
