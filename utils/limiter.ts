import rateLimit from "express-rate-limit";
import "../config";

const DEFAULT_MAX = 600;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

const positive = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Per-caller request limit for a service. It counts each client address, so a
 * service behind the gateway must also trust the gateway (see
 * trustProxySetting), or every user counts as one caller.
 *
 * RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MS override the defaults. The default
 * matches the gateway's per-service limit: field apps on mobile networks share
 * addresses, so a low ceiling throttles real users rather than attackers.
 */
export const limiter = rateLimit({
  max: positive(process.env.RATE_LIMIT_MAX, DEFAULT_MAX),
  windowMs: positive(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    state: "fail",
    message: "Too many requests, please try again later.",
  },
});

/**
 * The value for Express's "trust proxy": which directly connected addresses may
 * state the real client through X-Forwarded-For. By default that is this
 * machine and private networks, where the gateway and the other services run.
 * A caller connecting from a public address is not trusted, so it cannot fake
 * its address with that header.
 *
 * TRUST_PROXY overrides it: a number of hops, "true", "false", or a
 * comma-separated list of addresses or names such as "loopback, uniquelocal".
 */
export const trustProxySetting = (
  raw: string | undefined = process.env.TRUST_PROXY,
): string | number | boolean => {
  const value = raw?.trim();
  if (!value) return "loopback, uniquelocal";
  if (value === "true") return true;
  if (value === "false") return false;
  return /^\d+$/.test(value) ? Number(value) : value;
};
