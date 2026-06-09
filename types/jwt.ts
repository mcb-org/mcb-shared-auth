export interface AccessTokenPayload {
  sub: string; // subject (user id)
  email: string;
  name?: string;
  type: "access";
  jti?: string; // JWT ID for tracking
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  jti: string; // Required for token tracking
}

export interface TokenConfig {
  accessTokenExpiresIn: string | number;
  refreshTokenExpiresIn: string | number;
  jwtSecret: string;
  refreshTokenSecret?: string; // optional separate secret for refresh tokens
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string; // hashed token
  deviceInfo?: string;
  ipAddress?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  lastUsedAt?: Date | null;
  user?: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export interface RefreshTokenRepository {
  create(record: RefreshTokenRecord): Promise<void>;
  findById(id: string): Promise<RefreshTokenRecord | null>;
  update(id: string, data: Partial<RefreshTokenRecord>): Promise<void>;
  updateMany(
    where: { userId: string; revokedAt?: null; id?: { not: string } },
    data: { revokedAt: Date },
  ): Promise<{ count: number }>;
}

export interface GenerateTokenPairParams {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  deviceInfo?: string;
  ipAddress?: string;
  config: TokenConfig;
  repo: RefreshTokenRepository;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RevokeAllUserTokensParams {
  userId: string;
  excludeTokenId?: string; // optional token to exclude (current session)
  reason?: "password_change" | "security" | "admin_revocation";
  repo: RefreshTokenRepository;
}

export interface RotateRefreshTokenParams {
  oldRefreshToken: string;
  deviceInfo?: string;
  ipAddress?: string;
  config: TokenConfig;
  repo: RefreshTokenRepository;
}

export interface RotateRefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  userId: string;
}
