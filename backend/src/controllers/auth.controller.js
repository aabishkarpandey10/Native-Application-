import {
  signAccessToken,
  signRefreshToken,
} from "../middlewares/auth.js";
import {
  authenticateUser,
  registerUser,
  storeRefreshToken,
  consumeRefreshToken,
  findUserById,
} from "../services/auth.service.js";

export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "email and password required" });
    }
    const user = await registerUser({ email, password, displayName });
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    storeRefreshToken(user.id, refreshToken);
    res.status(201).json({ user, accessToken, refreshToken, tokenType: "Bearer" });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "email and password required" });
    }
    const user = await authenticateUser(email, password);
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });
    storeRefreshToken(user.id, refreshToken);
    res.json({ user, accessToken, refreshToken, tokenType: "Bearer" });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "refreshToken required" });
    }
    const userId = consumeRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: "INVALID_REFRESH", message: "Refresh token invalid" });
    }
    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: "USER_NOT_FOUND", message: "User not found" });
    }
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const newRefresh = signRefreshToken({ sub: user.id, role: user.role });
    storeRefreshToken(user.id, newRefresh);
    res.json({ accessToken, refreshToken: newRefresh, tokenType: "Bearer" });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
