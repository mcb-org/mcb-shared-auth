import { createHash } from "crypto";

/**
 * Hash a token for storage (never store raw tokens in DB)
 */
export const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};
