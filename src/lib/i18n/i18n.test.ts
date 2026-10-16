import { describe, expect, it } from "vitest";
import { DICTIONARIES, LOCALES } from "./dictionaries";
import { accountGuardError } from "@/lib/admin/guards";
import { validatePassword } from "@/lib/admin/password";
import { validateImageFile } from "@/lib/images";
import { validateSlug } from "@/lib/validation/slug";
import { formatDate } from "./format";
import { createTranslator, isLocale, resolveLocale, translate, translateCode } from "./index";

describe("i18n", () => {
  it("keeps both dictionaries on the same keys with no empty values", () => {
    const es = Object.keys(DICTIONARIES.es).sort();
    const en = Object.keys(DICTIONARIES.en).sort();
    expect(en).toEqual(es);
    for (const locale of LOCALES) {
      for (const value of Object.values(DICTIONARIES[locale])) expect(value.trim()).not.toBe("");
    }
  });

  it("uses the same placeholders in every language", () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(DICTIONARIES.es) as (keyof typeof DICTIONARIES.es)[]) {
      expect(placeholders(DICTIONARIES.en[key])).toEqual(placeholders(DICTIONARIES.es[key]));
    }
  });

  it("validates and resolves locales with Spanish as the default", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(resolveLocale(undefined)).toBe("es");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("zz", "en")).toBe("en");
  });

  it("interpolates params and leaves unknown placeholders intact", () => {
    expect(translate("es", "viewer.nowViewing", { title: "La noche" })).toBe("Estás viendo La noche");
    expect(translate("en", "viewer.nowViewing", { title: "Night" })).toBe("Now viewing Night");
    expect(translate("en", "viewer.nowViewing")).toBe("Now viewing {title}");
    expect(createTranslator("en")("viewer.next")).toBe("Next artwork");
  });
});

describe("translateCode", () => {
  const t = createTranslator("es");

  it("translates plain and parameterized validation codes", () => {
    expect(translateCode(t, "val.required")).toBe("Este dato es obligatorio.");
    expect(translateCode(t, "val.max:120")).toBe("Usá como máximo 120 caracteres.");
    expect(translateCode(createTranslator("en"), "val.slugMin:3")).toBe("Use at least 3 characters.");
  });

  it("passes already localized text through untouched", () => {
    expect(translateCode(t, "Referencia: abc123")).toBe("Referencia: abc123");
    expect(translateCode(t, "Se subió 1 obra.")).toBe("Se subió 1 obra.");
  });

  it("covers every code produced by the pure validation helpers", () => {
    const codes = [
      validateSlug("ab"), validateSlug("a".repeat(41)), validateSlug("Bad Slug"), validateSlug("admin"),
      validatePassword("short"), validatePassword("x".repeat(80)), validatePassword("alllowercase123"),
      validateImageFile({ type: "image/gif", size: 1 }), validateImageFile({ type: "image/png", size: 1e9 }), validateImageFile({ type: "image/png", size: 0 }),
      accountGuardError({ action: "disable", actorId: "a", target: { id: "a", role: "owner", is_active: true }, activeSuperAdmins: 2 }),
    ];
    for (const code of codes) {
      expect(code).not.toBeNull();
      for (const locale of LOCALES) {
        const text = translateCode(createTranslator(locale), code as string);
        expect(text).not.toMatch(/^[a-z]+\.\w+/);
        expect(text.trim()).not.toBe("");
      }
    }
  });
});

describe("formatDate", () => {
  it("formats in the interface language and in UTC", () => {
    expect(formatDate("2026-10-15T23:30:00Z", "en")).toBe("Oct 15, 2026");
    expect(formatDate("2026-10-15T23:30:00Z", "es")).toMatch(/15/);
    expect(formatDate("2026-10-15T23:30:00Z", "es")).toMatch(/oct/i);
  });
});
