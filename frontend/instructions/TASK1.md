# AGENT BUILD SPEC: Multi-Tenant Project Management & Collaboration System

You are building a full-stack SaaS app for a timed technical machine test. Read this entire file before writing code. Follow the phases in order. Ship a working vertical slice early, then widen. Do not over-engineer: no Kubernetes, microservices, Redis, queues.

---

## 0. NON-NEGOTIABLE RULES

1. **Authorization is enforced server-side**, in middleware/service layer. Hiding buttons in the UI is cosmetic only and never counts.
2. **Every query is tenant-scoped** by `organizationId`. A user must never read or write another org's data. For resources outside the caller's orgs, return **404**, not 403 (do not leak existence).
3. **Every important mutation writes an audit log entry** (see section 7). No exceptions.
4. **No N+1 queries, no unbounded list endpoints.** Every list endpoint is paginated with a hard max page size of 100.
5. **No secrets in git.** `.env` is ignored; commit `.env.example`.
6. **TypeScript everywhere**, strict mode. No `any` unless commented why.
7. Work in small commits. After each phase, run the app and verify before moving on.

---

## 1. STACK (decided, do not change)

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript, React Router, Zustand (client state), TanStack Query (server state) optional but recommended |
| UI | **shadcn/ui prebuilt components** + Tailwind. Kanban from **Cult UI**. Dashboard layout modeled on the shadcn dashboard template (Vite version) |
| Backend | Node + Express + TypeScript |
| Realtime | **Socket.IO** (server + client) |
| DB | MongoDB Atlas via **Mongoose** |
| Auth | Email/password, bcrypt, JWT (access token in httpOnly cookie, or Bearer header; pick one and be consistent) |
| Validation | Zod on every request body/query |
| Scheduler | `node-cron` inside the backend process (deadline notifications) |
| Files | `multer` to local disk (`/uploads`, a Docker volume). Store metadata in Mongo. Do not build S3 unless time remains |
| Infra | Dockerfiles + `docker-compose.yml` (frontend via Nginx, backend). **No Mongo container**, Atlas is used |

**Why not Next.js:** Socket.IO needs a long-lived server process. Next route handlers are not a safe home for it. Hence Vite + Express.

---

## 2. UI INSTRUCTIONS

### 2.1 Component sourcing
- Use **prebuilt shadcn/ui components** installed through the CLI (`npx shadcn@latest add <component>`). Do NOT hand-write components that shadcn already provides (button, input, dialog, dropdown-menu, select, table, tabs, badge, avatar, popover, command, calendar, sheet, sonner/toast, skeleton, form, etc.).
- **Do not install every shadcn component.** Install only what you use.
- **Kanban board: use Cult UI's Kanban Board component.** Docs: https://www.cult-ui.com/docs/components/kanban-board
  - **Fetch and read those docs first** (WebFetch) and install exactly as documented (shadcn registry install). Follow the documented API for columns, cards, drag handlers and any dnd dependency it requires. Do not substitute `react-beautiful-dnd` or hand-roll drag and drop.
  - Use other Cult UI components where they genuinely fit (for example polished inputs, expandable cards, or animated elements). Do not force them in for decoration.
- **Dashboard shell/layout:** model it on https://github.com/shadcnstore/shadcn-dashboard-landing-template/tree/main/vite-version
  - Study its sidebar, header, breadcrumb, stat cards, data table, and layout structure. Reuse the same patterns (app sidebar, top bar, content area, dark/light theme toggle).
  - Do not copy the landing page, marketing pages, or demo pages that have nothing to do with this app. Strip everything unused.

### 2.2 Screens required
1. **Auth**: login, register.
2. **Org switcher** (in the sidebar header): lists the user's orgs with role badge, "Create organization".
3. **Dashboard** (per org): stat cards (tasks by status, overdue count, my assigned tasks), recent activity.
4. **Projects list** and **Project board page** (Kanban, see 2.3).
5. **Task detail** (sheet or dialog): title, description, status, priority, assignee, due date, labels, attachments, comments with @mentions, activity history tab.
6. **Search/Tasks page**: data table with combined filters (section 8). Debounced text search (300ms).
7. **Members page**: list, invite/add by email, change role, remove. Controls shown per role, but enforced server-side regardless.
8. **Audit log page**: table, filters, pagination. Visible to ADMIN and OWNER only.
9. **Notifications**: bell icon with unread count in header, popover list, "mark read", full-page list. Updates live.

