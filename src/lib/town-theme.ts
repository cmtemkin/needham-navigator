import type { CSSProperties } from "react";
import type { TownConfig } from "@/lib/towns";

export function getTownThemeStyle(town: TownConfig): CSSProperties {
  return {
    ["--primary" as string]: town.brand_colors.primary,
    ["--primary-dark" as string]: town.brand_colors.primary_dark,
    ["--primary-light" as string]: town.brand_colors.primary_light,
    ["--accent" as string]: town.brand_colors.accent,
    ["--accent-light" as string]: town.brand_colors.accent_light,
    ["--bg" as string]: town.brand_colors.background,
    ["--surface" as string]: town.brand_colors.surface,
    ["--text-primary" as string]: town.brand_colors.text_primary,
    ["--text-secondary" as string]: town.brand_colors.text_secondary,
    ["--text-muted" as string]: town.brand_colors.text_muted,
    ["--border" as string]: town.brand_colors.border,
    ["--border-light" as string]: town.brand_colors.border_light,
    ["--success" as string]: town.brand_colors.success,
    ["--warning" as string]: town.brand_colors.warning,
  };
}
