import mongoose, { Document, Schema } from "mongoose";

export interface IComment extends Document {
  organizationId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  body: string;
  mentions: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

commentSchema.index({ taskId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
