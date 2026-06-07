import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; exp: number }>();

/**
 * Resolve a stored avatar path (e.g. "<uid>/avatar.jpg") to a usable URL.
 * Bucket is private, so we sign URLs and cache them in-memory for ~1h.
 */
export async function resolveAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.exp > now + 60_000) return cached.url;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: now + 60 * 60 * 1000 });
  return data.signedUrl;
}
