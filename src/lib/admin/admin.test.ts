import { describe, expect, it } from "vitest";
import { accountGuardError, isDeleteConfirmed } from "./guards";
import { buildQuery, pageCount, parseClientParams, parseMuseumParams, sanitizeSearch } from "./params";
import { generateTempPassword, passwordStrength, validatePassword } from "./password";
import { changeEmailSchema, createClientSchema } from "./validation";

describe("generateTempPassword", () => {
  it("has the requested length and every character class", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTempPassword();
      expect(password).toHaveLength(16);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
      expect(password).not.toMatch(/[0O1lI]/);
      expect(validatePassword(password)).toBeNull();
    }
  });

  it("clamps the length to the allowed range", () => {
    expect(generateTempPassword(3)).toHaveLength(12);
    expect(generateTempPassword(500)).toHaveLength(72);
  });

  it("does not repeat across calls", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
    expect(seen.size).toBe(100);
  });

  it("avoids modulo bias by rejecting values above the limit", () => {
    // 0xFFFFFFFF is rejected for every alphabet size, then a valid value follows.
    let calls = 0;
    const fill = (array: Uint32Array) => {
      calls += 1;
      array[0] = calls % 2 === 1 ? 0xffffffff : 5;
      return array;
    };
    const password = generateTempPassword(12, fill);
    expect(password).toHaveLength(12);
    expect(calls).toBeGreaterThan(12);
  });
});

describe("password validation and strength", () => {
  it("rejects short or low-variety passwords", () => {
    expect(validatePassword("Short1")).toBe("val.passwordMin:12");
    expect(validatePassword("alllowercase123")).toBe("val.passwordMix");
    expect(validatePassword("ABCDEFGHIJKL1234")).toBe("val.passwordMix");
    expect(validatePassword("x".repeat(73))).toBe("val.passwordMax:72");
  });

  it("accepts a reasonable password", () => {
    expect(validatePassword("Correct7Horse")).toBeNull();
  });

  it("scores strength by length and variety", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("abcdefgh").score).toBe(1);
    expect(passwordStrength(generateTempPassword()).score).toBe(4);
  });
});

describe("createClientSchema", () => {
  const base = { email: "  Client@Example.COM ", displayName: " Ana ", password: "Correct7Horse" };

  it("normalizes the email and trims the name", () => {
    const parsed = createClientSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("client@example.com");
      expect(parsed.data.displayName).toBe("Ana");
      // Clients create their own museum on first sign-in: nothing about it is collected here.
      expect(Object.keys(parsed.data).sort()).toEqual(["displayName", "email", "password"]);
    }
  });

  it("reports validation problems as message codes", () => {
    const messages = (input: unknown) => {
      const parsed = createClientSchema.safeParse(input);
      return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    };
    expect(messages({ ...base, email: "nope" })).toContain("val.email");
    expect(messages({ ...base, displayName: "  " })).toContain("val.required");
    expect(messages({ ...base, password: "weak" })).toContain("val.passwordMin:12");
  });

  it("rejects invalid email and weak password", () => {
    expect(createClientSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(createClientSchema.safeParse({ ...base, password: "weak" }).success).toBe(false);
    expect(changeEmailSchema.safeParse({ email: "a@b" }).success).toBe(false);
  });
});

describe("accountGuardError", () => {
  const admin = { id: "a", role: "super_admin" as const, is_active: true };
  const client = { id: "c", role: "owner" as const, is_active: true };

  it("blocks acting on yourself", () => {
    expect(accountGuardError({ action: "disable", actorId: "a", target: admin, activeSuperAdmins: 3 })).toBe("guard.selfDisable");
    expect(accountGuardError({ action: "delete", actorId: "a", target: admin, activeSuperAdmins: 3 })).toBe("guard.selfDelete");
  });

  it("blocks removing the last active super admin", () => {
    const other = { ...admin, id: "b" };
    expect(accountGuardError({ action: "delete", actorId: "a", target: other, activeSuperAdmins: 1 })).toBe("guard.lastDelete");
    expect(accountGuardError({ action: "disable", actorId: "a", target: other, activeSuperAdmins: 1 })).toBe("guard.lastDisable");
  });

  it("allows removing a super admin when another remains", () => {
    const other = { ...admin, id: "b" };
    expect(accountGuardError({ action: "delete", actorId: "a", target: other, activeSuperAdmins: 2 })).toBeNull();
  });

  it("allows ordinary clients and already disabled super admins", () => {
    expect(accountGuardError({ action: "delete", actorId: "a", target: client, activeSuperAdmins: 1 })).toBeNull();
    const inactive = { ...admin, id: "b", is_active: false };
    expect(accountGuardError({ action: "delete", actorId: "a", target: inactive, activeSuperAdmins: 1 })).toBeNull();
  });
});

describe("isDeleteConfirmed", () => {
  it("requires the exact email, ignoring case and outer spaces", () => {
    expect(isDeleteConfirmed(" Client@Example.com ", "client@example.com")).toBe(true);
    expect(isDeleteConfirmed("client@example", "client@example.com")).toBe(false);
    expect(isDeleteConfirmed("", "")).toBe(false);
  });
});

describe("list params", () => {
  it("falls back to safe defaults for unknown values", () => {
    expect(parseClientParams({ status: "weird", role: ["owner", "x"], page: "-4" })).toEqual({
      q: "",
      status: "all",
      role: "owner",
      page: 1,
    });
    expect(parseMuseumParams({ status: "published", page: "3" })).toEqual({ q: "", status: "published", page: 3 });
  });

  it("strips characters that could alter a PostgREST filter", () => {
    expect(sanitizeSearch(" a,b(c)%*\"d\\ ")).toBe("a b c d");
    expect(sanitizeSearch("x".repeat(200))).toHaveLength(80);
  });

  it("builds compact query strings", () => {
    expect(buildQuery({ q: "ana", status: "all", page: 1 })).toBe("?q=ana");
    expect(buildQuery({ q: "", page: 2, role: "owner" })).toBe("?page=2&role=owner");
    expect(buildQuery({})).toBe("");
  });

  it("computes the page count", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(16)).toBe(2);
  });
});
