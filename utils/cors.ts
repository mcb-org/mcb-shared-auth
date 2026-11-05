import { logger } from "./logger";

/**
 * Browser access rules shared by every service, so each UI can call its own
 * client directly (for example the billing UI on :3001 calling the billing
 * client on :8081) and nothing else can.
 *
 * Note that `cors({ origin: ["*"] })` does NOT allow everything: inside a list
 * the cors package treats "*" as a literal origin, which matches no browser.
 * That is what every service had before, and why direct UI calls failed.
 */

/**
 * Reads a comma-separated origin list (normally the CORS_ORIGINS variable),
 * falling back to `defaults` when it is unset or empty. Origins are compared
 * exactly, so they must include scheme and port and have no trailing slash.
 */
export const parseOrigins = (
  raw: string | undefined,
  defaults: string[] = [],
): string[] => {
  const listed = (raw ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const origins = listed.length > 0 ? listed : defaults;

  if (origins.includes("*")) {
    // A wildcard cannot be combined with credentials, and in production it
    // would let any website call the API from a signed-in user's browser.
    logger.warn(
      'CORS_ORIGINS contains "*", which is ignored. List the UI origins explicitly.',
    );
  }
  return origins.filter((origin) => origin !== "*");
};

/**
 * Options for the `cors` middleware (and the same shape works for Socket.IO's
 * `cors` setting). Requests without an Origin header
 * (server-to-server calls, curl, health checks) are unaffected; a browser
 * request from an origin not in the list gets no CORS headers and is blocked
 * by the browser.
 */
export type BrowserAccess = {
  origin: string[] | false;
  credentials: boolean;
};

export const corsOptions = (origins: string[]): BrowserAccess => ({
  origin: origins.length > 0 ? origins : false,
  credentials: true,
});
