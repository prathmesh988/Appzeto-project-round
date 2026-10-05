import mongoose, { Document, Schema } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  slug: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>("Organization", organizationSchema);
