import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/user.model.js";
import { env } from "../config/env.js";

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
});

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, email, password } = parsed.data;

  try {
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      res.status(409).json({ success: false, message: "Email already registered" });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const token = signToken(user._id.toString());

    res.status(201).json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = signToken(user._id.toString());

    res.json({
      success: true,
      token,
      user: { _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  res.json({
    success: true,
    user: { _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
  });
};
