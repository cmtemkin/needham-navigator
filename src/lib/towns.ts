import {
  DEFAULT_TOWN_ID as DEFAULT_TOWN_ID_FROM_CONFIG,
  TOWNS,
  type TownConfig,
} from "../../config/towns";

export type { TownConfig };

export const DEFAULT_TOWN_ID = DEFAULT_TOWN_ID_FROM_CONFIG;
export const TOWN_CONFIGS = TOWNS;

const townById = new Map<string, TownConfig>(
  TOWN_CONFIGS.map((town) => [town.town_id, town])
);

export function getTownById(townId: string): TownConfig | undefined {
  return townById.get(townId);
}

export function getTownByIdOrDefault(townId?: string | null): TownConfig {
  const normalized = townId?.trim().toLowerCase();
  if (normalized) {
    const town = getTownById(normalized);
    if (town) {
      return town;
    }
  }

  return townById.get(DEFAULT_TOWN_ID) ?? TOWN_CONFIGS[0];
}

export function getTownIds(): string[] {
  return TOWN_CONFIGS.map((town) => town.town_id);
}
