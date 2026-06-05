import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { findUserById } from "../services/auth.service.js";

export function signAccessToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
}

export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: "refresh" }, config.auth.jwtSecret, {
    expiresIn: config.auth.refreshExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret);
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Bearer token required" });
  }
  try {
    const decoded = verifyToken(header.slice(7));
    if (decoded.type === "refresh") {
      return res.status(401).json({ error: "INVALID_TOKEN", message: "Use access token" });
    }
    const user = await findUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: "USER_NOT_FOUND", message: "Invalid user" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN", message: "Token expired or invalid" });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const decoded = verifyToken(header.slice(7));
    if (decoded.type !== "refresh") req.userId = decoded.sub;
  } catch {
    /* ignore */
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Insufficient permissions" });
    }
    next();
  };
}
