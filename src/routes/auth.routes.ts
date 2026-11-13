
import { Router } from "express";

import {
  registerGoogle,
  registerEmail,
  getCurrentUser,
  updateUsername,
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middlewares/auth.js";

export const authRouter = Router();

authRouter.post(
  "/google/profile",
  requireAuth,
  registerGoogle
);

authRouter.post(
  "/email/profile",
  requireAuth,
  registerEmail
);

authRouter.get(
  "/me",
  requireAuth,
  getCurrentUser
);

authRouter.put(
  "/username",
  requireAuth,
  updateUsername
);
