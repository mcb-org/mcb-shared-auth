import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import jwt from "jsonwebtoken";
import {
  authenticate,
  authorize,
  generateAccessToken,
  verifyAccessToken,
  type AuthenticatedRequest,
} from "../index";

// The test script runs with JWT_SECRET=unit-test-secret.
const SECRET = "unit-test-secret";
const SIGNED = { audience: "mcb-services", issuer: "mcb-auth" };

const sign = (
  payload: object,
  options: jwt.SignOptions = SIGNED,
  secret = SECRET,
) => jwt.sign(payload, secret, options);

const rejects = (token: string) =>
  assert.throws(() => verifyAccessToken(token));

test("the script provides the secret these tests sign with", () => {
  assert.equal(process.env.JWT_SECRET, SECRET);
});

test("a token issued by generateAccessToken verifies and keeps its claims", () => {
  const token = generateAccessToken(
    { id: "u1", email: "a@b.co", role: "DISPATCHER", tenantId: "t1" },
    { jwtSecret: SECRET, accessTokenExpiresIn: "5m" } as never,
  );
  const claims = verifyAccessToken(token);
  assert.equal(claims.sub, "u1");
  assert.equal(claims.role, "DISPATCHER");
  assert.equal(claims.tenantId, "t1");
});

test("a refresh token is never accepted as an access token", () => {
  rejects(sign({ sub: "u1", type: "refresh" }));
  rejects(sign({ sub: "u1" }));
});

test("audience, issuer, secret and expiry are all enforced", () => {
  rejects(
    sign(
      { sub: "u1", type: "access" },
      { audience: "other", issuer: "mcb-auth" },
    ),
  );
  rejects(
    sign(
      { sub: "u1", type: "access" },
      { audience: "mcb-services", issuer: "evil" },
    ),
  );
  rejects(sign({ sub: "u1", type: "access" }, SIGNED, "wrong-secret"));
  rejects(sign({ sub: "u1", type: "access" }, { ...SIGNED, expiresIn: -10 }));
});

test('an unsigned "alg: none" token is rejected', () => {
  rejects(
    jwt.sign({ sub: "u1", type: "access" }, "", {
      ...SIGNED,
      algorithm: "none",
    }),
  );
});

test('with no JWT_SECRET configured, nothing verifies (not even a token signed with "undefined")', () => {
  // Config is read at import, so this runs in a child process without the secret.
  const token = sign({ sub: "u1", type: "access" }, SIGNED, "undefined");
  const script = `
    const { verifyAccessToken } = require(${JSON.stringify(require.resolve("../index"))});
    try { verifyAccessToken(${JSON.stringify(token)}); console.log("ACCEPTED"); }
    catch (e) { console.log("rejected: " + e.message); }`;
  const env = { ...process.env };
  delete env.JWT_SECRET;
  const out = execFileSync(process.execPath, ["-e", script], {
    env,
  }).toString();
  assert.match(out, /rejected: Authentication is not configured/);
});

const run = (
  middleware: (
    req: AuthenticatedRequest,
    res: never,
    next: (e?: unknown) => void,
  ) => void,
  req: Partial<AuthenticatedRequest>,
) =>
  new Promise<{ error?: { statusCode?: number }; req: AuthenticatedRequest }>(
    (resolve) => {
      const r = { headers: {}, ...req } as AuthenticatedRequest;
      middleware(r, undefined as never, (error?: unknown) =>
        resolve({
          error: error as { statusCode?: number } | undefined,
          req: r,
        }),
      );
    },
  );

test("authenticate: no token is a 401, a valid one sets req.user", async () => {
  assert.equal((await run(authenticate, {})).error?.statusCode, 401);
  const token = sign({ sub: "u1", type: "access", role: "USER" });
  const ok = await run(authenticate, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(ok.error, undefined);
  assert.equal(ok.req.user?.sub, "u1");
});

test("authenticate: a refresh token in the header is a 401", async () => {
  const token = sign({ sub: "u1", type: "refresh" });
  const result = await run(authenticate, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(result.error?.statusCode, 401);
});

test("authorize: only the listed roles pass", async () => {
  const gate = authorize("HR_MANAGER", "SUPER_ADMIN");
  assert.equal(
    (await run(gate, { user: { role: "HR_MANAGER" } })).error,
    undefined,
  );
  assert.equal(
    (await run(gate, { user: { role: "DRIVER" } })).error?.statusCode,
    403,
  );
  assert.equal((await run(gate, { user: {} })).error?.statusCode, 403);
});
