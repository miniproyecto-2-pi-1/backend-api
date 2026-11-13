
import { db } from "../config/firebase.js";

export interface UserProfile {
  uid: string;
  email: string;
  username: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: "google" | "password";
  createdAt: string;
  updatedAt: string;
}

const users = db.collection("users");
const usernames = db.collection("usernames");

export async function getUser(
  uid: string
): Promise<UserProfile | null> {
  const snapshot = await users.doc(uid).get();

  if (!snapshot.exists) return null;

  return snapshot.data() as UserProfile;
}

export async function saveProfile(
  profile: UserProfile
): Promise<void> {
  await users.doc(profile.uid).set(profile, {
    merge: true,
  });
}

export async function reserveUsername(
  uid: string,
  username: string
): Promise<void> {
  const normalized = username.toLowerCase();

  const usernameRef = usernames.doc(normalized);
  const userRef = users.doc(uid);

  await db.runTransaction(async (tx) => {
    const [usernameSnap, userSnap] =
      await Promise.all([
        tx.get(usernameRef),
        tx.get(userRef),
      ]);

    if (!userSnap.exists) {
      throw new Error("PROFILE_NOT_FOUND");
    }

    const currentUsername =
      userSnap.data()?.username;

    if (
      currentUsername &&
      currentUsername !== normalized
    ) {
      throw new Error("USERNAME_ALREADY_SET");
    }

    if (
      usernameSnap.exists &&
      usernameSnap.data()?.uid !== uid
    ) {
      throw new Error("USERNAME_TAKEN");
    }

    tx.set(usernameRef, {
      uid,
      username: normalized,
    });

    tx.update(userRef, {
      username: normalized,
      updatedAt: new Date().toISOString(),
    });
  });
}
