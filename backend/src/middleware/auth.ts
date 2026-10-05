import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User, IUser } from "../models/user.model.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.token;

  if (!token) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    User.findById(decoded.userId)
      .lean()
      .then((user) => {
        if (!user) {
          res.status(401).json({ success: false, message: "User not found" });
          return;
        }
        (req as any).user = user;
        next();
      })
      .catch(() => {
        res.status(500).json({ success: false, message: "Auth lookup failed" });
      });
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
