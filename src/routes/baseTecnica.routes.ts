import { Router } from "express";
import { getBaseTecnica } from "../controllers/baseTecnica.controller.js";

export const baseTecnicaRouter = Router();

baseTecnicaRouter.get("/", getBaseTecnica);
