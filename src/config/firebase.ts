// Inicializa Firebase Admin SDK con una service account tomada de variables de entorno.
// El Admin SDK ignora las reglas de seguridad de Firestore: por eso SOLO el backend lo usa
// y los clientes (navegador) tienen el acceso directo denegado en firestore.rules.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });

export const db = getFirestore(app);
