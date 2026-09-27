# @medi-car-bd/mcb-shared-auth

Shared authentication library for the Medi Car BD microservices platform.

One implementation of JWT issuance, refresh-token rotation and role-based
authorization, used by every backend service. When a service and the API
gateway disagree about what a valid token is, the disagreement becomes an
authentication bug — this package exists to make that impossible.

**It is a library, not a service.** It has no database, no HTTP server and no
ORM. You inject the persistence it needs through an interface, which is what
lets the auth service own a database while every other service owns none.

Currently at **v0.0.8**. Used in production across `mcb-auth-service`,
`mcb-api-gateway`, `mcb-hrm-client`, `mcb-org-client`, `mcb-billing-client` and
`mcb-dashboard-client`.

## Install

```bash
pnpm add @medi-car-bd/mcb-shared-auth
# or
npm install @medi-car-bd/mcb-shared-auth
```

Requires **Express 4** as a peer dependency (`^4.18.2`). The package targets
CommonJS and ships type declarations.

## Quick start

### Protect a route

```ts
import {
  authenticate,
  authorize,
  type AuthenticatedRequest,
} from "@medi-car-bd/mcb-shared-auth";

router.get("/employees", authenticate, authorize("HR_MANAGER"), handler);

const handler = (req: AuthenticatedRequest, res: Response) => {
  const { sub: userId, role, tenantId } = req.user!;
  // ...
};
```

`authenticate` accepts a `Bearer` token or an `x-access-token` header, and puts
the decoded claims on `req.user`. `authorize(...)` is a role guard that returns
`403` when the caller's `role` is not in the list. Called with no roles it
passes through, so it is safe to register unconditionally.

### Issue a token pair

Only the credential authority should call this. Persistence is yours to
provide:

```ts
import { generateTokenPair, type RefreshTokenRepository } from "@medi-car-bd/mcb-shared-auth";

const { accessToken, refreshToken } = await generateTokenPair({
  user: { id, email, name, role, tenantId },
  deviceInfo: req.headers["user-agent"],
  ipAddress: req.ip,
  config: {
    jwtSecret: JWT_SECRET,
    refreshTokenSecret: JWT_REFRESH_SECRET, // use a different secret
    accessTokenExpiresIn: "15m",
    refreshTokenExpiresIn: "7d",
  },
  repo: refreshTokenRepository, // your implementation
});
```

### Rotate a refresh token

```ts
const result = await rotateRefreshToken({ oldRefreshToken, config, repo });
```

Rotation is single-use. Each refresh issues a new pair and marks the old token
`replacedBy`. Presenting an already-rotated token is treated as theft and
rejected, which is how a stolen refresh token gets surfaced instead of quietly
reused.

### Revoke everything for a user

```ts
await revokeAllUserTokens({ userId, reason: "password_change", repo });
```

Use this on password change and on admin-initiated lockouts. Pass
`excludeTokenId` to keep the current session alive.

## What is implemented

Every export below is available from the package root.

### Tokens

| Export | Purpose |
| --- | --- |
| `generateTokenPair` | Issue an access/refresh pair and persist the hashed refresh token |
| `generateAccessToken` | Sign an access token; includes `role` and `tenantId` when present |
| `generateRefreshToken` | Sign a refresh token, returning both the raw value and its SHA-256 hash |
| `rotateRefreshToken` | Single-use rotation with reuse detection |
| `revokeAllUserTokens` | Bulk revocation, optionally sparing the current session |
| `generateTokenId` | 32-byte random `jti` |
| `hashToken` | SHA-256 hex digest, for storing a token safely |
| `signToken` | Minimal signer driven by env vars, for simple cases |

Access tokens are signed with `audience: "mcb-services"` and `issuer:
"mcb-auth"`. Refresh tokens support a separate signing secret via
`config.refreshTokenSecret`, falling back to the access-token secret.

### Middleware

| Export | Purpose |
| --- | --- |
| `authenticate` | Verify a token and attach claims to `req.user` |
| `authorize` | Role guard: `authorize("ORG_ADMIN", "SUPER_ADMIN")` |
| `notFound` | `404` handler |
| `errorHandler` | Central error responder, normalising known error shapes |
| `processRequest` | Request logger that stamps the correlation id |

### Utilities

| Export | Purpose |
| --- | --- |
| `comparePassword` | bcryptjs password comparison |
| `limiter` | `express-rate-limit` instance, 100 requests / 15 min |
| `AppError` | Operational error carrying an HTTP status |
| `catchAsync` | Wrap an async handler so rejections reach the error handler |
| `logger` | Winston logger with daily rotating files |

### Types

