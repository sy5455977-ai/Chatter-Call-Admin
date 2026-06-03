# Chatter

A real-time private messaging app with dark theme, WebSocket live chat, voice/video call UI, and invite-via-link/QR-code feature.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/chatter run dev` — run the frontend (port 18863)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter (router), TanStack Query
- API: Express 5 + WebSocket (ws package)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (jsonwebtoken + bcryptjs), stored in localStorage
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB tables: users, conversations, messages
- `artifacts/api-server/src/routes/` — auth, users, conversations, messages, profile, invite
- `artifacts/api-server/src/lib/wsServer.ts` — WebSocket server
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `artifacts/chatter/src/pages/` — auth, chats, chat, profile, invite, call pages
- `artifacts/chatter/src/lib/auth.ts` — localStorage token + user management
- `artifacts/chatter/src/lib/websocket.ts` — WebSocket client for live messages

## Architecture decisions

- JWT stored in localStorage (not cookies) for simplicity; `setAuthTokenGetter` attaches Bearer token to every API request automatically via `custom-fetch`.
- WebSocket server lives on the same HTTP server at `/ws` path; the reverse proxy forwards `/ws` to the api-server.
- All WebSocket messages are broadcast to all connected clients (simple approach; conversations filter client-side).
- Invite codes are random 12-char alphanumeric strings stored on each user.
- QR code generated client-side using the `qrcode` npm package.

## Product

- Sign Up / Sign In with username + password
- Real-time 1:1 chat via WebSocket (messages appear instantly without refresh)
- Start new chats by searching users or using invite links
- Invite friends via shareable link + QR code
- Profile settings: display name, bio, avatar URL
- Voice/video call UI placeholder (WebRTC ready)
- Dark navy theme with golden accent throughout

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, run codegen before using the updated types.
- The `/ws` path must be in the api-server `artifact.toml` paths array for WebSocket to work through the proxy.
- `lib/api-client-react/package.json` exports subpaths for `./custom-fetch`, `./generated/api`, `./generated/api.schemas` — needed by the frontend.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