### 2.3 Kanban behavior
- Columns: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`.
- Drag between columns and reorder within a column. **Optimistic UI update**, then PATCH to the server; **roll back and toast** on failure (for example a 403 for a MEMBER moving someone else's task).
- Loading a board must not fetch every task in the org. Fetch tasks for that project only, paginated per column if a column exceeds ~50 cards ("load more").
- Incoming socket events update the board without refresh, and must not fight an in-progress local drag (ignore events for the card currently being dragged, reconcile on drop).

### 2.4 UX baseline
Loading skeletons, empty states, error toasts, responsive layout, dark mode. Polished beats feature-complete for the leftover time.

---

## 3. REPO STRUCTURE

```
/
├── frontend/              # Vite + React + TS
│   ├── src/
│   │   ├── components/ui/ # shadcn + cult-ui installs
│   │   ├── components/    # app components
│   │   ├── pages/
│   │   ├── stores/        # Zustand (auth, active org, ui)
│   │   ├── lib/           # api client, socket client
│   │   └── hooks/
│   ├── Dockerfile  (multi-stage -> nginx)
│   └── nginx.conf (SPA fallback; proxy /api and /socket.io to backend)
├── backend/
│   ├── src/
│   │   ├── config/        # env (validated with zod), db
│   │   ├── models/        # Mongoose schemas
│   │   ├── middleware/    # auth, org context, permission, validate, error
│   │   ├── routes/ controllers/ services/
│   │   ├── sockets/       # socket init, auth, rooms, emitters
│   │   ├── jobs/          # deadline cron
│   │   ├── scripts/       # init-db, seed, seed-scale
│   │   └── server.ts
│   ├── Dockerfile  (multi-stage, see below)
│   └── .dockerignore
├── docker-compose.yml
├── .env.example
└── README.md
```

Dockerfiles: multi-stage. Backend: builder runs `npm ci && npm run build`; production stage runs `npm ci --omit=dev`, copies `dist/`, `CMD ["node","dist/server.js"]`. Frontend: build with Vite, serve `dist` from `nginx:alpine`. Compose passes `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PORT` from `.env`. Mount a volume for `/app/uploads`.

---

## 4. DATABASE: SCHEMAS AND SCRIPTS

The user does NOT want to create collections by hand. You must provide scripts.

### 4.1 Scripts (in `backend/src/scripts`, wired to npm scripts)
- `npm run db:init`: connects to Atlas, **creates every collection explicitly** (`Model.createCollection()`) and **builds all indexes** (`Model.syncIndexes()`), then prints a summary of collections and indexes. Must be idempotent (safe to rerun).
- `npm run db:seed`: demo data: 3 users per role across 2 orgs, one user belonging to both orgs (to demonstrate multi-org), 2 projects per org, ~30 tasks with varied status/priority/labels/due dates, a few comments, audit entries, notifications. Print demo credentials to the console.
- `npm run db:seed:scale`: generates **100,000 tasks, 10,000 users, 1,000 orgs** using `insertMany` in batches (about 5,000), for the performance claims. Must be skippable and clearly separate from the normal seed. Afterwards run a few `explain("executionStats")` calls and print/log that they use IXSCAN with low `totalDocsExamined`. Paste the results into the README.

### 4.2 Collections (Mongoose, all with `timestamps: true`)

**users**: `name`, `email` (unique, lowercased), `passwordHash`, `avatarUrl?`

**organizations**: `name`, `slug` (unique), `createdBy`

**memberships** (separate collection, NOT embedded in users or orgs; this makes multi-org membership and indexing clean):
`userId`, `organizationId`, `role` enum `OWNER|ADMIN|MEMBER|VIEWER`. Unique compound index `{userId, organizationId}`.

**projects**: `organizationId`, `name`, `description`, `createdBy`, `archived`

**tasks**:
`organizationId` (denormalized onto the task on purpose, so every query can scope by org without a join), `projectId`, `title`, `description`, `status` enum `TODO|IN_PROGRESS|REVIEW|DONE`, `priority` enum `LOW|MEDIUM|HIGH|URGENT`, `assigneeId?`, `reporterId`, `dueDate?`, `labels: string[]`, `position: number` (ordering within a column; use gaps / fractional indexing, so a drag updates ONE document, not the whole column), `attachments: [{filename, storedName, mimeType, size, uploadedBy, uploadedAt}]`

**comments**: `organizationId`, `taskId`, `authorId`, `body`, `mentions: ObjectId[]`

**auditlogs**: `userId`, `organizationId`, `action`, `entity`, `entityId`, `oldValue`, `newValue`, `timestamp`. **Append-only**: no update/delete routes anywhere.

**notifications**: `userId`, `organizationId`, `type` enum `TASK_ASSIGNED|MENTION|STATUS_CHANGED|DEADLINE_APPROACHING|ADDED_TO_ORG`, `taskId?`, `message`, `read`, `createdAt`, plus `dedupeKey?`

Activity history on a task = audit log entries filtered by `entity=task, entityId`. Do not build a second history system.

### 4.3 Indexes (declare in schemas; explain each in the README)
- memberships: `{userId:1, organizationId:1}` unique; `{organizationId:1, role:1}`
- tasks: 
  - `{organizationId:1, projectId:1, status:1, position:1}` (board load)
  - `{organizationId:1, assigneeId:1, status:1}` (my tasks)
  - `{organizationId:1, status:1, priority:1, dueDate:1}` (combined filters)
  - `{organizationId:1, labels:1}` (multikey)
  - `{organizationId:1, createdAt:-1}` (created-date filter + default sort)
  - text index `{organizationId:1, title:"text", description:"text"}`
- comments: `{taskId:1, createdAt:1}`
- auditlogs: `{organizationId:1, timestamp:-1}`; `{organizationId:1, entity:1, entityId:1, timestamp:-1}`; `{organizationId:1, userId:1, timestamp:-1}`; `{organizationId:1, action:1, timestamp:-1}`
- notifications: `{userId:1, read:1, createdAt:-1}`; unique sparse on `dedupeKey`
- projects: `{organizationId:1, archived:1}`

Rule: ESR (equality, sort, range) ordering. Every index starts with `organizationId` because every query is tenant-scoped.

---

## 5. AUTH AND TENANT CONTEXT

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` (these extra routes are allowed beyond the required list).
- `requireAuth` middleware: verifies JWT, loads `req.user`.
- `requireOrgMember` middleware: resolves the org from `:id`, or the `x-organization-id` header, or the task/project's own `organizationId`. It loads the caller's membership in ONE query and attaches `req.membership`. No membership means 404.
- **Never trust an `organizationId` from the request body.** Derive it from the resource or the validated membership. When creating a task, look up the project, take `organizationId` from the project, and confirm the caller is a member of that org.

