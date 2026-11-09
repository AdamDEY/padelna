import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import type { MyMatchInvite } from "@/types/match";

type InviteRow = {
  invite_id: string;
  match_id: string;
  seat: number;
  created_at: string;
  starts_at: string;
  level_min: number;
  level_max: number;
  kind: "friendly" | "competitive";
  club_name: string | null;
  court_number: number | null;
  host_id: string;
  host_first_name: string;
  host_last_name: string;
  host_level: number | null;
  host_avatar_url: string | null;
};

/** Invites you've received from a host that are still waiting for your answer, soonest match first. */
export async function fetchMyMatchInvites(): Promise<MyMatchInvite[]> {
  const { data, error } = await supabase.rpc("my_match_invites");
  if (error) throw error;
  return (data as InviteRow[]).map((row) => ({
    id: row.invite_id,
    matchId: row.match_id,
    seat: row.seat,
    createdAt: new Date(row.created_at),
    startsAt: new Date(row.starts_at),
    clubName: row.club_name ?? undefined,
    courtName: row.court_number !== null ? t("match.courtNumber", { number: row.court_number }) : undefined,
    levelMin: row.level_min,
    levelMax: row.level_max,
    kind: row.kind,
    host: {
      id: row.host_id,
      firstName: row.host_first_name,
      lastName: row.host_last_name,
      level: row.host_level ?? undefined,
      avatarUrl: row.host_avatar_url ?? undefined,
    },
  }));
}

/**
 * Adds a player to an open seat of a match you host. They get a notification and take the seat
 * once they accept; until then it is held for them. Throws with a readable message when it can't.
 */
export async function invitePlayerToMatch(matchId: string, seat: number, playerId: string) {
  const { error } = await supabase.rpc("invite_player_to_match", {
    p_match_id: matchId,
    p_seat: seat,
    p_player_id: playerId,
  });
  if (error) throw error;
}

/** Answers an invitation you received. Accepting takes the seat like joining does. */
export async function respondToMatchInvite(inviteId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_match_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
}

/** Takes back an invitation you sent that hasn't been answered, which reopens the seat. */
export async function cancelMatchInvite(inviteId: string) {
  const { error } = await supabase.rpc("cancel_match_invite", { p_invite_id: inviteId });
  if (error) throw error;
}
