import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import {
  corsOptions,
  findEnvProblems,
  parseOrigins,
  readyHandler,
} from "../index";

test("CORS origins: defaults apply when unset, trailing slashes are trimmed", () => {
  assert.deepEqual(parseOrigins(undefined, ["http://localhost:3001"]), [
    "http://localhost:3001",
  ]);
  assert.deepEqual(parseOrigins(" http://a.com/ , http://b.com", ["x"]), [
    "http://a.com",
    "http://b.com",
  ]);
});

test('CORS origins: "*" is ignored, and an empty list allows no browser origin', () => {
  assert.deepEqual(parseOrigins("*", ["x"]), []);
  assert.deepEqual(corsOptions([]), { origin: false, credentials: true });
  assert.deepEqual(corsOptions(["http://a.com"]), {
    origin: ["http://a.com"],
    credentials: true,
  });
});

const spec = {
  service: "svc",
  required: ["DATABASE_URL", "JWT_SECRET"],
  secrets: ["JWT_SECRET"],
};

test("env validation names every missing variable", () => {
  assert.deepEqual(findEnvProblems(spec, {}), [
    "DATABASE_URL is not set",
    "JWT_SECRET is not set",
  ]);
});

test("env validation rejects a non-numeric PORT", () => {
  assert.equal(
    findEnvProblems(spec, { DATABASE_URL: "x", JWT_SECRET: "y", PORT: "80a" })
      .length,
    1,
  );
});

test("weak secrets are fine in development and refused in production", () => {
  const env = { DATABASE_URL: "x", JWT_SECRET: "short" };
  assert.deepEqual(findEnvProblems(spec, env), []);
  assert.equal(
    findEnvProblems(spec, { ...env, NODE_ENV: "production" }).length,
    1,
  );
  assert.equal(
    findEnvProblems(spec, {
      ...env,
      NODE_ENV: "production",
      JWT_SECRET: "changeme",
    }).length,
    1,
  );
  assert.deepEqual(
    findEnvProblems(spec, {
      ...env,
      NODE_ENV: "production",
      JWT_SECRET: "a".repeat(40),
    }),
    [],
  );
});

const respond = async (handler: (req: Request, res: Response) => unknown) => {
  const out: { status?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  await handler({} as Request, res);
  return out;
};

test("readiness is 200 when every check passes", async () => {
  const r = await respond(readyHandler("svc", { database: async () => 1 }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body?.checks, { database: "up" });
});

test("readiness is 503 on a failed or hung check, and never leaks the error", async () => {
  const failed = await respond(
    readyHandler("svc", {
      database: async () => {
        throw new Error("password=hunter2");
      },
    }),
  );
  assert.equal(failed.status, 503);
  assert.ok(!JSON.stringify(failed.body).includes("hunter2"));

  const hung = await respond(
    readyHandler("svc", { database: () => new Promise(() => undefined) }, 50),
  );
  assert.equal(hung.status, 503);
});
