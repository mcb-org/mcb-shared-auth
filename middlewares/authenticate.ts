import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { AppError } from "../utils";

export type AuthenticatedRequest = Request & {
  user?: jwt.JwtPayload & Record<string, unknown>;
};

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  const token =
    (header && header.startsWith("Bearer ") && header.split(" ")[1]) ||
    (req.headers["x-access-token"] as string | undefined);

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  try {
    const decoded = jwt.verify(token, String(JWT_SECRET)) as jwt.JwtPayload;
    req.user = decoded;
    return next();
  } catch {
    return next(new AppError("Invalid or expired token", 401));
  }
};
