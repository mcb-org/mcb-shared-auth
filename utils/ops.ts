import type { Server } from "http";
import type { Request, Response } from "express";
import { logger } from "./logger";

/**
 * Operational helpers shared by every service: startup env validation,
 * liveness and readiness handlers, and graceful shutdown. They live here so the
 * services behave identically under an orchestrator instead of each growing its
 * own slightly different copy.
 */

const PLACEHOLDER_SECRETS = new Set([
  "secret",
  "changeme",
  "change-me",
  "change_me",
  "password",
  "undefined",
  "jwt_secret",
]);

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export type ValidateEnvOptions = {
  service: string;
  /** Variables that must be set and non-empty. */
  required: string[];
  /** Subset of variables holding secrets; checked for strength in production. */
  secrets?: string[];
};

/**
 * Returns a list of problems with the process environment, empty when it is
 * fine. Pure, so it can be tested without exiting the process.
 */
export const findEnvProblems = (
  { required, secrets = [] }: ValidateEnvOptions,
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  const problems: string[] = [];

  for (const name of required) {
    if (!env[name]?.trim()) problems.push(`${name} is not set`);
  }

  const port = env.PORT?.trim();
  if (port && !/^\d+$/.test(port))
    problems.push(
      "PORT must be a number (it is not, so the server would bind to a random port)",
    );

  if (env.NODE_ENV === "production") {
    for (const name of secrets) {
      const value = env[name]?.trim();
      if (!value) continue; // already reported as missing when required
      if (
        value.length < MIN_PRODUCTION_SECRET_LENGTH ||
        PLACEHOLDER_SECRETS.has(value.toLowerCase())
      ) {
        problems.push(
          `${name} is too weak for production (use at least ${MIN_PRODUCTION_SECRET_LENGTH} random characters)`,
        );
      }
    }
  }

  return problems;
};

/**
 * Fails fast at startup. A service that boots with a missing secret otherwise
 * looks healthy and then fails on every request, which is much harder to spot.
 */
export const validateEnv = (options: ValidateEnvOptions): void => {
  const problems = findEnvProblems(options);
  if (problems.length === 0) return;

  const message = `${options.service} cannot start:\n${problems
    .map((p) => `  - ${p}`)
    .join("\n")}`;
  logger.error(message);
  console.error(message);
  process.exit(1);
};

/** Liveness: the process is up and the event loop is responding. No dependencies. */
export const healthHandler =
  (service: string) => (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service,
      uptimeSeconds: Math.round(process.uptime()),
    });
  };

export type ReadinessChecks = Record<string, () => Promise<unknown>>;

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * Readiness: 200 only when every check passes, otherwise 503. Only list
 * dependencies the service cannot work without (its database). Optional ones
 * such as Redis or Kafka must not appear here, or an outage of a nice-to-have
 * would take the service out of rotation.
 *
 * The body names which checks failed but never the underlying error, which can
 * contain hostnames and credentials.
 */
export const readyHandler =
  (service: string, checks: ReadinessChecks, timeoutMs = 2000) =>
  async (_req: Request, res: Response) => {
    const results: Record<string, "up" | "down"> = {};

    await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          await withTimeout(check(), timeoutMs);
          results[name] = "up";
        } catch (error) {
          results[name] = "down";
          logger.warn(
            `${service} readiness check "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );

    const ready = Object.values(results).every((r) => r === "up");
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "unavailable",
      service,
      checks: results,
    });
  };

/**
 * Stops accepting connections on SIGTERM/SIGINT, lets in-flight requests
 * finish, runs the cleanups (close the database, etc.), then exits. A hard
 * timeout guarantees the process cannot hang a rolling deploy.
 */
export const installGracefulShutdown = (
  server: Server,
  cleanups: Array<() => Promise<unknown> | unknown> = [],
  timeoutMs = 10_000,
): void => {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down`);

    const force = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs);
    force.unref();

    server.close(() => {
      void Promise.allSettled(
        cleanups.map((fn) => Promise.resolve().then(fn)),
      ).then((results) => {
        results.forEach((r) => {
          if (r.status === "rejected")
            logger.warn(`Shutdown cleanup failed: ${String(r.reason)}`);
        });
        process.exit(0);
      });
    });

    // Idle keep-alive connections would otherwise hold server.close() open.
    server.closeIdleConnections?.();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};