`AccessTokenPayload`, `RefreshTokenPayload`, `TokenConfig`, `TokenPair`,
`RefreshTokenRecord`, `RefreshTokenRepository`, `GenerateTokenPairParams`,
`RotateRefreshTokenParams`, `RotateRefreshTokenResult`,
`RevokeAllUserTokensParams`, `AuthenticatedRequest`, `TUser`.

## The repository interface

The package never touches a database. It calls the `RefreshTokenRepository`
interface, and the consuming service implements it:

```ts
interface RefreshTokenRepository {
  create(record: RefreshTokenRecord): Promise<void>;
  findById(id: string): Promise<RefreshTokenRecord | null>;
  update(id: string, data: Partial<RefreshTokenRecord>): Promise<void>;
  updateMany(where, data): Promise<{ count: number }>;
}
```

This is deliberate. A shared auth library that imported Prisma would force an
ORM on every consumer and would turn a security primitive into a data-access
layer. Keep it this way: implement the interface in the service that owns the
data, and let the other services stay stateless.

`findById` **must** return the related `user` with `id`, `email`, `name`,
`role` and `tenantId`. Rotation needs those claims to mint the replacement
access token, and it assumes they are present.

## Environment variables

Read at import time, so they must be set before the package is loaded.

| Variable | Used by | Notes |
| --- | --- | --- |
| `JWT_SECRET` | `authenticate`, `signToken` | **Required** |
| `JWT_EXPIRES_IN` | `signToken` | e.g. `15m` |
| `NODE_ENV` | `logger` | Selects console vs file logging |

Everything else — token lifetimes and the refresh secret — is passed explicitly
through `TokenConfig`, so there is no hidden global state.

## Recommendations

Ordered by how much they matter.

### 1. `authenticate` does not yet verify `audience` or `issuer`

Tokens are *issued* with `aud` and `iss`, but `authenticate` verifies only the
signature and expiry. Because every service signs with one shared secret, a
token minted for any other purpose is currently accepted anywhere.

The fix is three lines inside `authenticate`, and it belongs here rather than in
each consumer so that all callers get it at once:

```ts
jwt.verify(token, String(JWT_SECRET), {
  audience: "mcb-services",
  issuer: "mcb-auth",
});
```

Tracked, not yet applied.

### 2. Fail fast on a missing `JWT_SECRET`

`authenticate` calls `String(JWT_SECRET)`, which turns an unset variable into
the literal string `"undefined"` and silently accepts tokens signed with it.
Validate the secret at startup and exit instead:

```ts
if (!JWT_SECRET) throw new Error("JWT_SECRET is not configured");
```

### 3. Use a separate refresh-token secret

Set `refreshTokenSecret` to a different value from `jwtSecret`. Otherwise
leaking the access-token signing key also lets an attacker mint refresh tokens
with any `sub`, which is a complete account takeover.

### 4. Strip stack traces from error responses in production

`errorHandler` always includes `stack` in the JSON body. Gate it on `NODE_ENV`
before exposing the library publicly.

### 5. Avoid `processRequest` on credential routes

`processRequest` serialises `req.body` into the log file. On a login or
register route that writes plaintext passwords to disk. Either drop body
logging or skip that middleware on those routes.

### 6. Swap the in-memory limiter for Redis when you run more than one instance

`limiter` keeps counters in process memory, so with N replicas each one
effectively allows N times the configured rate. The message it returns also
promises "in an hour" while the window is 15 minutes.

```ts
import { RedisStore } from "rate-limit-redis";
import { rateLimit } from "express-rate-limit";

rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  store: new RedisStore({ prefix: "rl:", sendCommand: (...a) => redis.call(...a) }),
});
```

Also set `app.set("trust proxy", ...)` behind a load balancer, or every caller
shares the proxy's address and per-IP limiting stops working.

### 7. Prefer asynchronous password comparison

`comparePassword` uses `compareSync`, which blocks the event loop. That is
visible under login load. Switch to `bcryptjs.compare` when you need throughput.

### 8. Short access-token lifetime plus rotation

`15m` access tokens with `7d` rotating refresh tokens keeps the blast radius of
a leaked access token small, and rotation makes reuse detectable. Long-lived
access tokens remove both properties.

### Housekeeping

- `types/jwt.ts` still documents a `TokenUser` type that no longer exists
  (removed in `0.0.8`); the shapes are inline.
- `TUser` and `TGenerateSKU` are boilerplate leftovers and unused by the
  platform.
- `authorize` is typed `Array<string | number>` but only ever compares a string
  `role`.

## Publishing

```bash
pnpm build          # must run first: package.json "files" is ["dist"]
npm version patch
npm publish --access public
```

The package is scoped `@medi-car-bd` and `publishConfig.access` is already
`public`, so `--access public` is belt-and-braces.

To authenticate, use an automation token rather than a long-lived personal one:

```bash
npm config set //registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxx
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

## License

MIT
