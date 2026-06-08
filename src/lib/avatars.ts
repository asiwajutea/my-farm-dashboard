// Preset avatars served as static assets from `public/avatars`. Users pick one
// of these instead of uploading a file — this keeps avatar storage/bandwidth at
// zero (no per-user image uploads or signed-URL fetches).

export type PresetAvatar = { id: string; url: string };

export const PRESET_AVATARS: PresetAvatar[] = Array.from({ length: 12 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: n, url: `/avatars/${n}.svg` };
});

// The avatar assigned to new Farmers at signup (kept in sync with the
// handle_new_user() DB trigger default).
export const DEFAULT_AVATAR_URL = PRESET_AVATARS[0].url;

/** True when a stored avatar_url points at one of our preset assets. */
export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/avatars/");
}
