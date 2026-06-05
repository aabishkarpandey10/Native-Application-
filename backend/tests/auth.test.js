import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  registerPushToken,
  unregisterPushToken,
  getTokensForRoute,
} from "../src/services/notifications.service.js";

describe("notifications.service", () => {
  it("registers and retrieves push tokens by route", () => {
    registerPushToken("user_1", {
      expoPushToken: "ExponentPushToken[test1]",
      subscribedRoutes: ["T4"],
    });
    registerPushToken("user_2", {
      expoPushToken: "ExponentPushToken[test2]",
      subscribedRoutes: ["T1"],
    });
    const t4 = getTokensForRoute("T4");
    assert.ok(t4.some((t) => t.expoPushToken === "ExponentPushToken[test1]"));
    unregisterPushToken("user_1", "ExponentPushToken[test1]");
    const after = getTokensForRoute("T4");
    assert.ok(!after.some((t) => t.expoPushToken === "ExponentPushToken[test1]"));
  });
});

describe("auth.service", () => {
  it("registers and authenticates users", async () => {
    const { registerUser, authenticateUser } = await import("../src/services/auth.service.js");
    const email = `test_${Date.now()}@example.com`;
    const user = await registerUser({ email, password: "TestPass123!", displayName: "Tester" });
    assert.ok(user.id);
    assert.equal(user.email, email);
    const authed = await authenticateUser(email, "TestPass123!");
    assert.equal(authed.id, user.id);
  });
});
