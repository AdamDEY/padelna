import type { AboutValues } from "@/components/setup-about-step";
import type { GameValues } from "@/components/setup-game-step";
import { supabase } from "@/lib/supabase";

/** Whether the signed-in player has finished profile setup */
export async function hasProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Saves the profile setup answers for the signed-in player. */
export async function saveProfile(userId: string, about: AboutValues, game: GameValues) {
  // The profile photo isn't uploaded yet; that needs Supabase Storage
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
  });
  if (error) throw error;
}
