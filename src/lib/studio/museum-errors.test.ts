import { describe, expect, it } from "vitest";
import { uniqueViolationTarget } from "./museum-errors";

describe("uniqueViolationTarget", () => {
  it("recognizes the one-museum-per-user constraint", () => {
    expect(
      uniqueViolationTarget({ code: "23505", message: 'duplicate key value violates unique constraint "museums_owner_id_key"' }),
    ).toBe("owner");
    expect(uniqueViolationTarget({ code: "23505", details: "Key (owner_id)=(abc) already exists." })).toBe("owner");
  });

  it("recognizes a taken public address", () => {
    expect(
      uniqueViolationTarget({ code: "23505", message: 'duplicate key value violates unique constraint "museums_slug_key"' }),
    ).toBe("slug");
  });

  it("falls back to other for unknown unique violations and ignores other errors", () => {
    expect(uniqueViolationTarget({ code: "23505", message: "boom" })).toBe("other");
    expect(uniqueViolationTarget({ code: "42501", message: "museums_owner_id_key" })).toBeNull();
    expect(uniqueViolationTarget(null)).toBeNull();
  });
});
