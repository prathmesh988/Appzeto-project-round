# AppZeto: Multi-Tenant Project Management & Collaboration System

AppZeto is a production-grade, multi-tenant project management and realtime collaboration SaaS platform built for high concurrency, strict tenant isolation, and responsive user experience.

---

## 1. Features Overview

- **Strict Multi-Tenancy**: Complete logical isolation via `organizationId` scoping. Requests for cross-tenant resources return 404 (preventing existence leakage).
- **Server-Enforced RBAC**: Single source of truth permission matrix (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`). Client controls mirror server rules, but server strictly enforces every action.
- **Interactive Real-Time Kanban**: Cult UI Kanban board powered by HTML5 drag-and-drop and Motion. Optimistic UI updates with instant rollback & error toast if rejected by server (e.g. 403 on moving unassigned task).
- **Live Synchronization (Socket.IO)**: Authenticated WebSocket handshake, project-level and user-level rooms. Card movements, creations, and deletions propagate instantly across open browser windows without page reloads.
- **Append-Only Audit Trail**: Automated logging on all significant mutations (`TASK_CREATED`, `TASK_MOVED`, `TASK_UPDATED`, `TASK_DELETED`, `MEMBER_ADDED`, etc.) with before/after diffs.
- **Filterable Search Engine**: Debounced text search (300ms) with `AbortController` cancellation, multi-select status/priority filters, date window filters, and paginated data table.
- **Automated Deadline Watcher**: In-process `node-cron` job running every 15 minutes to alert assignees of approaching deadlines with idempotent deduplication keys.
- **Attachments & Discussions**: Multipart file uploads to disk and contextual comments supporting `@email` user mentions.

---

## 2. Architecture Diagram

```mermaid
graph TD
    Client["Client: React 19 + Vite + Tailwind v4 + Zustand"]
    Nginx["Nginx Reverse Proxy (:80 / :5173)"]
    Express["Node.js / Express 5 API Server (:5000)"]
    SocketIO["Socket.IO Server (Authenticated Handshake)"]
    Cron["Deadline Cron Scheduler (15 min interval)"]
    Mongo[("MongoDB Atlas")]
    Disk[("Local Uploads Volume: /app/uploads")]

    Client -->|HTTP / REST| Nginx
    Client -->|WebSocket| Nginx
    Nginx -->|/api/*| Express
    Nginx -->|/socket.io/*| SocketIO
    Express -->|Queries & Mutations| Mongo
    Express -->|Save Attachments| Disk
    Cron -->|Query Approaching Tasks| Mongo
    Cron -->|Push Alerts| SocketIO
    Express -->|Realtime Broadcasts| SocketIO
    SocketIO -->|Events (task:moved, notification:new)| Client
```

---

## 3. Quick Start & Setup

### Prerequisites
- Node.js 20+
- MongoDB Atlas cluster URI
- Docker & Docker Compose (optional for containerized deployment)

### 3.1 Local Development

1. **Clone and Configure Environment**:
   ```bash
   cp .env.example backend/.env
   ```
   Configure `backend/.env`:
   ```env
   PORT=5000
   MONGO_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/appzeto"
   JWT_SECRET="supersecretjwt32charslongkey1234"
   CLIENT_ORIGIN="http://localhost:5173"
   NODE_ENV="development"
   ```

2. **Initialize Database & Demo Data**:
   ```bash
   cd backend
   npm install
   npm run db:init      # Creates collections and syncs compound indexes
   npm run db:seed      # Seeds 6 demo users, 2 orgs, 4 projects, and ~30 tasks
   ```

3. **Start Development Servers**:
   In `backend/`:
   ```bash
   npm run dev          # Starts Express + Socket.IO server on :5000
   ```
   In `frontend/`:
   ```bash
   npm install
   npm run dev          # Starts Vite dev server on :5173
   ```

4. **Run Permission & Security Tests**:
   ```bash
   cd backend
   npm test
   ```

### 3.2 Production Deployment with Docker Compose

```bash
# Build and run both backend and frontend containers
docker compose up --build
```
The application will be accessible at:
- Frontend (Nginx SPA + Reverse Proxy): `http://localhost:5173`
- Backend API & Health check: `http://localhost:5000/api/health`

---

## 4. Demo Credentials

Password for all seeded accounts: `Demo1234!`

| Persona | Email | Roles & Organizations |
|---|---|---|
| **Alice** | `demo-alice@example.com` | `OWNER` of Acme Corp |
| **Bob** | `demo-bob@example.com` | `ADMIN` of Acme Corp |
| **Carol** | `demo-carol@example.com` | `MEMBER` of Acme Corp |
| **Dave** | `demo-dave@example.com` | `VIEWER` of Acme Corp, `OWNER` of Globex Inc |
| **Eve** | `demo-eve@example.com` | `MEMBER` of both Acme Corp & Globex Inc |
| **Frank** | `demo-frank@example.com` | `ADMIN` of Globex Inc |

*(Note: The login page provides quick-fill buttons for these personas for zero-friction evaluation).*

---

## 5. Indexing Strategy & Performance

MongoDB index declarations follow the **ESR (Equality, Sort, Range)** rule. Every single index begins with `organizationId` because all tenant operations are logically isolated.

| Index Key | Target Query / Workflow | Design Rationale |
|---|---|---|
| `{ organizationId: 1, projectId: 1, status: 1, position: 1 }` | Kanban Board Loading | Equality on tenant & project, equality on column status, sorted by fractional position. |
| `{ organizationId: 1, assigneeId: 1, status: 1 }` | "My Assigned Tasks" Widget & Filter | Equality on tenant & assigned user, equality/filtering on status. |
| `{ organizationId: 1, status: 1, priority: 1, dueDate: 1 }` | Complex Multi-Filter Search (`GET /api/tasks`) | Equalities on status and priority, range filter on `dueDate` (`$gte`, `$lte`). |
| `{ organizationId: 1, labels: 1 }` | Multikey Label Tag Filtering | Equality on tenant with efficient multikey array scanning for tags. |
| `{ organizationId: 1, createdAt: -1 }` | Chronological Audit & Task Listing | Equality on tenant, sort in reverse creation order. |
| `{ organizationId: 1, title: "text", description: "text" }` | Full-Text Debounced Search | Compound text index scoped to tenant workspace. |
| `{ status: 1, dueDate: 1 }` | Cross-Org Deadline Background Cron | Equality on non-completed status, range on upcoming 24h deadline across all tenants. |
| `{ userId: 1, organizationId: 1 }` (unique) | Membership lookups & verification | Ensures 1 query lookup for permissions and prevents duplicate memberships. |
| `{ dedupeKey: 1 }` (unique, sparse) | Idempotent Notification Dispatch | Guarantees identical notification is never delivered twice per time window. |

### Scale Performance Verification (`explain("executionStats")`)
On a scaled dataset with 100,000 tasks and 10,000 users (`npm run db:seed:scale`):
```json
{
  "stage": "IXSCAN",
  "indexName": "organizationId_1_status_1_priority_1_dueDate_1",
  "totalDocsExamined": 15,
  "nReturned": 15,
  "executionTimeMillis": 2
}
```
All queries achieve `totalDocsExamined == nReturned` with `IXSCAN` and sub-5ms execution times.

---

## 6. Permission Matrix & Enforcement

Authorization is enforced server-side in `backend/src/middleware/permissions.ts` using the central `can(role, action, ctx)` evaluator.

| Action | VIEWER | MEMBER | ADMIN | OWNER | Enforcement Location |
|---|---|---|---|---|---|
| View projects, tasks, comments | ✅ | ✅ | ✅ | ✅ | `requirePermission("view")` |
| Create tasks | ❌ | ✅ | ✅ | ✅ | `can(role, "create_task")` |
| Move / Edit task | ❌ | **Only if assigned** | ✅ Any | ✅ Any | `can(role, "edit_task", { assigneeId, actorId })` |
| Reassign task | ❌ | ❌ | ✅ | ✅ | Checked during update payload parsing |
| Delete task | ❌ | ❌ | ✅ | ✅ | `can(role, "delete_task")` |
| Create / Archive project | ❌ | ❌ | ✅ | ✅ | `requirePermission("create_project")` |
| Add / Remove members | ❌ | ❌ | ✅ *(no Owner escalation)* | ✅ | `organization.controller.ts` |
| View audit logs | ❌ | ❌ | ✅ | ✅ | `auditlog.controller.ts` |
| Delete organization | ❌ | ❌ | ❌ | ✅ | `can(role, "delete_org")` |

**Security Rules:**
1. A `MEMBER` attempting to move or edit a task assigned to someone else receives **HTTP 403 Forbidden**.
2. An `ADMIN` cannot grant `OWNER`, remove an `OWNER`, or promote members to `OWNER`.
3. The last `OWNER` of an organization can never be removed or demoted.
4. Attempting to access an entity belonging to another organization returns **HTTP 404 Not Found**, never 403.

---

## 7. Realtime Synchronization Architecture

- **Handshake Verification**: Socket.IO connections pass `{ auth: { token } }`. The handshake verifies the JWT before admission; unauthenticated sockets are immediately rejected.
- **Rooms**:
  - `user:{userId}`: Joined automatically upon handshake authentication. Used for direct live notification delivery.
  - `project:{projectId}`: Joined on client event `project:join`. The server verifies that the caller belongs to the project's organization before allowing them to enter the room.
- **Dispatched Events**:
  - `task:created`: Broadcast to project room.
  - `task:moved`: Broadcast to project room on drag-and-drop or status change.
  - `task:updated`: Broadcast to project room on title/description/field edits.
  - `task:deleted`: Broadcast to project room on deletion.
  - `notification:new`: Dispatched to specific user room.
- **Conflict Prevention**: Payloads include `actorId`. Incoming movement events for a card currently held in the user's active drag are ignored until drop reconciliation.

---

## 8. Pagination & Data Transfer Strategy

- All collection endpoints (`/api/tasks`, `/api/audit-logs`, `/api/notifications`) enforce pagination.
- Hard maximum `limit` is capped at `100` items per page.
- Responses return `{ data: [...], pagination: { page, limit, total, hasMore } }`.
- Projection optimization: Task list queries utilize `.select("-description -attachments").lean()`, avoiding transferring heavy text descriptions and multipart arrays over the wire for list views. Assignee names and avatars are populated via batched `$in` queries (zero N+1 lookups).

---

## 9. Known Limitations & Production Roadmap

1. **Local Disk Uploads**: File uploads currently use `multer` writing to the `/uploads` volume. In enterprise production, this should be transitioned to Amazon S3 or Cloudflare R2 using pre-signed upload URLs.
2. **In-Process Scheduler**: Deadline checking runs via `node-cron` inside the API container. Under horizontal scaling across multiple instances, this should be delegated to an external worker queue (e.g. BullMQ / Redis or AWS SQS) to prevent redundant runs.
3. **Socket.IO Clustering**: Realtime messaging currently utilizes the memory adapter. For multi-server horizontal autoscaling, the `@socket.io/redis-adapter` should be added.
4. **Rich Text Editing**: Current comments and descriptions utilize plain text with `@mention` parsing. Upgrading to a TipTap or Lexical editor would enable rich markdown formatting.
