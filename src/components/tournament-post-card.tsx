import { cn, PressableFeedback } from "heroui-native";
import { ArrowLeftRight, ChevronRight, Trophy } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { ResultPostCardSkeleton } from "@/components/result-post-card-skeleton";
import { useFinishedTournament } from "@/hooks/useTournaments";
import { tournamentPostCard } from "@/lib/tournament-post";
import type { Player, PlayerSuggestion } from "@/types/player";
import type { FeedTournamentPost } from "@/types/post";

type TournamentPostCardProps = {
  post: FeedTournamentPost;
  /** The signed-in player, so the card says "You" and compares their own result */
  myId: string;
  onPlayerPress: (player: Player) => void;
  onOpenTournament: (tournamentId: string, viewerPlayed: boolean) => void;
};

/**
 * A tournament result a player posted to the Community (design "Community · tournament result
 * posts"): a blue card with the final for group + knockout, a light one with the place and points
 * for an Americano.
 */
export function TournamentPostCard({ post, myId, onPlayerPress, onOpenTournament }: TournamentPostCardProps) {
  const { t } = useTranslation();
  const { data: tournament, isPending } = useFinishedTournament(post.tournamentId);
  const card = useMemo(() => (tournament ? tournamentPostCard(tournament, post, myId) : undefined), [tournament, post, myId]);

  if (isPending) return <ResultPostCardSkeleton label={t("tournamentPost.loading")} count={1} />;
  // A tournament that was removed, or a post whose author isn't in it, has nothing to show
  if (!card) return null;

  const faces: PlayerSuggestion[] = [post.author, ...(post.partner ? [post.partner] : [])];
  const tints = stackTintIndices(faces);

  return (
    <View className="gap-3 rounded-3xl border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-2.5">
        <View className="flex-row">
          {faces.map((player, index) => (
            <PressableFeedback
              key={player.id}
              accessibilityRole="button"
              accessibilityLabel={`${player.firstName} ${player.lastName}`}
              onPress={() => onPlayerPress(player)}
              className={cn(index > 0 && "-ms-3")}
            >
              <PlayerAvatar
                player={player}
                size={faces.length > 1 ? 36 : 40}
                tintIndex={tints[index]}
                ringClassName={faces.length > 1 ? "border-surface" : undefined}
              />
            </PressableFeedback>
          ))}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-[15px] leading-[19px] text-foreground">{card.title}</Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {card.meta}
          </Text>
        </View>
      </View>

      {post.caption ? <Text className="font-normal text-[14px] leading-[20px] text-ink-2">{post.caption}</Text> : null}

      {card.format === "groups" ? (
        <View className="gap-3 rounded-[18px] bg-accent p-3.5">
          <View className="flex-row items-center gap-2.5">
            <View className="size-10 items-center justify-center rounded-xl bg-lime">
              <Icon as={Trophy} size={22} color="lime-foreground" />
            </View>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="font-black text-[16px] text-lime">
                {card.headline}
              </Text>
              <Text numberOfLines={1} className="font-normal text-[12px] text-primary-tint-text">
                {card.detail}
              </Text>
            </View>
            {card.chip ? (
              <View className="rounded-[9px] bg-white/15 px-[9px] py-1">
                <Text className="font-bold text-[12px] text-accent-foreground">{card.chip}</Text>
              </View>
            ) : null}
          </View>

          {card.match ? (
            <View className="gap-1.5 rounded-[14px] bg-white/12 px-3 py-2.5">
              <Text className="font-bold text-[11px] uppercase tracking-[0.6px] text-primary-tint-text">{card.match.label}</Text>
              {card.match.rows.map((row, index) => (
                <View key={index} className="flex-row items-center gap-1.5">
                  <Text
                    numberOfLines={1}
                    className={cn("flex-1 text-[14px]", row.isWinner ? "font-black text-accent-foreground" : "font-bold text-primary-tint-text")}
                  >
                    {row.name}
                  </Text>
                  {row.values.map((value, valueIndex) => (
                    <Text
                      key={valueIndex}
                      className={cn(
                        "w-[26px] text-center text-[16px]",
                        row.isWinner ? "font-black text-accent-foreground" : "font-bold text-primary-tint-text",
                      )}
                    >
                      {value}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View className="flex-row items-center gap-3 rounded-2xl bg-primary-soft p-3">
          <View className="size-10 items-center justify-center rounded-xl bg-surface">
            <Icon as={ArrowLeftRight} size={20} color="primary-dark" />
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-bold text-[14px] text-foreground">
              {card.place}
            </Text>
            <Text numberOfLines={1} className="font-normal text-[12px] text-primary-dark">
              {card.detail}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-black text-[20px] leading-[22px] text-foreground">{card.points}</Text>
            <Text className="font-bold text-[11px] text-primary-dark">{t("tournamentPost.points")}</Text>
          </View>
        </View>
      )}

      {card.viewerLine ? <Text className="font-normal text-[12px] text-muted">{card.viewerLine}</Text> : null}

      {card.format === "groups" ? (
        <PressableFeedback
          accessibilityRole="link"
          onPress={() => onOpenTournament(post.tournamentId, card.viewerPlayed)}
          className="flex-row items-center gap-1 self-start"
        >
          <Text className="font-bold text-[13px] text-accent">{t("tournamentPost.seeTournament")}</Text>
          <Icon as={ChevronRight} size={16} color="accent" />
        </PressableFeedback>
      ) : null}
    </View>
  );
}
