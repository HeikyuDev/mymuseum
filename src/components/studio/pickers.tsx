"use client";

import type { ReactNode } from "react";
import { ArtworkFrame, computeFrame } from "@/components/viewer/ArtworkFrame";
import {
  FLOOR_DECORATION_SPECS,
  LIGHTING,
  decorationBody,
  floorLayer,
  wallLayer,
} from "@/components/viewer/scenery";
import type { LightMode } from "@/lib/hall-style";
import type { Translator } from "@/lib/i18n";
import { FONT_PAIRING_STACKS, THEME_PRESETS } from "@/lib/theme";
import type {
  FloorDecoration,
  FloorStyle,
  FontPairing,
  FrameStyle,
  LightingPreset,
  ThemePreset,
  WallStyle,
} from "@/types/database";
import { sampleArtworkImage } from "./sample-art";

export type Option<T extends string> = { value: T; label: string; preview: ReactNode };

type GroupProps<T extends string> = {
  legend: string;
  name: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Tailwind grid column classes. */
  columns?: string;
  hint?: string;
};

/** Accessible visual radio group: native radios (arrow keys work) with swatch previews. */
export function OptionGroup<T extends string>({ legend, name, value, options, onChange, columns = "grid-cols-3 sm:grid-cols-4", hint }: GroupProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      {hint ? <p className="mb-2 text-sm text-muted">{hint}</p> : null}
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => (
          <label key={option.value} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="block overflow-hidden rounded-theme border border-line bg-raised transition peer-checked:border-accent peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:border-muted">
              <span className="block aspect-[4/3] overflow-hidden">{option.preview}</span>
              <span className="block truncate px-2 py-1.5 text-center text-xs font-medium">{option.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const cover = "block h-full w-full";

export function wallOptions(t: Translator, customColor: string | null, values: readonly WallStyle[]): Option<WallStyle>[] {
  return values.map((value) => ({
    value,
    label: t(`wall.${value}` as const),
    preview: <span className={cover} style={wallLayer(value, customColor ?? "#d9d4c8")} />,
  }));
}

export function floorOptions(t: Translator, values: readonly FloorStyle[]): Option<FloorStyle>[] {
  return values.map((value) => ({
    value,
    label: t(`floor.${value}` as const),
    preview: <span className={cover} style={floorLayer(value)} />,
  }));
}

export function decorationOptions(t: Translator, floor: FloorStyle, color: string | null, values: readonly FloorDecoration[]): Option<FloorDecoration>[] {
  return values.map((value) => ({
    value,
    label: t(`deco.${value}` as const),
    preview: (
      <span className={`${cover} relative`} style={floorLayer(floor)}>
        {value !== "none" ? (
          <span
            className="absolute inset-x-[12%] top-[28%] bottom-[28%] box-border"
            style={{
              ...decorationBody(value, color ?? FLOOR_DECORATION_SPECS[value].color),
              borderRadius: value === "spotlight_pool" ? "50%" : undefined,
              borderWidth: 2,
            }}
          />
        ) : null}
      </span>
    ),
  }));
}

const LIGHTING_KEYS = {
  warm: "export.lightingWarm",
  cold: "export.lightingCold",
  dramatic: "export.lightingDramatic",
  soft: "export.lightingSoft",
} as const satisfies Record<LightingPreset, string>;

export function lightingOptions(t: Translator, values: readonly LightingPreset[]): Option<LightingPreset>[] {
  return values.map((value) => {
    const light = LIGHTING[value];
    return {
      value,
      label: t(LIGHTING_KEYS[value]),
      preview: (
        <span
          className={cover}
          style={{
            backgroundColor: "#ece8e0",
            backgroundImage: `radial-gradient(ellipse at 50% 35%, rgba(${light.tint}, ${Math.min(light.cone * 2.2, 0.95)}) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,${light.vignette}) 100%), linear-gradient(${light.ambient}, ${light.ambient})`,
          }}
        />
      ),
    };
  });
}

const LIGHT_MODE_PREVIEW: Record<LightMode, string> = {
  default: "radial-gradient(ellipse at 50% 30%, rgba(255,246,220,0.95) 0%, rgba(255,246,220,0) 62%), #d8d2c6",
  soft: "radial-gradient(ellipse at 50% 30%, rgba(255,246,220,0.55) 0%, rgba(255,246,220,0) 80%), #d8d2c6",
  dim: "radial-gradient(ellipse at 50% 30%, rgba(255,230,180,0.4) 0%, rgba(0,0,0,0) 60%), #6f695e",
  off: "#cfcabf",
};

export function lightModeOptions(t: Translator, values: readonly LightMode[]): Option<LightMode>[] {
  return values.map((value) => ({
    value,
    label: t(`cat.lightMode.${value}` as const),
    preview: <span className={cover} style={{ background: LIGHT_MODE_PREVIEW[value] }} />,
  }));
}

/** Frame swatches render the real viewer frame around a sample picture. */
export function frameOptions(t: Translator, values: readonly FrameStyle[], color: string | null, withMat: boolean, matColor: string | null): Option<FrameStyle>[] {
  return values.map((value) => {
    const metrics = computeFrame(1.3, 92, 70, value, withMat);
    return {
      value,
      label: t(`frame.${value}` as const),
      preview: (
        <span className="flex h-full w-full items-center justify-center" style={wallLayer("plaster", null)}>
          <ArtworkFrame
            artwork={{
              id: value,
              title: t(`frame.${value}` as const),
              description: null,
              author: null,
              year: null,
              imageUrl: sampleArtworkImage(0, 1.3),
              aspect: 1.3,
              frameStyle: value,
              frameColor: color,
              mat: withMat,
              matColor,
            }}
            metrics={metrics}
            eager={false}
            onLoadRatio={() => {}}
          />
        </span>
      ),
    };
  });
}

export function themePresetOptions(t: Translator, values: readonly ThemePreset[], accent: string): Option<ThemePreset>[] {
  return values.map((value) => {
    const palette = THEME_PRESETS[value];
    return {
      value,
      label: t(`theme.${value}` as const),
      preview: (
        <span className={`${cover} flex flex-col`} style={{ background: palette.canvas }}>
          <span className="flex h-[22%] items-center gap-1 px-1.5" style={{ background: palette.raised, borderBottom: `1px solid ${palette.line}` }}>
            <span className="h-1 w-6 rounded-full" style={{ background: palette.fg }} />
            <span className="ml-auto size-1.5 rounded-full" style={{ background: accent }} />
          </span>
          <span className="flex flex-1 gap-1 p-1.5">
            <span className="flex-1 rounded-[3px]" style={{ background: palette.surface }} />
            <span className="flex-1 rounded-[3px]" style={{ background: palette.surface }} />
          </span>
          <span className="mx-1.5 mb-1.5 h-1.5 w-8 rounded-full" style={{ background: palette.muted }} />
        </span>
      ),
    };
  });
}

export function fontOptions(t: Translator, values: readonly FontPairing[]): Option<FontPairing>[] {
  return values.map((value) => ({
    value,
    label: t(`font.${value}` as const),
    preview: (
      <span className={`${cover} flex flex-col items-center justify-center bg-surface`}>
        <span className="text-3xl leading-none" style={{ fontFamily: FONT_PAIRING_STACKS[value].display }}>
          Aa
        </span>
        <span className="mt-1 text-[10px] text-muted" style={{ fontFamily: FONT_PAIRING_STACKS[value].body }}>
          {t("font.sampleBody")}
        </span>
      </span>
    ),
  }));
}

type ColorFieldProps = {
  id: string;
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
  /** When set, shows a button that clears the value back to "automatic". */
  clearLabel?: string;
};

export function ColorField({ id, label, value, fallback, onChange, clearLabel }: ColorFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value ?? fallback}
          onChange={(event) => onChange(event.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-theme border border-line bg-raised p-1"
        />
        <span className="font-mono text-sm text-muted">{(value ?? fallback).toUpperCase()}</span>
        {clearLabel && value ? (
          <button type="button" onClick={() => onChange(null)} className="ml-auto text-sm font-medium text-accent-text underline-offset-4 hover:underline">
            {clearLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-sm text-muted">{description}</span> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-accent peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}
