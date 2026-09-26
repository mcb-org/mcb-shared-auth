/**
 * The user shape that token utilities accept.
 *
 * `role` and `tenantId` are authorization claims, not decoration: `authorize`
 * reads `role` and every client scopes data by `tenantId`, so they must survive
 * both initial issuance and refresh rotation. Persistence shape (Prisma) allows
 * nulls; the signed payload omits empty values.
 */
export interface TokenUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  tenantId?: string | null;
}

export interface AccessTokenPayload {
  sub: string; // subject (user id)
  email: string;
  name?: string;
<<<<<<< HEAD
  role?: string; // platform/tenant role (e.g. SUPER_ADMIN, ORG_ADMIN, DRIVER, USER)
  tenantId?: string; // tenant scope for multi-tenant data access
=======
  role?: string; // authorization claim consumed by authorize()
  tenantId?: string; // tenancy claim used to scope every query
>>>>>>> edfd573 (feat(name-change): tenantId added to here)
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
<<<<<<< HEAD
  user?: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    tenantId?: string | null;
  };
=======
  user?: TokenUser;
>>>>>>> edfd573 (feat(name-change): tenantId added to here)
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
<<<<<<< HEAD
  user: {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    tenantId?: string | null;
  };
=======
  user: TokenUser;
>>>>>>> edfd573 (feat(name-change): tenantId added to here)
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
