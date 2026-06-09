# mcb-backend-boilerplate

```bash
rm -r node_modules package-lock.json
```

- Prisma Generate

```bash
pnpm prisma generate
```

- Run Prisma To Initialize Database

```bash
pnpm prisma init
```

- Generate Prisma Client

```bash
pnpm prisma generate

```

- Run Prisma Migrations

```bash
pnpm prisma:migrate
```

- Shared Auth package installation

```bash
npm login

npm version patch

npm config set //registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxx

npm publish --access public

pnpm install @mcb-shared-auth/auth
```
