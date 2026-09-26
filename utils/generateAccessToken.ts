import type { TokenConfig } from "../types";
import type { AccessTokenPayload, TokenUser } from "../types";
import jwt from "jsonwebtoken";

/**
 * Generate a new access token
 *
 * `role` and `tenantId` are signed into the payload because clients authorize
 * and scope data from the token alone, without a database round trip. Empty
 * values are omitted rather than serialized as null.
 */
export const generateAccessToken = (
<<<<<<< HEAD
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    tenantId?: string | null;
  },
=======
  user: TokenUser,
>>>>>>> edfd573 (feat(name-change): tenantId added to here)
  config: TokenConfig,
  jti?: string,
): string => {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name || undefined,
<<<<<<< HEAD
    role: user.role || undefined,
    tenantId: user.tenantId || undefined,
=======
    ...(user.role ? { role: user.role } : {}),
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
>>>>>>> edfd573 (feat(name-change): tenantId added to here)
    type: "access",
    jti,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.accessTokenExpiresIn as jwt.SignOptions["expiresIn"],
    audience: "mcb-services",
    issuer: "mcb-auth",
  });
};
