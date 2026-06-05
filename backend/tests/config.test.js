import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTfnswKeyConfigured, config } from "../src/config/index.js";
import { createRateLimiter } from "../src/middlewares/rateLimit.js";

describe("config", () => {
  it("exposes default port", () => {
    assert.equal(typeof config.port, "number");
  });

  it("returns boolean for TfNSW key check", () => {
    assert.equal(typeof isTfnswKeyConfigured(), "boolean");
  });
});

describe("rateLimit", () => {
  it("allows requests under limit", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    let nextCalled = 0;
    const req = { ip: "127.0.0.1" };
    const res = { status: () => res, json: () => {}, setHeader: () => {} };
    for (let i = 0; i < 5; i++) {
      limiter(req, res, () => {
        nextCalled++;
      });
    }
    assert.equal(nextCalled, 5);
  });
});
