// Preset avatars served as static assets from `public/avatars`. Users pick one
// of these instead of uploading a file — this keeps avatar storage/bandwidth at
// zero (no per-user image uploads or signed-URL fetches).

export type PresetAvatar = { id: string; url: string; label: string };

// Each preset shares the same numbered gradient background but carries a unique
// farming-themed icon. Labels are used for accessible names / tooltips.
const AVATAR_LABELS = [
  "Seedling",
  "Wheat",
  "Tractor",
  "Sun",
  "Watering can",
  "Carrot",
  "Corn",
  "Barn",
  "Hen",
  "Water drop",
  "Apple",
  "Leaf",
] as const;

export const PRESET_AVATARS: PresetAvatar[] = AVATAR_LABELS.map((label, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: n, url: `/avatars/${n}.svg`, label };
});

// The avatar assigned to new Farmers at signup (kept in sync with the
// handle_new_user() DB trigger default).
export const DEFAULT_AVATAR_URL = PRESET_AVATARS[0].url;

/** True when a stored avatar_url points at one of our preset assets. */
export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/avatars/");
}

/** Find the preset metadata for a stored avatar url, if it is a preset. */
export function findPresetAvatar(url: string | null | undefined): PresetAvatar | undefined {
  if (!url) return undefined;
  return PRESET_AVATARS.find((a) => a.url === url);
}
