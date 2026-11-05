import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Request, Response } from "express";
import { authProxy } from "../index";

type Seen = {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
};
let seen: Seen;
let authUrl: string;
let server: http.Server;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seen = { method: req.method, url: req.url, headers: req.headers, body };
      if (req.url?.endsWith("/me")) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end('{"state":"fail","message":"Authentication required"}');
        return;
      }
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": ["access_token=a; HttpOnly", "refresh_token=r; HttpOnly"],
      });
      res.end('{"success":true,"tokens":{"accessToken":"a"}}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  authUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const run = async (
  handler: (
    req: Request,
    res: Response,
    next: (e?: unknown) => void,
  ) => unknown,
  req: Partial<Request>,
) => {
  const out: {
    status?: number;
    body?: string;
    headers: Record<string, unknown>;
    error?: { statusCode?: number; message?: string };
  } = { headers: {} };
  const res = {
    setHeader(name: string, value: unknown) {
      out.headers[name] = value;
      return this;
    },
    status(code: number) {
      out.status = code;
      return this;
    },
    send(body: string) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  await handler({ headers: {}, ...req } as Request, res, (error) => {
    out.error = error as typeof out.error;
  });
  return out;
};

test("login goes to the auth service's login with the caller's body", async () => {
  await run(authProxy(authUrl).login, {
    body: { email: "a@b.co", password: "x" },
  });
  assert.equal(seen.method, "POST");
  assert.equal(seen.url, "/api/v1/auth/auth/login");
  assert.deepEqual(JSON.parse(seen.body), { email: "a@b.co", password: "x" });
});

test("a trailing slash on the service URL does not break the path", async () => {
  await run(authProxy(`${authUrl}/`).refresh, { body: {} });
  assert.equal(seen.url, "/api/v1/auth/auth/refresh");
});

test("the response comes back unchanged, including every Set-Cookie", async () => {
  const out = await run(authProxy(authUrl).login, { body: {} });
  assert.equal(out.status, 200);
  assert.equal(out.body, '{"success":true,"tokens":{"accessToken":"a"}}');
  assert.equal(out.headers["content-type"], "application/json");
  assert.deepEqual(out.headers["set-cookie"], [
    "access_token=a; HttpOnly",
    "refresh_token=r; HttpOnly",
  ]);
});

test("an error status from the auth service is passed through, not turned into a 502", async () => {
  const out = await run(authProxy(authUrl).me, {});
  assert.equal(out.status, 401);
  assert.equal(out.error, undefined);
});

test("me is a GET with no body, carrying the caller's token and cookie", async () => {
  await run(authProxy(authUrl).me, {
    headers: { authorization: "Bearer t", cookie: "refresh_token=r" },
  });
  assert.equal(seen.method, "GET");
  assert.equal(seen.body, "");
  assert.equal(seen.headers.authorization, "Bearer t");
  assert.equal(seen.headers.cookie, "refresh_token=r");
});

test("an unreachable auth service is a 502 that hides the connection details", async () => {
  const out = await run(authProxy("http://127.0.0.1:1").login, { body: {} });
  assert.equal(out.error?.statusCode, 502);
  assert.equal(out.error?.message, "Auth service unavailable");
});

test("a hung auth service times out as a 502 instead of hanging the request", async () => {
  const silent = http.createServer(() => undefined);
  await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(silent.address() as AddressInfo).port}`;
  const timedOut = await run(authProxy(url, { timeoutMs: 100 }).login, {
    body: {},
  });
  silent.closeAllConnections();
  silent.close();
  assert.equal(timedOut.error?.statusCode, 502);
});

test("the caller's address is passed on, so users are not counted as one client", async () => {
  await run(authProxy(authUrl).login, { body: {}, ip: "198.51.100.7" });
  assert.equal(seen.headers["x-forwarded-for"], "198.51.100.7");
});
