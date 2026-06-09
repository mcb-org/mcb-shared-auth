import type { RefreshTokenPayload, TokenConfig } from "../types";
import jwt from "jsonwebtoken";
import { hashToken } from "./hashToken";

/**
 * Generate a new refresh token (returns both the raw token and its hash)
 */
export const generateRefreshToken = (
  user: { id: string },
  config: TokenConfig,
  tokenId: string,
): { token: string; hashedToken: string } => {
  const payload: RefreshTokenPayload = {
    sub: user.id,
    type: "refresh",
    jti: tokenId,
  };

  // Use refresh token secret if provided, otherwise use main secret
  const secret = config.refreshTokenSecret || config.jwtSecret;

  const token = jwt.sign(payload, secret, {
    expiresIn: config.refreshTokenExpiresIn as jwt.SignOptions["expiresIn"],
    audience: "mcb-services",
    issuer: "mcb-auth",
  });

  return {
    token,
    hashedToken: hashToken(token),
  };
};
