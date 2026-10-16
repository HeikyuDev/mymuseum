import { describe, expect, it } from "vitest";
import { DICTIONARIES, LOCALES } from "./dictionaries";
import { createTranslator, isLocale, resolveLocale, translate } from "./index";

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
