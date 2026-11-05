import type { Request, Response, NextFunction } from "express";
import { AppError } from "./appError";
import { logger } from "./logger";

const DEFAULT_TIMEOUT_MS = 10_000;

/** Request headers the auth service needs from the original caller. */
const FORWARDED_HEADERS = [
  "authorization",
  "cookie",
  "user-agent",
  "x-correlation-id",
];

/**
 * Handlers that let a client expose the auth endpoints under its own prefix
 * (/api/v1/billing/auth/login and so on), so its UI only ever talks to one
 * service. They hold no auth logic: each request goes to mcb-auth-service and
 * its response comes back unchanged, including the status, body and any
 * Set-Cookie headers. Only the auth service issues tokens.
 *
 * The caller's Authorization header and cookies are forwarded as they are, and
 * if the auth service is unreachable or too slow the caller gets a plain 502;
 * the underlying error is logged, never returned, because it can name internal
 * hosts.
 */
export const authProxy = (
  authServiceUrl: string,
  options: { timeoutMs?: number } = {},
) => {
  const base = authServiceUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const forward =
    (endpoint: string, method: "GET" | "POST") =>
    async (req: Request, res: Response, next: NextFunction) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      for (const name of FORWARDED_HEADERS) {
        const value = req.headers[name];
        if (typeof value === "string") headers[name] = value;
      }

      let upstream: globalThis.Response;
      let text: string;
      try {
        upstream = await fetch(`${base}/api/v1/auth/auth/${endpoint}`, {
          method,
          headers,
          body: method === "POST" ? JSON.stringify(req.body ?? {}) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        });
        text = await upstream.text();
      } catch (error) {
        logger.error(
          `Auth service request failed (${endpoint}): ${error instanceof Error ? error.message : String(error)}`,
        );
        return next(new AppError("Auth service unavailable", 502));
      }

      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("content-type", contentType);
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length > 0) res.setHeader("set-cookie", cookies);
      return res.status(upstream.status).send(text);
    };

  return {
    register: forward("register", "POST"),
    login: forward("login", "POST"),
    refresh: forward("refresh", "POST"),
    logout: forward("logout", "POST"),
    me: forward("me", "GET"),
  };
};
