import crypto from "crypto";

const users = new Map();
const refreshTokens = new Map();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function registerUser({ email, password, displayName }) {
  const normalized = email.toLowerCase().trim();
  if (users.has(normalized)) {
    const err = new Error("Email already registered");
    err.status = 409;
    err.code = "EMAIL_EXISTS";
    throw err;
  }
  const id = crypto.randomUUID();
  const user = {
    id,
    email: normalized,
    displayName: displayName || normalized.split("@")[0],
    role: "user",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.set(normalized, user);
  return sanitizeUser(user);
}

export async function authenticateUser(email, password) {
  const normalized = email.toLowerCase().trim();
  const user = users.get(normalized);
  if (!user || user.passwordHash !== hashPassword(password)) {
    const err = new Error("Invalid email or password");
    err.status = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }
  return sanitizeUser(user);
}

export async function findUserById(id) {
  for (const user of users.values()) {
    if (user.id === id) return sanitizeUser(user);
  }
  return null;
}

export function storeRefreshToken(userId, token) {
  refreshTokens.set(token, { userId, createdAt: Date.now() });
}

export function consumeRefreshToken(token) {
  const entry = refreshTokens.get(token);
  if (!entry) return null;
  refreshTokens.delete(token);
  return entry.userId;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}
