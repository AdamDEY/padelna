import { t } from "i18next";

import type { AboutValues } from "@/components/setup-about-step";
import type { GameValues } from "@/components/setup-game-step";
import { toDateOnly } from "@/lib/age";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/repositories/auth-repository";
import type { MyAccount } from "@/types/account";

// The level quiz result screen isn't built yet, so every player starts here
const STARTING_LEVEL = 6;
const AVATAR_BUCKET = "avatars";

/** Whether the signed-in player has finished profile setup */
export async function hasProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** The signed-in player's saved details. */
export async function fetchMyAccount(): Promise<MyAccount> {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone, city, bio, hand, side, play_style, level, avatar_url")
    .eq("id", user.id)
    .single();
  if (error) throw error;

  return {
    id: user.id,
    email: user.email,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone,
    city: data.city,
    bio: data.bio,
    hand: data.hand as MyAccount["hand"],
    side: data.side as MyAccount["side"],
    playStyle: data.play_style as MyAccount["playStyle"],
    level: data.level ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
  };
}

export type ProfileEdits = Pick<
  MyAccount,
  "firstName" | "lastName" | "city" | "bio" | "hand" | "side" | "playStyle"
> & { photoUri?: string };

/** Saves the details changed in Edit profile. The phone, level and email aren't editable here. */
export async function updateProfile(userId: string, edits: ProfileEdits) {
  const avatarUrl = edits.photoUri ? await uploadAvatar(userId, edits.photoUri) : undefined;

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: edits.firstName.trim(),
      last_name: edits.lastName.trim(),
      city: edits.city,
      bio: edits.bio.trim(),
      hand: edits.hand,
      side: edits.side,
      play_style: edits.playStyle,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", userId);
  if (error) throw error;
}

/** Saves the profile setup answers for the signed-in player. */
export async function saveProfile(userId: string, about: AboutValues, game: GameValues) {
  const avatarUrl = about.photoUri ? await uploadAvatar(userId, about.photoUri) : undefined;

  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    first_name: about.firstName.trim(),
    last_name: about.lastName.trim(),
    gender: about.gender,
    birth_date: about.birthday ? toDateOnly(about.birthday) : undefined,
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
