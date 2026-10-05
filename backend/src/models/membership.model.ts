import mongoose, { Document, Schema } from "mongoose";

export type MemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface IMembership extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    role: { type: String, enum: ["OWNER", "ADMIN", "MEMBER", "VIEWER"], required: true },
  },
  { timestamps: true }
);

// Unique compound index - one membership per user per org
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
membershipSchema.index({ organizationId: 1, role: 1 });

export const Membership = mongoose.model<IMembership>("Membership", membershipSchema);
