import mongoose, { Document, Schema } from "mongoose";

export interface IProject extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  createdBy: mongoose.Types.ObjectId;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, archived: 1 });

export const Project = mongoose.model<IProject>("Project", projectSchema);
