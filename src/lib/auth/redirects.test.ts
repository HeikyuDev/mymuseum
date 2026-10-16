import { describe, expect, it } from "vitest";
import { homeForRole, safeNextPath } from "./redirects";

describe("homeForRole", () => {
  it("routes roles to their area", () => {
    expect(homeForRole("super_admin")).toBe("/super");
    expect(homeForRole("owner")).toBe("/admin");
  });
});

describe("safeNextPath", () => {
  it("allows admin paths for everyone and super paths for super admins only", () => {
    expect(safeNextPath("/admin/halls", "owner")).toBe("/admin/halls");
    expect(safeNextPath("/super", "owner")).toBeNull();
    expect(safeNextPath("/super", "super_admin")).toBe("/super");
  });

  it("rejects external and malformed targets", () => {
    expect(safeNextPath("//evil.com", "owner")).toBeNull();
    expect(safeNextPath("https://evil.com", "owner")).toBeNull();
    expect(safeNextPath("/admin\\..", "owner")).toBeNull();
    expect(safeNextPath("/adminx", "owner")).toBeNull();
    expect(safeNextPath(undefined, "owner")).toBeNull();
  });
});