---

## 6. PERMISSION MATRIX (server-side, one central file)

Create `permissions.ts` with a single `can(role, action, ctx)` function and a `requirePermission(action)` middleware. Do not scatter role checks across controllers.

| Action | VIEWER | MEMBER | ADMIN | OWNER |
|---|---|---|---|---|
| View projects/tasks/comments | ✅ | ✅ | ✅ | ✅ |
| Create task | ❌ | ✅ | ✅ | ✅ |
| Edit/move task | ❌ | **only if assignee** | ✅ any | ✅ any |
| Comment | ❌ | ✅ | ✅ | ✅ |
| Delete task | ❌ | ❌ | ✅ | ✅ |
| Create/edit/archive project | ❌ | ❌ | ✅ | ✅ |
| Add/remove members, change roles | ❌ | ❌ | ✅ (not OWNER/ADMIN-level escalation, see below) | ✅ |
| View audit logs | ❌ | ❌ | ✅ | ✅ |
| Delete org / transfer ownership | ❌ | ❌ | ❌ | ✅ |

Hard rules:
- Dragging a card is an edit. A MEMBER moving a task they are not assigned to gets **403**.
- ADMIN cannot grant OWNER, cannot modify or remove an OWNER, cannot promote anyone above ADMIN.
- The **last OWNER cannot be removed or demoted.**
- A user can leave an org themselves unless they are the last OWNER.
- A MEMBER with edit-on-own-assigned must not be able to re-assign the task to bypass rules, and must not be able to change fields outside what you decide to allow. Document your decision (suggested: MEMBER can edit status/description/labels/priority on tasks assigned to them, but cannot change the assignee).
- **Write permission tests** (Jest or Vitest + supertest): at least one test per role per sensitive action, plus one cross-tenant access test. A permission matrix without tests is a claim, not a feature.

---

## 7. AUDIT LOG

