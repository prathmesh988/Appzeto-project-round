import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "TASK_ASSIGNED"
  | "MENTION"
  | "STATUS_CHANGED"
  | "DEADLINE_APPROACHING"
  | "ADDED_TO_ORG";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  type: NotificationType;
  taskId?: mongoose.Types.ObjectId;
  message: string;
  read: boolean;
  dedupeKey?: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    type: {
      type: String,
      enum: ["TASK_ASSIGNED", "MENTION", "STATUS_CHANGED", "DEADLINE_APPROACHING", "ADDED_TO_ORG"],
      required: true,
    },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    dedupeKey: { type: String },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
