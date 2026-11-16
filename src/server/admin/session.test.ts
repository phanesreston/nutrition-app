import { describe, expect, it } from "vitest";
import { LoginThrottle, SESSION_TTL_MS, adminConfig, createSessionToken, passwordMatches, verifySessionToken } from "./session";

const PASSWORD = "correct horse battery staple";

describe("adminConfig", () => {
  it("is disabled without a password, or with a short one", () => {
    expect(adminConfig({})).toEqual({ enabled: false, reason: "not-set" });
    expect(adminConfig({ ADMIN_PASSWORD: "short" })).toEqual({ enabled: false, reason: "too-short" });
    expect(adminConfig({ ADMIN_PASSWORD: PASSWORD })).toEqual({ enabled: true, password: PASSWORD });
  });
});

describe("session tokens", () => {
  it("accepts a token it issued", () => {
    expect(verifySessionToken(createSessionToken(PASSWORD, 1000), PASSWORD, 2000)).toBe("admin");
  });

  it("rejects expired tokens", () => {
    const token = createSessionToken(PASSWORD, 1000);
    expect(verifySessionToken(token, PASSWORD, 1000 + SESSION_TTL_MS)).toBeNull();
  });

  it("rejects forged, altered and malformed tokens", () => {
    const token = createSessionToken(PASSWORD, 1000);
    const [v, role, expiry, sig] = token.split(".");
    expect(verifySessionToken(`${v}.${role}.${Number(expiry) + 1}.${sig}`, PASSWORD, 2000)).toBeNull(); // extended expiry
    expect(verifySessionToken(`${v}.${role}.${expiry}.AAAA`, PASSWORD, 2000)).toBeNull();
    expect(verifySessionToken(createSessionToken("some other password!", 1000), PASSWORD, 2000)).toBeNull();
    expect(verifySessionToken("", PASSWORD)).toBeNull();
    expect(verifySessionToken(undefined, PASSWORD)).toBeNull();
    expect(verifySessionToken("admin", PASSWORD)).toBeNull();
    expect(verifySessionToken("v1.user.99999999999999.x", PASSWORD)).toBeNull();
  });

  it("is invalidated by changing the password", () => {
    const token = createSessionToken(PASSWORD, 1000);
    expect(verifySessionToken(token, "a brand new password", 2000)).toBeNull();
  });
});

describe("passwordMatches", () => {
  it("compares exactly", () => {
    expect(passwordMatches(PASSWORD, PASSWORD)).toBe(true);
    expect(passwordMatches(PASSWORD + " ", PASSWORD)).toBe(false);
    expect(passwordMatches("", PASSWORD)).toBe(false);
  });
});

describe("LoginThrottle", () => {
  it("locks after repeated failures and unlocks when the window passes", () => {
    let now = 0;
    const throttle = new LoginThrottle(3, 1000, () => now);
    throttle.recordFailure();
    throttle.recordFailure();
    expect(throttle.isLocked()).toBe(false);
    throttle.recordFailure();
    expect(throttle.isLocked()).toBe(true);
    now = 1001;
    expect(throttle.isLocked()).toBe(false);
  });
});
