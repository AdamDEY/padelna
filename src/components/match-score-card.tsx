import { Image } from "expo-image";
import { cn } from "heroui-native";
import { t } from "i18next";
import { Clock, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { useMatchPhotoUrl } from "@/hooks/useMatches";
import { formatShortMatchDateTime } from "@/lib/format-date";
import { teamOf, winningTeam } from "@/lib/padel-score";
import type { MatchDetails, MatchScore } from "@/types/match";
import type { Player } from "@/types/player";

const statusTones = {
  waiting: { icon: Clock, color: "warning", text: "text-warning" },
  confirmed: { icon: ShieldCheck, color: "success", text: "text-success" },
  expired: { icon: Clock, color: "attention", text: "text-attention" },
} as const satisfies Record<
  string,
  { icon: LucideIcon; color: string; text: string }
>;

// design (Past match recap): the team photo sits above the score, radius 20
const PHOTO_HEIGHT = 170;

// Friendly is blue, competitive ink, like the result cards in Community
const kindTones = {
  friendly: {
    bg: "bg-primary-soft",
    text: "text-primary-dark",
    label: "match.kind.friendly",
  },
  competitive: {
    bg: "bg-foreground",
    text: "text-accent-foreground",
    label: "match.kind.competitive",
  },
} as const;

function names(team: Player[], myId: string) {
  const mine = team.find((player) => player.id === myId);
  const others = team
    .filter((player) => player !== mine)
    .map((player) => player.firstName);
  return (mine ? [t("common.you"), ...others] : others).join(" · ");
}

/** The status line above the score: who has to act next, or that it's settled. */
function statusOf(
  match: MatchDetails,
  score: MatchScore,
  myId: string,
  teams: Player[][],
) {
  if (score.status === "confirmed") {
    return {
      tone: statusTones.confirmed,
      label: t("score.confirmed"),
    };
  }
  if (score.status === "expired") {
    return {
      tone: statusTones.expired,
      label: t("score.expired"),
    };
  }
  const deadline = formatShortMatchDateTime(score.expiresAt);
  if (teamOf(match, myId) === score.submittedTeam) {
    // The host's guests aren't on the app, so they can't confirm
    const others = teams[score.submittedTeam === 1 ? 1 : 0]
      .filter((player) => !player.id.startsWith("guest-"))
      .map((player) => player.firstName);
    return {
      tone: statusTones.waiting,
      label: t("score.waitingFor", { names: others.join(t("score.or")), deadline }),
    };
  }
  const sender = match.seats?.find(
    (player) => player?.id === score.submittedBy,
  );
  return {
    tone: statusTones.waiting,
    label: t("score.sentBy", { name: sender?.firstName ?? t("score.otherTeam"), deadline }),
  };
}

type MatchScoreCardProps = {
  match: MatchDetails & { score: MatchScore };
  myId: string;
};

/**
 * A finished match's score set by set (design: Past match recap): the winner's sets in
 * 900, the loser's muted, with a WIN tag and a line saying where confirmation stands.
 */
export function MatchScoreCard({ match, myId }: MatchScoreCardProps) {
  const { t } = useTranslation();
  const { score } = match;
  const seats = match.seats ?? match.players;
  const teams = [seats.slice(0, 2), seats.slice(2, 4)].map((team) =>
    team.filter((player): player is Player => player !== undefined),
  );
  const winner = winningTeam(score.sets);
  const status = statusOf(match, score, myId, teams);
  const kind = kindTones[match.kind];
  const { data: photoUrl } = useMatchPhotoUrl(score.photoPath);

  return (
    <View className="gap-3">
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          contentFit="cover"
          accessibilityLabel={t("score.photo")}
          accessibilityIgnoresInvertColors
          style={{ height: PHOTO_HEIGHT, borderRadius: 20 }}
        />
      ) : null}
      <View className="gap-2.5 rounded-[20px] border border-line bg-surface p-3.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text
            accessibilityRole="header"
            className="font-black text-[15px] text-foreground"
          >
            {t("score.title")}
          </Text>
          <Text
            className={cn(
              "overflow-hidden rounded-lg px-2 py-0.5 font-bold text-[12px]",
              kind.bg,
              kind.text,
            )}
          >
            {t(kind.label)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="flex-1" />
          {score.sets.map((_, index) => (
            <Text
              key={index}
              className="w-8 text-center font-bold text-[12px] text-muted"
            >
              S{index + 1}
            </Text>
          ))}
        </View>

        {teams.map((team, teamIndex) => {
          const isWinner = winner === teamIndex + 1;
          const tints = stackTintIndices(team);
          const teamNames = names(team, myId);
          return (
            <View
              key={teamIndex}
              accessible
              accessibilityLabel={`${teamNames}${isWinner ? `, ${t("score.won")}` : `, ${t("score.lost")}`}: ${score.sets
                .map((set) => set[teamIndex])
                .join(", ")}`}
              className="flex-row items-center gap-1.5"
            >
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <View className="flex-row">
                  {team.map((player, index) => (
                    <PlayerAvatar
                      key={player.id}
                      player={player}
                      size={26}
                      tintIndex={tints[index]}
                      ringClassName="border-surface"
                      className={index > 0 ? "-ms-2" : undefined}
                    />
                  ))}
                </View>
                <Text
                  numberOfLines={1}
                  className={cn(
                    "shrink text-[14px]",
                    isWinner
                      ? "font-black text-foreground"
                      : "font-semibold text-ink-2",
                  )}
                >
                  {teamNames}
                </Text>
                {isWinner ? (
                  <Text className="overflow-hidden rounded-md bg-lime-soft px-1.5 py-0.5 font-bold text-[11px] text-lime-foreground">
                    {t("score.win")}
                  </Text>
                ) : null}
              </View>
              {score.sets.map((set, setIndex) => {
                const wonSet = set[teamIndex] > set[1 - teamIndex];
                return (
                  <Text
                    key={setIndex}
                    className={cn(
                      "w-8 text-center text-[16px]",
                      wonSet
                        ? "font-black text-foreground"
                        : "font-semibold text-muted",
                    )}
                  >
                    {set[teamIndex]}
                  </Text>
                );
              })}
            </View>
          );
        })}

        <View className="flex-row items-center gap-1.5 border-t border-line pt-2.5">
          <Icon as={status.tone.icon} size={14} color={status.tone.color} />
          <Text
            className={cn("flex-1 font-bold text-[13px]", status.tone.text)}
          >
            {status.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
