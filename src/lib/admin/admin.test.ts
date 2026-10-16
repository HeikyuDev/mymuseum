import { describe, expect, it } from "vitest";
import { accountGuardError, isDeleteConfirmed } from "./guards";
import { buildQuery, pageCount, parseClientParams, parseMuseumParams, sanitizeSearch } from "./params";
import { generateTempPassword, passwordStrength, validatePassword } from "./password";
import { changeEmailSchema, createClientSchema, resolveInitialMuseum } from "./validation";

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
    expect(validatePassword("Short1")).toMatch(/at least 12/);
    expect(validatePassword("alllowercase123")).toMatch(/uppercase/);
    expect(validatePassword("ABCDEFGHIJKL1234")).toMatch(/lowercase/);
    expect(validatePassword("x".repeat(73))).toMatch(/at most 72/);
  });

  it("accepts a reasonable password", () => {
    expect(validatePassword("Correct7Horse")).toBeNull();
  });

  it("scores strength by length and variety", () => {
    expect(passwordStrength("abc").label).toBe("Too weak");
    expect(passwordStrength("abcdefgh").label).toBe("Weak");
    expect(passwordStrength(generateTempPassword()).label).toBe("Strong");
  });
});

describe("createClientSchema", () => {
  const base = { email: "  Client@Example.COM ", displayName: " Ana ", password: "Correct7Horse" };

  it("normalizes the email and accepts a client without a museum", () => {
    const parsed = createClientSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("client@example.com");
      expect(parsed.data.displayName).toBe("Ana");
      expect(resolveInitialMuseum(parsed.data)).toBeNull();
    }
  });

  it("derives the slug from the title when none is given", () => {
    const parsed = createClientSchema.parse({ ...base, museumTitle: "Galería de Ana" });
    expect(resolveInitialMuseum(parsed)).toEqual({ title: "Galería de Ana", slug: "galeria-de-ana" });
  });

  it("rejects reserved and malformed slugs", () => {
    const reserved = createClientSchema.safeParse({ ...base, museumTitle: "Admin", museumSlug: "admin" });
    expect(reserved.success).toBe(false);
    const malformed = createClientSchema.safeParse({ ...base, museumTitle: "Ok", museumSlug: "Bad Slug" });
    expect(malformed.success).toBe(false);
  });

  it("rejects an address without a title", () => {
    expect(createClientSchema.safeParse({ ...base, museumSlug: "my-museum" }).success).toBe(false);
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
    expect(accountGuardError({ action: "disable", actorId: "a", target: admin, activeSuperAdmins: 3 })).toMatch(/own account/);
    expect(accountGuardError({ action: "delete", actorId: "a", target: admin, activeSuperAdmins: 3 })).toMatch(/own account/);
  });

  it("blocks removing the last active super admin", () => {
    const other = { ...admin, id: "b" };
    expect(accountGuardError({ action: "delete", actorId: "a", target: other, activeSuperAdmins: 1 })).toMatch(/last active super admin/);
    expect(accountGuardError({ action: "disable", actorId: "a", target: other, activeSuperAdmins: 1 })).toMatch(/last active super admin/);
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
