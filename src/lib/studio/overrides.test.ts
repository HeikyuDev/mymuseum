import { describe, expect, it } from "vitest";
import { defaultLocaleSchema } from "@/lib/validation/schemas";
import { mergeOverrides } from "./overrides";

describe("mergeOverrides", () => {
  it("keeps stored values the patch does not mention", () => {
    const stored = { radius: "round", density: "compact", motion: "calm", allowVisitorExport: false, defaultLocale: "en" };
    const merged = mergeOverrides(stored, { motion: "lively" });
    expect(merged).toEqual({ ...stored, motion: "lively" });
  });

  it("ignores undefined patch values", () => {
    const merged = mergeOverrides({ defaultLocale: "en" }, { defaultLocale: undefined, radius: "sharp" });
    expect(merged.defaultLocale).toBe("en");
    expect(merged.radius).toBe("sharp");
  });

  it("stays backward compatible with rows saved before defaultLocale existed", () => {
    const legacy = { radius: "soft", density: "comfortable", motion: "normal", allowVisitorExport: true };
    expect(mergeOverrides(legacy, {}).defaultLocale).toBe("es");
    expect(mergeOverrides(legacy, { defaultLocale: "en" }).defaultLocale).toBe("en");
    expect(mergeOverrides(null, {}).defaultLocale).toBe("es");
  });
});

describe("defaultLocaleSchema", () => {
  it("accepts supported languages only", () => {
    expect(defaultLocaleSchema.safeParse({ defaultLocale: "es" }).success).toBe(true);
    expect(defaultLocaleSchema.safeParse({ defaultLocale: "en" }).success).toBe(true);
    const bad = defaultLocaleSchema.safeParse({ defaultLocale: "fr" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toBe("val.choose");
    expect(defaultLocaleSchema.safeParse({}).success).toBe(false);
  });
});
