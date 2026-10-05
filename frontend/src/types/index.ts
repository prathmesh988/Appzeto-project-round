export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  role: Role;
  createdBy?: string;
  createdAt?: string;
}

export interface Membership {
  _id: string;
  userId: User;
  organizationId: string;
  role: Role;
  createdAt: string;
}

export interface Project {
  _id: string;
  organizationId: string;
  name: string;
  description?: string;
  createdBy: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  _id?: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedBy: string | User;
  uploadedAt: string;
}

export interface Task {
  _id: string;
  organizationId: string;
  projectId: string | Project;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string | User | null;
  reporterId: string | User;
  dueDate?: string | null;
  labels: string[];
  position: number;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  organizationId: string;
  taskId: string;
  authorId: User;
  body: string;
  mentions: (string | User)[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  _id: string;
  userId: User | null;
  organizationId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  timestamp: string;
}

export interface Notification {
  _id: string;
  userId: string;
  organizationId: string;
  type: "TASK_ASSIGNED" | "MENTION" | "STATUS_CHANGED" | "DEADLINE_APPROACHING" | "ADDED_TO_ORG";
  taskId?: string;
  message: string;
  read: boolean;
  dedupeKey?: string;
  createdAt: string;
}
