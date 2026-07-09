# Prompt: Refactor Auth Module Toward SOLID Principles

You are a senior backend engineer working on the existing Smart Food backend.

Your task is to refactor the authentication module so it better follows SOLID principles while preserving the current Express.js + TypeScript + Prisma project structure.

## Project Context

This is an existing production-oriented backend.

Stack:

- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- Redis
- MQTT
- ONNX Runtime
- Expo Push Notifications

The project is organized by technical layers:

- `src/controllers`
- `src/services`
- `src/routes`
- `src/middlewares`
- `src/validations`
- `src/utils`
- `src/config`
- `src/models`

Do not convert this project to Clean Architecture, feature-first modules, DDD, or a new framework. Work inside the current folder structure and make the smallest safe refactor that improves ownership and maintainability.

## Files To Inspect First

Before editing code, inspect at least these files:

- `src/services/auth.service.ts`
- `src/services/token.service.ts`
- `src/services/user.service.ts`
- `src/services/email.service.ts`
- `src/controllers/auth.controller.ts`
- `src/routes/v1/auth.route.ts`
- `src/validations/auth.validation.ts`
- `src/middlewares/auth.ts`
- `src/services/index.ts`
- `src/utils/encryption.ts`
- `src/utils/exclude.ts`
- `src/utils/response.ts`
- `src/utils/template.ts`

Also inspect related tests if they exist.

## Main Goal

Refactor the auth module so that:

1. Controllers remain thin.
2. Auth business workflows live in `src/services/auth.service.ts`.
3. Token persistence and token lifecycle operations live in `src/services/token.service.ts`.
4. `auth.service.ts` no longer calls `prisma.token` directly.
5. `auth.service.ts` no longer re-exports password helper utilities.
6. Existing API behavior and route contracts are preserved unless a change is clearly required.
7. The refactor is incremental and does not introduce unnecessary architecture.

## Current Problems To Fix

### 1. SRP issue in `auth.controller.ts`

The controller currently performs business orchestration for flows such as:

- register
- forgot password
- send verification email

Examples of orchestration that should move into `auth.service.ts`:

- create user
- generate verification token
- send verification email
- generate auth tokens
- generate reset password token
- send reset password email

The controller should only:

- extract request data
- call one service method
- return a standardized response

### 2. SRP issue in `auth.service.ts`

`auth.service.ts` currently mixes auth use cases with token persistence details and password utility exports.

It should own auth use cases, but it should not know how token rows are queried or deleted in Prisma.

Remove these responsibilities from `auth.service.ts`:

- direct `prisma.token.findFirst`
- direct `prisma.token.delete`
- direct `prisma.token.deleteMany`
- public export of `encryptPassword`
- public export of `isPasswordMatch`

It is acceptable for `auth.service.ts` to call `userService`, `tokenService`, `emailService`, and generic utilities.

### 3. DIP issue caused by direct Prisma dependency

`auth.service.ts` currently imports Prisma directly and manipulates token records.

Move token storage operations into `token.service.ts`. `auth.service.ts` should call token service methods instead.

Add focused token service methods such as:

```ts
findValidToken(token, type)
revokeTokenById(tokenId)
revokeUserTokens(userId, type)
```

Use names that fit the existing code style. Avoid over-engineering.

### 4. Public API is too broad

Keep service exports focused.

`auth.service.ts` should export high-level auth use cases only, for example:

```ts
register
login
logout
refreshAuth
forgotPassword
resetPassword
sendVerificationEmail
verifyEmail
```

Use names that minimize changes across the codebase. If keeping existing names avoids churn, that is acceptable, but do not keep password utility exports on `auth.service.ts`.

`token.service.ts` may keep existing exports if other parts of the project use them, but new token persistence helpers should live there instead of in `auth.service.ts`.

## Desired Shape

### Controller layer

`src/controllers/auth.controller.ts` should look conceptually like this:

```ts
const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(httpStatus.CREATED).send(
    successResponse({
      code: httpStatus.CREATED,
      message: '...',
      data: result
    })
  );
});
```

For other auth handlers, follow the same pattern:

- extract request data
- call `authService`
- return response

Do not put token generation, email sending, or user creation orchestration in the controller.

### Auth service layer

`src/services/auth.service.ts` should own workflows such as:

```ts
register(input)
login(email, password)
logout(refreshToken)
refreshAuth(refreshToken)
forgotPassword(email)
resetPassword(token, newPassword)
sendVerificationEmail(user)
verifyEmail(token)
```

It should coordinate existing services:

- `userService`
- `tokenService`
- `emailService`

It may use:

