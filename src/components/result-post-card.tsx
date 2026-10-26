import { cn } from "heroui-native";
import { Image } from "expo-image";
import { ShieldCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatMatchDay, formatTimeAgo } from "@/lib/format-date";
import type { ResultPost, Team } from "@/types/post";

/** "Youssef B. and Amira K." */
function teamFullNames(team: Team) {
  return team.map((p) => `${p.firstName} ${p.lastName.charAt(0)}.`).join(" and ");
}

/** "Youssef · Amira" */
function teamFirstNames(team: Team) {
  return team.map((p) => p.firstName).join(" · ");
}

/** "4.5 · 5.0" when both players' levels are known */
function teamLevels(team: Team) {
  const [a, b] = team;
  return a.level !== undefined && b.level !== undefined
    ? `${a.level.toFixed(1)} · ${b.level.toFixed(1)}`
    : null;
}

/** Index of the team that won more sets */
export function winnerIndex(sets: [number, number][]) {
  const firstTeamSets = sets.filter(([a, b]) => a > b).length;
  return firstTeamSets > sets.length / 2 ? 0 : 1;
}

type ResultPostCardProps = {
  post: ResultPost;
  /** Button on the right of the header, e.g. Connect for players you don't know */
  headerAction?: ReactNode;
};

/**
 * A match result in the Community feed. With a team photo it shows the photo
 * and a light score table; without one, a blue scoreboard carries the card.
 */
export function ResultPostCard({ post, headerAction }: ResultPostCardProps) {
  const winner = winnerIndex(post.sets);
  const poster = post.teams[0];
  const posterWon = winner === 0;
  const tintIndices = stackTintIndices(poster);
  // Without a photo the scoreboard doesn't show WIN, so the title says it
  const title =
    !post.photoUri && posterWon ? `${teamFullNames(poster)} won` : teamFullNames(poster);

  return (
    <View className="gap-3 rounded-3xl border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-2.5">
        <View className="flex-row">
          {poster.map((player, index) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              size={36}
              tintIndex={tintIndices[index]}
              ringClassName="border-surface"
              className={index > 0 ? "-ms-3" : undefined}
            />
          ))}
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={2} className="font-bold text-[15px] text-foreground">
            {title}
          </Text>
          <Text numberOfLines={2} className="font-normal text-[12px] text-muted">
            {[
              post.clubName,
              formatTimeAgo(post.postedAt),
              post.mutualFriendCount
                ? `${post.mutualFriendCount} mutual ${post.mutualFriendCount === 1 ? "friend" : "friends"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {headerAction}
      </View>

      {post.photoUri ? (
        <>
          {/* expo-image takes no className; the tinted frame shows while the photo loads */}
          <View className="h-[180px] overflow-hidden rounded-[18px] bg-court-blue">
            <Image
              source={{ uri: post.photoUri }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`Team photo of ${teamFirstNames(poster)}`}
              style={{ flex: 1 }}
            />
          </View>
          <ScoreTable post={post} winner={winner} />
        </>
      ) : (
        <Scoreboard post={post} winner={winner} />
      )}

      {post.confirmed ? (
        <View className="flex-row items-center gap-1">
          <Icon as={ShieldCheck} size={14} color="success" />
          <Text className="font-bold text-[12px] text-success">Score confirmed by all 4</Text>
        </View>
      ) : null}
    </View>
  );
}

type ScoreProps = { post: ResultPost; winner: number };

/** Blue result block for posts without a photo. */
function Scoreboard({ post, winner }: ScoreProps) {
  const label = `${post.kind === "friendly" ? "Friendly" : "Competitive"} · ${post.courtName}`;

  return (
    <View className="gap-2.5 rounded-[18px] bg-accent p-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
          {label}
        </Text>
        <Text className="font-bold text-[12px] text-primary-tint-text">
          {formatMatchDay(post.playedAt)}
        </Text>
      </View>

      {post.teams.map((team, teamIndex) => {
        const isWinner = teamIndex === winner;
        const tints = stackTintIndices(team);
        return (
          <View
            key={teamIndex}
            accessible
            accessibilityLabel={`${teamFirstNames(team)}${isWinner ? ", winners" : ""}: ${post.sets
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
                    size={30}
                    tintIndex={tints[index]}
                    ringClassName="border-accent"
                    className={index > 0 ? "-ms-2.5" : undefined}
                  />
                ))}
              </View>
              <Text
                numberOfLines={1}
                className={cn(
                  "flex-1 text-[14px]",
                  isWinner ? "font-black text-accent-foreground" : "font-semibold text-primary-tint-text",
                )}
              >
                {teamFirstNames(team)}
              </Text>
            </View>
            {post.sets.map((set, setIndex) => {
              const wonSet = set[teamIndex] > set[1 - teamIndex];
              return (
                <View
                  key={setIndex}
                  className={cn(
                    "size-[34px] items-center justify-center rounded-[10px]",
                    wonSet ? "bg-surface" : "bg-white/15",
                  )}
                >
                  <Text
                    className={cn(
                      "text-[18px]",
                      wonSet ? "font-black text-foreground" : "font-bold text-accent-foreground",
                    )}
                  >
                    {set[teamIndex]}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}

      <View className="flex-row flex-wrap gap-1.5">
        <Text className="overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-bold text-[12px] text-accent-foreground">
          Level {post.levelMin.toFixed(1)} – {post.levelMax.toFixed(1)}
        </Text>
        <Text className="overflow-hidden rounded-[10px] bg-white/15 px-2.5 py-1 font-bold text-[12px] text-accent-foreground">
          Won in {post.sets.length} {post.sets.length === 1 ? "set" : "sets"}
        </Text>
      </View>
    </View>
  );
}

/** Light score table under a team photo; winners get a WIN tag, lost sets are muted. */
function ScoreTable({ post, winner }: ScoreProps) {
  return (
    <View className="gap-1.5 rounded-2xl bg-background p-3">
      {post.teams.map((team, teamIndex) => {
        const isWinner = teamIndex === winner;
        return (
          <View
            key={teamIndex}
            accessible
            accessibilityLabel={`${teamFirstNames(team)}${isWinner ? ", winners" : ""}: ${post.sets
              .map((set) => set[teamIndex])
              .join(", ")}`}
            className="flex-row items-center gap-1.5"
          >
            <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
              <Text
                numberOfLines={1}
                className={cn(
                  "shrink text-[14px]",
                  isWinner ? "font-black text-foreground" : "font-semibold text-ink-2",
                )}
              >
                {teamFirstNames(team)}
              </Text>
              {teamLevels(team) ? (
                <Text className="font-bold text-[11px] text-muted">{teamLevels(team)}</Text>
              ) : null}
              {isWinner ? (
                <Text className="overflow-hidden rounded-lg bg-lime-soft px-1.5 py-0.5 font-bold text-[11px] text-lime-foreground">
                  WIN
                </Text>
              ) : null}
            </View>
            {post.sets.map((set, setIndex) => {
              const wonSet = set[teamIndex] > set[1 - teamIndex];
              return (
                <Text
                  key={setIndex}
                  className={cn(
                    "w-[26px] text-center text-[16px]",
                    wonSet ? "font-black text-foreground" : "font-semibold text-muted",
                  )}
                >
                  {set[teamIndex]}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
