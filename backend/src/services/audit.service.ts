import { AuditLog } from "../models/auditlog.model.js";
import mongoose from "mongoose";

interface AuditLogParams {
  userId: mongoose.Types.ObjectId | string;
  organizationId: mongoose.Types.ObjectId | string;
  action: string;
  entity: string;
  entityId: mongoose.Types.ObjectId | string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

export const auditService = {
  async log(params: AuditLogParams): Promise<void> {
    try {
      await AuditLog.create({
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: params.oldValue,
        newValue: params.newValue,
        timestamp: new Date(),
      });
    } catch (err) {
      // Never let audit log failure crash the main flow
      console.error("[AuditService] Failed to write audit log:", err);
    }
  },
};

// Action constants
export const AuditActions = {
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_PRIORITY_CHANGED: "TASK_PRIORITY_CHANGED",
  TASK_ASSIGNEE_CHANGED: "TASK_ASSIGNEE_CHANGED",
  TASK_DELETED: "TASK_DELETED",
  COMMENT_ADDED: "COMMENT_ADDED",
  ATTACHMENT_ADDED: "ATTACHMENT_ADDED",
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  MEMBER_ADDED: "MEMBER_ADDED",
  MEMBER_REMOVED: "MEMBER_REMOVED",
  MEMBER_ROLE_CHANGED: "MEMBER_ROLE_CHANGED",
  ORG_CREATED: "ORG_CREATED",
} as const;
