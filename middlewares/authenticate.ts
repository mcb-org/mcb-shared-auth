import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { AppError } from "../utils";

export type AuthenticatedRequest = Request & {
  user?: jwt.JwtPayload & Record<string, unknown>;
};

/**
 * Verifies an access token and returns its claims, or throws.
 *
 * Shared by the HTTP middleware and by Socket.IO handshakes so that every
 * entry point applies the same checks. The algorithm, audience and issuer are
 * pinned to what the auth service signs with, so a token minted for another
 * purpose is not accepted. Refresh tokens share the secret, audience and
 * issuer; only `type` distinguishes them, and one must never act as an access
 * token.
 */
export const verifyAccessToken = (
  token: string,
): jwt.JwtPayload & Record<string, unknown> => {
  // Fail closed. Verifying against String(undefined) would accept tokens
  // signed with the literal secret "undefined".
  if (!JWT_SECRET) {
    throw new AppError("Authentication is not configured", 500);
  }

  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    audience: "mcb-services",
    issuer: "mcb-auth",
  }) as jwt.JwtPayload & Record<string, unknown>;

  if (decoded.type !== "access") {
    throw new AppError("Invalid or expired token", 401);
  }

  return decoded;
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
    req.user = verifyAccessToken(token);
    return next();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 500) {
      return next(error);
    }
    return next(new AppError("Invalid or expired token", 401));
  }
};
