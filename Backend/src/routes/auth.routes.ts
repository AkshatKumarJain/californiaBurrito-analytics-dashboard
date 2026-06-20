import { Router } from "express";

import {
  loginController,
  meController,
  registerController,
} from "../controllers/auth.controller";
import { attachUser } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(registerController));
authRouter.post("/login", asyncHandler(loginController));
authRouter.get("/me", attachUser, asyncHandler(meController));
