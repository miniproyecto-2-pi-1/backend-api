
import type {
  Request,
  Response,
  NextFunction
} from "express";

import { db } from "../config/firebase.js";
import { AppError } from "../errors/AppError.js";

export async function requireCompleteProfile(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.uid) {
    next(
      new AppError(
        401,
        "Debes iniciar sesión.",
        "UNAUTHENTICATED"
      )
    );
    return;
  }

  try {
    const userDoc = await db
      .collection("users")
      .doc(req.uid)
      .get();

    const user = userDoc.data();

    if (
      typeof user?.username !== "string" ||
      !user.username.trim()
    ) {
      next(
        new AppError(
          403,
          "Debes completar tu perfil antes de continuar.",
          "PROFILE_INCOMPLETE"
        )
      );
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
