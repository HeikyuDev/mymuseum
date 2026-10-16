import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { fallbackForRole, homeForRole, isProtectedPath, loginPathFor, safeNextPath } from "./redirects";

describe("homeForRole", () => {
  it("sends the platform admin to /admin and everyone else to /studio", () => {
    expect(homeForRole("super_admin")).toBe("/admin");
    expect(homeForRole("owner")).toBe("/studio");
    expect(fallbackForRole("owner")).toBe("/studio");
  });
});

describe("isProtectedPath", () => {
  it("protects the platform admin and the studio, nothing else", () => {
    for (const path of ["/admin", "/admin/clients/new", "/studio", "/studio/halls/abc"]) {
      expect(isProtectedPath(path)).toBe(true);
    }
    for (const path of ["/", "/login", "/m/demo", "/adminx", "/studios", "/super"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });
});

describe("loginPathFor", () => {
  it("keeps the requested target, including its query string, URL-encoded", () => {
    expect(loginPathFor("/admin")).toBe("/login?next=%2Fadmin");
    expect(loginPathFor("/admin/clients", "?q=ana&page=2")).toBe("/login?next=%2Fadmin%2Fclients%3Fq%3Dana%26page%3D2");
  });
});

describe("safeNextPath", () => {
  it("allows studio paths for everyone and admin paths for super admins only", () => {
    expect(safeNextPath("/studio/halls", "owner")).toBe("/studio/halls");
    expect(safeNextPath("/studio", "super_admin")).toBe("/studio");
    expect(safeNextPath("/admin", "owner")).toBeNull();
    expect(safeNextPath("/admin/clients?q=a", "owner")).toBeNull();
    expect(safeNextPath("/admin/clients?q=a", "super_admin")).toBe("/admin/clients?q=a");
  });

  it("does not follow the retired /super area", () => {
    expect(safeNextPath("/super", "super_admin")).toBeNull();
  });

  it("rejects external and malformed targets", () => {
    expect(safeNextPath("//evil.com", "owner")).toBeNull();
    expect(safeNextPath("https://evil.com", "owner")).toBeNull();
    expect(safeNextPath("/studio\\..", "owner")).toBeNull();
    expect(safeNextPath("/studiox", "owner")).toBeNull();
    expect(safeNextPath("/adminx", "super_admin")).toBeNull();
    expect(safeNextPath(undefined, "owner")).toBeNull();
  });
});

describe("legacy redirects", () => {
  it("permanently redirects /super/* to /admin/* and leaves /admin/* alone", async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    expect(rules).toEqual([{ source: "/super/:path*", destination: "/admin/:path*", permanent: true }]);
  });
});
