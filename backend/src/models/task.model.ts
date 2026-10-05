import mongoose, { Document, Schema } from "mongoose";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface IAttachment {
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedAt: Date;
}

export interface ITask extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: mongoose.Types.ObjectId;
  reporterId: mongoose.Types.ObjectId;
  dueDate?: Date;
  labels: string[];
  position: number;
  attachments: IAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new Schema<ITask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"], default: "TODO" },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date },
    labels: [{ type: String }],
    position: { type: Number, required: true, default: 0 },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

// All indexes start with organizationId (ESR rule)
taskSchema.index({ organizationId: 1, projectId: 1, status: 1, position: 1 }); // board load
taskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 }); // my tasks
taskSchema.index({ organizationId: 1, status: 1, priority: 1, dueDate: 1 }); // combined filters
taskSchema.index({ organizationId: 1, labels: 1 }); // multikey
taskSchema.index({ organizationId: 1, createdAt: -1 }); // created-date sort
taskSchema.index({ organizationId: 1, title: "text", description: "text" }); // text search
// For cron job - cross-org deadline queries
taskSchema.index({ status: 1, dueDate: 1 });

export const Task = mongoose.model<ITask>("Task", taskSchema);
