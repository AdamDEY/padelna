import type { AboutValues } from "@/components/setup-about-step";
import type { GameValues } from "@/components/setup-game-step";
import { supabase } from "@/lib/supabase";

// The level quiz result screen isn't built yet, so every player starts here
const STARTING_LEVEL = 6;
const AVATAR_BUCKET = "avatars";

/** Whether the signed-in player has finished profile setup */
export async function hasProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Uploads the picked photo to the player's own folder and returns its public URL. */
async function uploadAvatar(userId: string, uri: string) {
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  // The picker returns JPEG by default; keep the extension in line with the real type
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const extension = contentType.split("/")[1] ?? "jpg";
  const path = `${userId}/avatar.${extension}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Same path on every upload, so a changing query keeps the old photo out of the image cache
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Saves the profile setup answers for the signed-in player. */
export async function saveProfile(userId: string, about: AboutValues, game: GameValues) {
  const avatarUrl = about.photoUri ? await uploadAvatar(userId, about.photoUri) : undefined;

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    first_name: about.firstName.trim(),
    last_name: about.lastName.trim(),
    phone: about.phone.replace(/\s/g, ""),
    city: about.city,
    bio: about.bio.trim(),
    hand: game.hand,
    side: game.side,
    play_style: game.playStyle,
    level: STARTING_LEVEL,
    // Left out when no photo was picked, so a retry never wipes an existing one
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  });
  if (error) throw error;
}
