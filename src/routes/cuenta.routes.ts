// US-05: eliminar la cuenta de la persona que tiene la sesión iniciada.

import { Router } from "express";
import { getAuth } from "firebase-admin/auth";
import { db } from "../config/firebase.js";
import { AppError } from "../errors/AppError.js";
import { requireAuth } from "../middlewares/auth.js";

export const cuentaRouter = Router();

cuentaRouter.use(requireAuth);

// DELETE /api/v1/users/me
//
// Política de datos (la que pide US-05):
//   - Se borra el perfil y se libera el username, para que otra persona pueda usarlo.
//   - Se borran las salas que la persona creó, con todos sus mensajes.
//   - Los mensajes que escribió en salas de otras personas se conservan con el nombre
//     que tenían, porque esas salas son de otras personas.
//   - Al final se borra la cuenta de Firebase Auth. Se deja de último a propósito: si algo falla
//     antes, la persona sigue pudiendo ingresar y puede volver a intentarlo (borrar dos veces
//     no causa problemas).
cuentaRouter.delete("/me", async (req, res) => {
  if (!req.uid) {
    throw new AppError(401, "Debes iniciar sesión.", "UNAUTHENTICATED");
  }

  const uid = req.uid;
  const userRef = db.collection("users").doc(uid);

  // 1. Borrar las salas que creó, junto con sus mensajes.
  const salasPropias = await db.collection("rooms").where("ownerUid", "==", uid).get();
  for (const sala of salasPropias.docs) {
    await db.recursiveDelete(sala.ref); // también borra la subcolección de mensajes
  }

  // 2. Borrar el perfil y liberar el username.
  const perfil = (await userRef.get()).data();
  const batch = db.batch();
  batch.delete(userRef);
  if (typeof perfil?.username === "string") {
    batch.delete(db.collection("usernames").doc(perfil.username.toLowerCase()));
  }
  await batch.commit();

  // 3. Borrar la cuenta con la que ingresa (correo y contraseña o Google).
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    // Si la cuenta ya no existía, no hay nada más que borrar.
    const yaNoExiste = (error as { code?: string }).code === "auth/user-not-found";
    if (!yaNoExiste) throw error;
  }

  res.status(204).send();
});
