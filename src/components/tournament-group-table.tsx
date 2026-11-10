import { cn } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PlayerAvatar } from "@/components/player-avatar";
import { entryName, playersOf, QUALIFIERS_PER_GROUP, type StandingRow } from "@/lib/tournament-live";
import type { Player } from "@/types/player";

const AVATAR_SIZE = 26;
// Narrow numeric columns (design "Tournament live · groups")
const COLUMN = 28;
const DIFF_COLUMN = 36;

type TournamentGroupTableProps = {
  label: string;
  rows: StandingRow[];
  myEntryId?: string;
  myId?: string;
  /** Replaces "Top 2 go through", e.g. "You finished 2nd" in a recap */
  caption?: string;
};

/** A group's table: rank, pair, wins, losses, set difference, points. The top two go through. */
export function TournamentGroupTable({ label, rows, myEntryId, myId, caption }: TournamentGroupTableProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-1 rounded-[20px] border border-line bg-surface px-2.5 pb-2.5 pt-3.5">
      <View className="flex-row items-baseline justify-between px-2.5 pb-1.5">
        <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
          {t("tournaments.live.group", { group: label })}
        </Text>
        <Text className="font-bold text-[12px] text-success-soft-foreground">
          {caption ?? t("tournaments.live.topGoThrough", { count: QUALIFIERS_PER_GROUP })}
        </Text>
      </View>

      <View className="flex-row items-center gap-1.5 px-2.5 pb-1.5" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text className="w-[18px] font-bold text-[11px] uppercase text-muted">#</Text>
        <Text className="flex-1 font-bold text-[11px] uppercase text-muted">{t("tournaments.live.team")}</Text>
        <Text style={{ width: COLUMN }} className="text-center font-bold text-[11px] uppercase text-muted">{t("tournaments.live.wonShort")}</Text>
        <Text style={{ width: COLUMN }} className="text-center font-bold text-[11px] uppercase text-muted">{t("tournaments.live.lostShort")}</Text>
        <Text style={{ width: DIFF_COLUMN }} className="text-center font-bold text-[11px] uppercase text-muted">+/-</Text>
        <Text style={{ width: COLUMN }} className="text-right font-bold text-[11px] uppercase text-muted">{t("tournaments.live.pointsShort")}</Text>
      </View>

      {rows.map((row) => {
        const isMine = row.entry.id === myEntryId;
        const isThrough = row.rank <= QUALIFIERS_PER_GROUP;
        const name = entryName(row.entry, myEntryId, myId);
        const faces: Player[] = playersOf(row.entry);
        return (
          <View
            key={row.entry.id}
            accessible
            accessibilityLabel={t("tournaments.live.rowA11y", {
              rank: row.rank,
              name,
              wins: row.wins,
              losses: row.losses,
              points: row.points,
            })}
            className={cn("flex-row items-center gap-1.5 rounded-xl px-2.5 py-2", isMine && "bg-primary-soft")}
          >
            <Text className={cn("w-[18px] font-black text-[14px]", isThrough ? "text-success-soft-foreground" : "text-muted")}>{row.rank}</Text>
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              {faces.length > 0 ? (
                <View className="flex-row">
                  {faces.map((player, index) => (
                    <PlayerAvatar
                      key={player.id}
                      player={player}
                      size={AVATAR_SIZE}
                      ringClassName={isMine ? "border-primary-soft" : "border-surface"}
                      className={index > 0 ? "-ms-1" : undefined}
                    />
                  ))}
                </View>
              ) : null}
              <Text numberOfLines={1} className="shrink font-bold text-[13px] text-foreground">
                {name}
              </Text>
            </View>
            <Text style={{ width: COLUMN }} className="text-center font-normal text-[14px] text-foreground">{row.wins}</Text>
            <Text style={{ width: COLUMN }} className="text-center font-normal text-[14px] text-foreground">{row.losses}</Text>
            <Text style={{ width: DIFF_COLUMN }} className="text-center font-normal text-[14px] text-muted">
              {row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}
            </Text>
            <Text style={{ width: COLUMN }} className="text-right font-black text-[14px] text-foreground">{row.points}</Text>
          </View>
        );
      })}
    </View>
  );
}
