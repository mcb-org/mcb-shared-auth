import type { TokenConfig } from "../types";
import type { AccessTokenPayload } from "../types";
import jwt from "jsonwebtoken";

/**
 * Generate a new access token
 */
export const generateAccessToken = (
  user: { id: string; email: string; name?: string | null },
  config: TokenConfig,
  jti?: string,
): string => {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name || undefined,
    type: "access",
    jti,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn as jwt.SignOptions["expiresIn"],
    audience: "mcb-services",
    issuer: "mcb-auth",
  });
};
