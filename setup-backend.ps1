$ErrorActionPreference = "Stop"

Write-Host "Creating backend..." -ForegroundColor Cyan

# Create backend folder
New-Item -ItemType Directory -Force -Path "backend" | Out-Null
Set-Location "backend"

# Initialize npm
Write-Host "Initializing npm..." -ForegroundColor Yellow
npm init -y

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install express mongoose cors dotenv
npm install -D typescript tsx @types/node @types/express @types/cors

# Create folders
Write-Host "Creating folder structure..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path "src/config" | Out-Null
New-Item -ItemType Directory -Force -Path "src/controllers" | Out-Null
New-Item -ItemType Directory -Force -Path "src/models" | Out-Null
New-Item -ItemType Directory -Force -Path "src/routes" | Out-Null
New-Item -ItemType Directory -Force -Path "src/middleware" | Out-Null

# tsconfig.json
@"
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
"@ | Set-Content "tsconfig.json"

# .env
@"
PORT=5000
MONGO_URI=mongodb://localhost:27017/project
"@ | Set-Content ".env"

# .gitignore
@"
node_modules
dist
.env
"@ | Set-Content ".gitignore"

# db.ts
@"
import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};
"@ | Set-Content "src/config/db.ts"

# app.ts
@"
import express from "express";
import cors from "cors";

import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

app.use("/api/users", userRoutes);

export default app;
"@ | Set-Content "src/app.ts"

# server.ts
@"
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
"@ | Set-Content "src/server.ts"

# user.model.ts
@"
import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.model<IUser>("User", userSchema);
"@ | Set-Content "src/models/user.model.ts"

# user.controller.ts
@"
import { Request, Response } from "express";
import { User } from "../models/user.model.js";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find();

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;

    const user = await User.create({
      name,
      email,
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};
"@ | Set-Content "src/controllers/user.controller.ts"

# user.routes.ts
@"
import { Router } from "express";

import {
  getUsers,
  createUser,
} from "../controllers/user.controller.js";

const router = Router();

router.get("/", getUsers);
router.post("/", createUser);

export default router;
"@ | Set-Content "src/routes/user.routes.ts"

# Update package.json scripts
npm pkg set scripts.dev="tsx watch src/server.ts"
npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node dist/server.js"

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Backend setup complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Run the server:" -ForegroundColor Cyan
Write-Host "  npm run dev"
Write-Host ""