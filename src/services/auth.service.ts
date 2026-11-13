
import { AppError } from "../errors/AppError.js";

import {
  getUser,
  saveProfile,
  reserveUsername,
  type UserProfile,
} from "../repositories/user.repository.js";

export async function createGoogleProfile(
  uid: string,
  email: string,
  displayName?: string,
  photoURL?: string
): Promise<UserProfile> {
  const existing = await getUser(uid);
  const now = new Date().toISOString();

  const profile: UserProfile = {
    uid,
    email,
    username: existing?.username ?? null,
    displayName:
      displayName ?? existing?.displayName ?? null,
    photoURL:
      photoURL ?? existing?.photoURL ?? null,
    provider: "google",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await saveProfile(profile);

  return profile;
}

export async function createEmailProfile(
  uid: string,
  email: string
): Promise<UserProfile> {
  const existing = await getUser(uid);

  if (existing) return existing;

  const now = new Date().toISOString();

  const profile: UserProfile = {
    uid,
    email,
    username: null,
    displayName: null,
    photoURL: null,
    provider: "password",
    createdAt: now,
    updatedAt: now,
  };

  await saveProfile(profile);

  return profile;
}

export async function assignUsername(
  uid: string,
  username: string
): Promise<UserProfile> {
  const clean = username.trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
    throw new AppError(
      400,
      "El username debe tener entre 3 y 20 caracteres.",
      "INVALID_USERNAME"
    );
  }

  try {
    await reserveUsername(uid, clean);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USERNAME_TAKEN") {
        throw new AppError(
          409,
          "El username ya está en uso.",
          "USERNAME_TAKEN"
        );
      }

      if (error.message === "PROFILE_NOT_FOUND") {
        throw new AppError(
          404,
          "Primero debes crear tu perfil.",
          "PROFILE_NOT_FOUND"
        );
      }

      if (error.message === "USERNAME_ALREADY_SET") {
        throw new AppError(
          409,
          "El usuario ya tiene un username.",
          "USERNAME_ALREADY_SET"
        );
      }
    }

    throw error;
  }

  const profile = await getUser(uid);

  if (!profile) {
    throw new AppError(
      404,
      "Perfil no encontrado.",
      "PROFILE_NOT_FOUND"
    );
  }

  return profile;
}
