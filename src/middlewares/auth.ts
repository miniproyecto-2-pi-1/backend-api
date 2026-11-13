
import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { getAuth } from "firebase-admin/auth";
import { AppError } from "../errors/AppError.js";

declare global {
  namespace Express {
    interface Request {
      uid?: string;
      authEmail?: string;
      authName?: string;
      authPhoto?: string;
      authProvider?: string;
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
    req.authProvider = decoded.firebase.sign_in_provider;
  } catch {
    throw new AppError(
      401,
      "Token inválido o expirado.",
      "INVALID_TOKEN"
    );
  }

  next();
}

export function requireGoogle(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.authProvider !== "google.com") {
    throw new AppError(
      403,
      "Debes iniciar sesión con Google.",
      "GOOGLE_AUTH_REQUIRED"
    );
  }

  next();
}
