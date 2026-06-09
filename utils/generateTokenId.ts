import { randomBytes } from "crypto";

/**
 * Generate a unique token ID
 */
export const generateTokenId = (): string => {
  return randomBytes(32).toString("hex");
};
