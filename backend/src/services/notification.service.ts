import { Server as SocketIOServer } from "socket.io";
import { Notification } from "../models/notification.model.js";
import mongoose from "mongoose";

let io: SocketIOServer | null = null;

export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

interface NotificationParams {
  userId: mongoose.Types.ObjectId | string;
  organizationId: mongoose.Types.ObjectId | string;
  type: "TASK_ASSIGNED" | "MENTION" | "STATUS_CHANGED" | "DEADLINE_APPROACHING" | "ADDED_TO_ORG";
  taskId?: mongoose.Types.ObjectId | string;
  message: string;
  dedupeKey?: string;
}

export const notificationService = {
  async create(params: NotificationParams): Promise<void> {
    try {
      if (params.dedupeKey) {
        // Upsert/deduplicate to prevent duplicate notifications (idempotent)
        const existing = await Notification.findOne({ dedupeKey: params.dedupeKey }).lean();
        if (existing) {
          return; // Already notified for this window
        }

        const notification = await Notification.create({
          userId: params.userId,
          organizationId: params.organizationId,
          type: params.type,
          taskId: params.taskId,
          message: params.message,
          read: false,
          dedupeKey: params.dedupeKey,
        });

        if (io) {
          io.to(`user:${params.userId}`).emit("notification:new", notification.toObject());
        }
      } else {
        const notification = await Notification.create(params);
        if (io) {
          io.to(`user:${params.userId}`).emit("notification:new", notification.toObject());
        }
      }
    } catch (err: any) {
      // Ignore E11000 duplicate key error in case of race condition
      if (err?.code === 11000) {
        return;
      }
      console.error("[NotificationService] Failed to create notification:", err);
    }
  },
};
