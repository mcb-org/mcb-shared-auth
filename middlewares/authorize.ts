import type { Response, NextFunction } from "express";
import { AppError } from "../utils";
import type { AuthenticatedRequest } from "./authenticate";

export const authorize =
  (...roles: Array<string | number>) =>
  (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const role = (req.user as Record<string, unknown> | undefined)?.role;
    if (roles.length === 0) return next();
    if (!role || !roles.includes(role as string)) {
      return next(new AppError("Forbidden", 403));
    }
    return next();
  };
