// In mcb-shared-auth

import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import type {
  RefreshTokenPayload,
  RevokeAllUserTokensParams,
  RotateRefreshTokenParams,
  RotateRefreshTokenResult,
  TokenConfig,
} from "../types";
import { generateTokenPair } from "./generateTokenPair";

/**
 * Verify and decode refresh token
 */
const verifyRefreshToken = async (
  token: string,
  config: TokenConfig,
): Promise<RefreshTokenPayload> => {
  try {
    const secret = config.refreshTokenSecret || config.jwtSecret;
    const decoded = jwt.verify(token, secret, {
      audience: "mcb-services",
      issuer: "mcb-auth",
    }) as RefreshTokenPayload;

    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    return decoded;
  } catch (error: unknown) {
    throw new Error("Invalid refresh token: " + (error as Error).message);
  }
};

/**
 * Find and validate stored refresh token
 */
const findAndValidateStoredToken = async (
  token: string,
  jti: string,
  repo: RotateRefreshTokenParams["repo"],
) => {
  const hashedToken = createHash("sha256").update(token).digest("hex");

  const storedToken = await repo.findById(jti);

  if (!storedToken) {
    throw new Error("Refresh token not found");
  }

  // Check if token matches
  if (storedToken.token !== hashedToken) {
    throw new Error("Token mismatch");
  }

  // Check if token is revoked
  if (storedToken.revokedAt) {
    throw new Error("Token has been revoked");
  }

  // Check if token has been replaced
  if (storedToken.replacedBy) {
    throw new Error("Token has already been used (possible replay attack)");
  }

  // Check if token is expired
  if (storedToken.expiresAt < new Date()) {
    throw new Error("Refresh token expired");
  }

  return storedToken;
};

/**
 * Mark old token as replaced
 */
const markTokenAsReplaced = async (
  oldTokenId: string,
  newTokenId: string,
  repo: RotateRefreshTokenParams["repo"],
) => {
  await repo.update(oldTokenId, {
    replacedBy: newTokenId,
    lastUsedAt: new Date(),
  });
};

/**
 * Update last used timestamp
 */
const updateTokenLastUsed = async (
  tokenId: string,
  ipAddress?: string,
  repo?: RotateRefreshTokenParams["repo"],
) => {
  if (repo) {
    await repo.update(tokenId, {
      lastUsedAt: new Date(),
      ipAddress,
    });
  }
};

/**
 * Main function to rotate refresh token
 */
export const rotateRefreshToken = async ({
  oldRefreshToken,
  deviceInfo,
  ipAddress,
  config,
  repo,
}: RotateRefreshTokenParams): Promise<RotateRefreshTokenResult> => {
  try {
    // 1. Verify the old refresh token
    const decoded = await verifyRefreshToken(oldRefreshToken, config);

    // 2. Find and validate stored token
    const storedToken = await findAndValidateStoredToken(
      oldRefreshToken,
      decoded.jti,
      repo,
    );

    // 3. Generate new token pair
    const newTokens = await generateTokenPair({
      user: storedToken.user!,
      deviceInfo: deviceInfo || storedToken.deviceInfo,
      ipAddress: ipAddress || storedToken.ipAddress,
      config,
      repo,
    });

    // 4. Decode new refresh token to get its JTI
    const newDecoded = jwt.decode(
      newTokens.refreshToken,
    ) as RefreshTokenPayload;

    // 5. Mark old token as replaced
    await markTokenAsReplaced(storedToken.id, newDecoded.jti, repo);

    // 6. Update last used on old token (optional, can be omitted if replaced)
    await updateTokenLastUsed(storedToken.id, ipAddress, repo);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      userId: storedToken.userId,
    };
  } catch (error) {
    // Log security events for monitoring
    console.error("Token rotation failed:", {
      error: (error as Error).message,
      ipAddress,
      deviceInfo,
      timestamp: new Date().toISOString(),
    });

    throw new Error(`Token rotation failed: ${(error as Error).message}`);
  }
};

/**
 * Revoke all tokens for a user
 */
export const revokeAllUserTokens = async ({
  userId,
  excludeTokenId,
  reason = "security",
  repo,
}: RevokeAllUserTokensParams): Promise<number> => {
  try {
    const where: any = {
      userId,
      revokedAt: null,
    };

    if (excludeTokenId) {
      where.id = { not: excludeTokenId };
    }

    const result = await repo.updateMany(where, { revokedAt: new Date() });

    // Log security event
    console.log("Tokens revoked:", {
      userId,
      count: result.count,
      reason,
      timestamp: new Date().toISOString(),
    });

    return result.count;
  } catch (error: unknown) {
    throw new Error(
      `Failed to revoke user tokens: ${(error as Error).message}`,
    );
  }
};
