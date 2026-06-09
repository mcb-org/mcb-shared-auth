import type {
  GenerateTokenPairParams,
  TokenPair,
  RefreshTokenRecord,
} from "../types";
import { generateRefreshToken } from "./generateRefreshToken";
import { generateAccessToken } from "./generateAccessToken";
import { generateTokenId } from "./generateTokenId";

/**
 * Store the refresh token in the database
 */
const storeRefreshToken = async (
  tokenData: RefreshTokenRecord,
  repo: GenerateTokenPairParams["repo"],
) => {
  await repo.create(tokenData);
};

export const generateTokenPair = async ({
  user,
  deviceInfo,
  ipAddress,
  config,
  repo,
}: GenerateTokenPairParams): Promise<TokenPair> => {
  try {
    // Generate unique token ID for refresh token
    const tokenId = generateTokenId();

    // Generate refresh token (raw and hashed)
    const { token: refreshToken, hashedToken } = generateRefreshToken(
      user,
      config,
      tokenId,
    );

    // Store refresh token in database
    await storeRefreshToken(
      {
        id: tokenId,
        userId: user.id,
        token: hashedToken,
        deviceInfo,
        ipAddress,
        expiresAt:
          typeof config.refreshTokenExpiresIn === "number"
            ? new Date(Date.now() + config.refreshTokenExpiresIn * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        replacedBy: null,
        lastUsedAt: null,
      },
      repo,
    );

    // Generate access token with optional reference to refresh token
    const accessToken = generateAccessToken(user, config, tokenId);

    return {
      accessToken,
      refreshToken,
    };
  } catch (error: unknown) {
    throw new Error(
      `Failed to generate token pair: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
