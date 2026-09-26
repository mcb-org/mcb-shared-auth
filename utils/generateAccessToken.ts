import type { TokenConfig } from "../types";
import type { AccessTokenPayload } from "../types";
import jwt from "jsonwebtoken";

/**
 * Generate a new access token
 *
 * `role` and `tenantId` are signed into the payload because clients authorize
 * and scope data from the token alone, without a database round trip. Empty
 * values are omitted rather than serialized as null.
 */
export const generateAccessToken = (
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    tenantId?: string | null;
  },
  config: TokenConfig,
  jti?: string,
): string => {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role || undefined,
    tenantId: user.tenantId || undefined,
    type: "access",
    jti,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn as jwt.SignOptions["expiresIn"],
    audience: "mcb-services",
    issuer: "mcb-auth",
  });
};