- `exclude`
- `ApiError`
- `http-status`
- `isPasswordMatch` from `utils/encryption`

It should not import Prisma directly for token operations.

### Token service layer

`src/services/token.service.ts` should own:

- JWT generation
- token persistence
- token verification
- token revocation
- token deletion by id
- token deletion by user and type

Add methods needed by auth flows while preserving existing behavior.

Example:

```ts
const revokeTokenById = async (id: number): Promise<void> => {
  await prisma.token.delete({ where: { id } });
};

const revokeUserTokens = async (userId: number, type: TokenType): Promise<void> => {
  await prisma.token.deleteMany({ where: { userId, type } });
};

const findValidToken = async (token: string, type: TokenType): Promise<Token | null> => {
  return prisma.token.findFirst({
    where: {
      token,
      type,
      blacklisted: false
    }
  });
};
```

Adjust the exact implementation to match existing behavior. For refresh tokens, preserve the current user matching behavior from `verifyToken` where applicable.

## Behavioral Requirements

Preserve the existing endpoint behavior:

- `POST /register`
- `POST /login`
- `POST /logout`
- `POST /refresh-tokens`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /send-verification-email`
- `GET /verify-email`

Preserve:

- response status codes
- response shape from `successResponse`
- token generation behavior
- email sending behavior
- password hashing behavior
- user self-registration as `Role.USER`
- validation behavior
- middleware behavior

Do not change Prisma schema unless absolutely necessary. This refactor should not require a database schema change.

## Encoding Cleanup

Several Vietnamese messages in auth-related files appear to be mojibake.

If you touch a line with a broken Vietnamese message, fix that message using proper UTF-8 Vietnamese text.

Examples:

- invalid login message
- refresh token not found message
- register success message
- validation messages in `auth.validation.ts`

Do not perform a broad unrelated rewrite of all text unless it is localized to the auth module and safe.

## Error Handling Requirements

Keep public-facing auth errors intentionally generic where security matters.

However:

- do not swallow unexpected errors silently
- preserve current API semantics
- avoid leaking sensitive token/password details
- use `ApiError` consistently with the existing project style

If logging utilities are already used in nearby code, use them where helpful. Do not introduce a new logging framework.

## Constraints

Do not:

- rewrite the whole backend
- change folder architecture
- introduce dependency injection containers
- introduce a new framework
- change route paths
- change request validation contracts unnecessarily
- move business logic into routes, validations, middlewares, or utils
- add Prisma schema changes unless unavoidable
- add Redis/MQTT/notification changes for this auth refactor

Prefer:

- small focused service methods
- existing project style
- explicit function names
- minimal import churn
- TypeScript type safety
- preserving existing response contracts

## Suggested Implementation Plan

1. Inspect current auth, token, user, email, controller, route, validation, and utility files.
2. Add missing token lifecycle helpers to `token.service.ts`.
3. Move register orchestration from `auth.controller.ts` into `auth.service.ts`.
4. Move forgot-password orchestration from `auth.controller.ts` into `auth.service.ts`.
5. Move send-verification-email orchestration from `auth.controller.ts` into `auth.service.ts`.
6. Replace direct `prisma.token` calls in `auth.service.ts` with `tokenService` calls.
7. Remove `encryptPassword` and `isPasswordMatch` from `auth.service.ts` public exports.
8. Keep controller methods thin and response-focused.
9. Fix touched mojibake Vietnamese messages in auth files.
10. Run verification commands.

## Verification

After the refactor, run the relevant checks:

```bash
pnpm lint
pnpm build
```

If tests exist and can run in the current environment, run:

```bash
pnpm test
```

If the project uses npm instead of pnpm in the local environment, use the equivalent npm scripts from `package.json`.

Do not claim the task is complete if build or lint fails. If a verification command cannot run because of missing services or environment restrictions, report that clearly with the exact reason.

## Acceptance Criteria

The refactor is complete when:

- `auth.controller.ts` contains no user creation, token generation, or email sending orchestration.
- `auth.controller.ts` delegates auth workflows to `authService`.
- `auth.service.ts` contains auth workflow methods.
- `auth.service.ts` does not import `prisma` directly for token operations.
- `auth.service.ts` does not export password helper utilities.
- token deletion/revocation logic lives in `token.service.ts`.
- existing auth endpoints keep their current behavior.
- TypeScript build passes.
- Lint passes or any remaining lint issue is documented with a concrete reason.
- No unrelated architectural rewrite is introduced.

## Final Response Expected From The AI

When finished, summarize:

- what files changed
- what responsibilities moved
- what verification commands were run
- whether any behavior changed
- any remaining risks or follow-up recommendations