- Central helper `auditService.log({ userId, organizationId, action, entity, entityId, oldValue, newValue })`.
- Called from the **service layer** (not the UI, not scattered in controllers), in the same flow as the mutation.
- Actions to log at minimum: `TASK_CREATED`, `TASK_UPDATED`, `TASK_STATUS_CHANGED`, `TASK_PRIORITY_CHANGED`, `TASK_ASSIGNEE_CHANGED`, `TASK_DELETED`, `COMMENT_ADDED`, `ATTACHMENT_ADDED`, `PROJECT_CREATED/UPDATED`, `MEMBER_ADDED`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED`, `ORG_CREATED`.
- `oldValue`/`newValue` store only the changed fields (diff), not whole documents.
- `GET /api/audit-logs`: query params `organizationId` (must match a membership with ADMIN+), `action`, `entity`, `entityId`, `userId`, `from`, `to`, `q` (optional text on action/entity), `cursor|page`, `limit`. Sorted by `timestamp:-1`. Populate users with a single batched lookup (no N+1).
- Audit page UI: filters, table, expandable row showing old/new diff.

---

## 8. TASK SEARCH AND API

`GET /api/tasks` supports combined, optional, ANDed filters:
`organizationId` (required), `projectId`, `status` (multi), `priority` (multi), `assignee` (id or `me`), `labels` (any-of, and optional `labelsMode=all`), `dueBefore`, `dueAfter`, `createdBefore`, `createdAfter`, `q` (text search), `sort`, `page`/`limit` or cursor.

Spec examples that must work, e.g.:
`status=IN_PROGRESS&priority=HIGH&assignee=123&dueBefore=2026-09-01`
(you may also accept `dueDate<2026-09-01` style via a small parser, but the explicit params are the supported contract; document which in the README.)

Rules:
- Zod-validate and **whitelist** filter and sort fields. Never pass user input straight into a Mongo query object (NoSQL injection: reject operator keys like `$ne`; build the filter yourself).
- Response shape: `{ data: [...], pagination: { page, limit, total, hasMore } }`. Skip `countDocuments` on huge unfiltered scans if it is slow; cursor pagination or an estimated count is acceptable. State your choice in the README.
- Use `.select()`/projection and `.lean()`. List responses must **not** include heavy fields (full descriptions can be truncated; attachments only as a count in lists).
- Assignee/reporter names: batch-fetch with one `$in` query or `$lookup`, never per-row queries.

### Required endpoints (all must exist and be authorized)
```
POST   /api/organizations
GET    /api/organizations                       (orgs of the caller, with their role)
POST   /api/organizations/:id/members           (add by email + role; notify ADDED_TO_ORG)
DELETE /api/organizations/:id/members/:userId
POST   /api/projects
GET    /api/projects/:id
POST   /api/tasks
GET    /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id                           (also handles status/position moves)
DELETE /api/tasks/:id
POST   /api/tasks/:id/comments
GET    /api/audit-logs
GET    /api/notifications
PATCH  /api/notifications/:id/read
```
Extra allowed and sensible: auth routes, `GET /api/projects` (list), `GET /api/tasks/:id/comments`, `POST /api/tasks/:id/attachments`, `PATCH /api/notifications/read-all`, `PATCH /api/organizations/:id/members/:userId` (role change), `GET /api/organizations/:id/members`.

Task move: `PUT /api/tasks/:id` with `{ status, position }`. Compute `position` on the client from neighbors (midpoint of the surrounding positions) so only one document is written. If gaps get too small, rebalance that column server-side.

---

## 9. REAL-TIME (Socket.IO)

- Attach Socket.IO to the same HTTP server as Express. CORS restricted to `CLIENT_ORIGIN`.
- **Authenticate the socket handshake** (JWT in `auth` payload). Reject unauthenticated sockets.
- Rooms:
  - `user:{userId}`: joined automatically on connect. Used for notifications.
  - `project:{projectId}`: joined on client request `project:join`. **Server must verify the user is a member of the project's org before joining.** An unchecked join is a data leak.
- Events emitted server-side AFTER successful DB write (never from the client):
  `task:created`, `task:updated`, `task:moved`, `task:deleted`, `comment:created`, `notification:new`.
- Payloads are small (ids + changed fields), and **exclude the originating socket/user** or include an `actorId` so the actor does not double-apply.
- Client: one socket singleton, join/leave project room on board mount/unmount, reconnect handling (on reconnect, refetch the board to resync).
- Demo requirement: two browser windows on the same project; moving a card in one moves it in the other with no refresh.

---

## 10. NOTIFICATIONS

Triggers, created in the service layer, persisted in Mongo, AND pushed live over `user:{id}`:
1. **Assigned a task** (assignee changed, new assignee only; do not notify if you assign to yourself).
2. **Mentioned in a comment**: parse `@email` or `@username` tokens (document the syntax; the UI should offer a mention autocomplete from org members). Validate mentioned users belong to the org. Store resolved ids in `comment.mentions`.
3. **Task status changed**: notify assignee and reporter, excluding the actor.
4. **Deadline approaching**: `node-cron` job every 15 minutes finds tasks not DONE with `dueDate` within the next 24h. Create **one** notification per (task, assignee, due-date window) using the unique `dedupeKey`, so the job is idempotent and never spams. Query must use the `{organizationId, status, priority, dueDate}` or a dedicated `{status, dueDate}` index (add one, since this job is cross-org). Process in batches.
5. **Added to an organization**.

Never notify the actor about their own action. Notification list API is paginated; unread count endpoint or field for the bell badge.

---

## 11. PERFORMANCE CHECKLIST (assume 100k tasks, 10k users, 1k orgs)

- Indexes as in 4.3, verified with `explain()`. Show the evidence in the README.
- Pagination on every list; `limit` capped at 100.
- Projections / `.lean()`; no fetching full documents for lists.
- Batch lookups (`$in` / `$lookup`), no queries inside loops.
- Debounced search input (300ms) with request cancellation (AbortController) so stale responses do not overwrite fresh ones.
- Board loads one project, not the org.
- Socket payloads minimal.

---

## 12. README (graded, do not skip)

Include: 
1. What it is + screenshots/GIF of drag-and-drop realtime. 
2. Setup: `.env.example` explained, `npm run db:init`, `db:seed`, `docker compose up --build`, demo credentials. 
3. Architecture diagram (text/mermaid is fine). 
4. **Indexing strategy**: each index, the query it serves, and why the field order is what it is (ESR). Include the `explain()` evidence from the scale seed. 
5. Permission matrix and where it is enforced. 
6. Realtime design (rooms, events, auth). 
7. Pagination approach and tradeoffs. 
8. **Known limitations and what you would do next** (honest list, for example: local-disk uploads would be S3 in prod; cron in-process would be a worker at scale; Socket.IO would need the Redis adapter for multiple instances). This section impresses interviewers. Do not hide gaps.

---

## 13. BUILD ORDER (follow strictly)

**Phase 1: Foundation (get to running fast)**
Backend scaffold, env validation, Mongo connection, models, `db:init`, `db:seed`. Auth routes. Org + membership endpoints. Frontend scaffold, Tailwind, shadcn init, dashboard shell modeled on the Vite template, login/register, org switcher.

**Phase 2: Core slice**
Projects, tasks CRUD, permission middleware + audit logging wired in from the start (not retrofitted). Kanban board with Cult UI, drag persistence with optimistic update.

**Phase 3: Realtime + notifications**
Socket.IO with auth and rooms, task movement broadcast, notification creation + live bell, mentions, deadline cron.

**Phase 4: Search + audit UI**
Filterable tasks page, audit log page, comments and attachments, activity tab.

**Phase 5: Hardening + docs**
Permission tests, scale seed + explain evidence, Dockerfiles + compose verified with `docker compose up --build`, README, final pass for loading/empty/error states.

If time is short, **cut in this order**: attachments polish, dashboard charts, dark mode polish. **Never cut**: server-side permissions, tenant scoping, audit logs, realtime move, indexes + README strategy. Those are the explicit grading criteria.

---

## 14. DEFINITION OF DONE (verify each, do not assume)

- [ ] VIEWER calling `PUT /api/tasks/:id` with curl gets 403 even with a valid token.
- [ ] MEMBER moving a task not assigned to them gets 403 and the UI rolls back.
- [ ] User in Org A requesting an Org B task gets 404.
- [ ] Two windows: card moves live, notification bell increments live.
- [ ] Every mutation listed in section 7 produces an audit row with correct old/new values.
- [ ] Combined filter query returns correct results and uses an index (`explain`).
- [ ] Deadline job runs twice and creates no duplicate notification.
- [ ] `npm run db:init` on an empty Atlas DB creates all collections and indexes with no manual steps.
- [ ] `docker compose up --build` brings the full app up from a clean clone.
- [ ] No secrets committed; `.env.example` present.

Ask the user a question ONLY if you are genuinely blocked (for example missing Atlas URI). For everything else, pick the sensible default, note it in the README, and keep building.