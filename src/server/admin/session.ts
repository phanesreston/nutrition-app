/**
 * Admin session tokens. Pure functions over node:crypto so they can be
 * unit-tested without Next.js.
 *
 * There are no user accounts yet, so administrator access is granted by a
 * password that the operator sets in the ADMIN_PASSWORD environment
 * variable. Nothing is hardcoded: with no (or too short a) password the
 * admin area cannot be entered at all.
 *
 * A successful sign-in yields a token "v1.<role>.<expiry>.<signature>",
 * signed with a key derived from the password. Changing the password
 * therefore invalidates every existing session.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type Role = "admin";

export const ADMIN_COOKIE = "nourish_admin";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 12;

export type AdminConfig = { enabled: true; password: string } | { enabled: false; reason: "not-set" | "too-short" };

export function adminConfig(env: Record<string, string | undefined> = process.env): AdminConfig {
  const password = env.ADMIN_PASSWORD ?? "";
  if (!password) return { enabled: false, reason: "not-set" };
  if (password.length < MIN_PASSWORD_LENGTH) return { enabled: false, reason: "too-short" };
  return { enabled: true, password };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time comparison (hashing first makes the lengths equal). */
export function passwordMatches(candidate: string, password: string): boolean {
  return timingSafeEqual(sha256(candidate), sha256(password));
}

function signingKey(password: string): Buffer {
  return createHmac("sha256", password).update("nourish-admin-session-v1").digest();
}

function sign(payload: string, password: string): string {
  return createHmac("sha256", signingKey(password)).update(payload).digest("base64url");
}

export function createSessionToken(password: string, now: number = Date.now(), role: Role = "admin"): string {
  const payload = `v1.${role}.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload, password)}`;
}

/** The role a token grants, or null if it is malformed, forged or expired. */
export function verifySessionToken(token: string | undefined, password: string, now: number = Date.now()): Role | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, role, expiry, signature] = parts;
  if (version !== "v1" || role !== "admin" || !/^\d+$/.test(expiry)) return null;
  const expected = Buffer.from(sign(`${version}.${role}.${expiry}`, password));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expiry) <= now) return null;
  return "admin";
}

/** Locks sign-in after repeated failures, to slow down password guessing. */
export class LoginThrottle {
  private failures: number[] = [];

  constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  private recent(): number[] {
    const t = this.now();
    this.failures = this.failures.filter((f) => t - f < this.windowMs);
    return this.failures;
  }

  isLocked(): boolean {
    return this.recent().length >= this.maxFailures;
  }

  recordFailure(): void {
    this.recent().push(this.now());
  }

  reset(): void {
    this.failures = [];
  }
}
