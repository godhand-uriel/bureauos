import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Session resolution — the real getSessionUser, with only the Auth.js JWT
 * decode (`auth()`) replaced. Covers what makes a still-valid token stop
 * working: a deleted account and a password change.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let token: any = null;
vi.mock("@/auth", () => ({ auth: async () => token }));

import { prisma } from "@/lib/server/db";
import { wipeDatabase } from "@/lib/server/seed-db";
import { hashPassword } from "@/lib/server/passwords";
import { getSessionUser } from "@/lib/server/auth";
import { authConfig } from "@/auth.config";

beforeAll(async () => {
  await wipeDatabase(prisma);
});

const session = (id: string, sessionVersion?: number) => ({
  user: { id, role: "customer", ...(sessionVersion === undefined ? {} : { sessionVersion }) },
});

describe("getSessionUser", () => {
  it("returns null with no session or an unknown user id", async () => {
    token = null;
    expect(await getSessionUser()).toBeNull();
    token = session("no-such-user", 0);
    expect(await getSessionUser()).toBeNull();
  });

  it("resolves the user from the database, so role comes from the row, not the token", async () => {
    const user = await prisma.user.create({
      data: { email: "session-a@example.com", name: "A", passwordHash: hashPassword("pw-pw-pw-pw"), role: "customer" },
    });
    token = { user: { id: user.id, role: "admin", sessionVersion: 0 } }; // a token claiming admin
    const resolved = await getSessionUser();
    expect(resolved?.id).toBe(user.id);
    expect(resolved?.role).toBe("customer");
  });

  it("rejects a token issued before the account's password changed", async () => {
    const user = await prisma.user.create({
      data: { email: "session-b@example.com", name: "B", passwordHash: hashPassword("pw-pw-pw-pw") },
    });
    token = session(user.id, 0);
    expect((await getSessionUser())?.id).toBe(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
    expect(await getSessionUser()).toBeNull(); // the old token is dead

    token = session(user.id, 1); // a fresh sign-in carries the new version
    expect((await getSessionUser())?.id).toBe(user.id);
  });

  it("treats tokens minted before session versioning as version 0", async () => {
    const user = await prisma.user.create({
      data: { email: "session-c@example.com", name: "C", passwordHash: hashPassword("pw-pw-pw-pw") },
    });
    token = session(user.id); // no sessionVersion claim at all
    expect((await getSessionUser())?.id).toBe(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: 3 } });
    expect(await getSessionUser()).toBeNull();
  });

  it("a deleted account loses access immediately", async () => {
    const user = await prisma.user.create({
      data: { email: "session-d@example.com", name: "D", passwordHash: hashPassword("pw-pw-pw-pw") },
    });
    token = session(user.id, 0);
    expect(await getSessionUser()).not.toBeNull();
    await prisma.user.delete({ where: { id: user.id } });
    expect(await getSessionUser()).toBeNull();
  });
});

describe("Auth.js callbacks", () => {
  it("carry id, role and session version from sign-in into the token and session", () => {
    const { jwt, session: sessionCb } = authConfig.callbacks;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (jwt as any)({ token: {}, user: { id: "u1", role: "admin", sessionVersion: 4 } });
    expect(t).toMatchObject({ id: "u1", role: "admin", sv: 4 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (sessionCb as any)({ session: { user: {} }, token: t });
    expect(s.user).toMatchObject({ id: "u1", role: "admin", sessionVersion: 4 });
    // Later requests (no `user`) keep the token as issued.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((jwt as any)({ token: t })).toBe(t);
  });

  it("sessions are stateless JWTs lasting 7 days", () => {
    expect(authConfig.session.maxAge).toBe(60 * 60 * 24 * 7);
    expect(authConfig.session.strategy).toBe("jwt");
  });
});
