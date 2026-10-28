import { router, useLocalSearchParams } from "expo-router";
import { Button, cn, Spinner, useToast } from "heroui-native";
import { Check, Clock, MapPin, MessageSquare, Share2 } from "lucide-react-native";
import { useState } from "react";
import { Share, Text, View } from "react-native";

import { CourtHero } from "@/components/court-hero";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { MyMatch } from "@/components/my-match";
import { Page } from "@/components/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { seatInfo, TeamPicker } from "@/components/team-picker";
import { allClubs, getMatchDetails, me, myLevel } from "@/data/mock";
import type { Player } from "@/types/player";
import { useJoinMatch, useMatch } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { daysUntil, formatMatchDay } from "@/lib/format-date";
import { isPlayableFit, levelFit } from "@/lib/level-fit";

// How far the white sheet slides up over the court
const SHEET_OVERLAP = 36;

// Matches created in the app have uuid ids; the mock ones ("match-1") don't
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayLabel(date: Date) {
  const days = daysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatMatchDay(date);
}

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isStored = UUID.test(id);
  const stored = useMatch(id, isStored);
  const { data: account, isPending: isAccountPending } = useMyAccount();
  const match = isStored ? stored.data ?? undefined : getMatchDetails(id);
  const joinStoredMatch = useJoinMatch();
  const { toast } = useToast();
  const [hasJoined, setHasJoined] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  // The seat you tapped, until you confirm with the Join button
  const [selectedSeat, setSelectedSeat] = useState<number>();

  if (isStored && (stored.isPending || isAccountPending)) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner accessibilityLabel="Loading the match" />
        </Page.Body>
      </Page>
    );
  }

  // A match you host or play in gets its own layout; everyone else sees the public one
  if (isStored && match && account) {
    const isHost = match.host?.id === account.id;
    const isPlaying = match.seats?.some((player) => player?.id === account.id);
    if (isHost || isPlaying) return <MyMatch match={match} role={isHost ? "host" : "player"} />;
  }

  if (!match) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          <Page.Title description="It may have been cancelled or already played.">
            Match not found
          </Page.Title>
        </Page.Body>
      </Page>
    );
  }

  const club = allClubs.find((item) => item.id === match.clubId || item.name === match.clubName);
  const players = hasJoined ? [...match.players, me] : match.players;
  const isMine = players.some((player) => player.id === me.id);
  const isFull = players.length >= match.capacity;
  const levels = players.map((player) => player.level).filter((level) => level !== undefined);
  const averageLevel = levels.length
    ? levels.reduce((sum, level) => sum + level, 0) / levels.length
    : undefined;
  // Matches from the database use your real level; the mock ones keep the placeholder
  const level = isStored ? account?.level ?? myLevel : myLevel;
  const fit =
    match.levelMin !== undefined && match.levelMax !== undefined
      ? levelFit(level, match.levelMin, match.levelMax)
      : undefined;
  const fits = fit === undefined || isPlayableFit(fit);

  // One entry per seat; open seats are undefined
  const seats =
    isStored && match.seats
      ? match.seats
      : Array.from({ length: match.capacity }, (_, index) => players[index]);
  const canPick = !isMine && fits && !isFull;
  const picked = selectedSeat !== undefined ? seatInfo(selectedSeat, match.capacity) : undefined;
  const self: Player =
    isStored && account
      ? {
          id: account.id,
          firstName: account.firstName,
          lastName: account.lastName,
          level: account.level,
          avatarUrl: account.avatarUrl,
        }
      : me;

  const start = formatTime(match.startsAt);
  const end = formatTime(new Date(match.startsAt.getTime() + match.durationMinutes * 60_000));
  const title = `${dayLabel(match.startsAt)} · ${start} – ${end}`;

  function join(seat: number) {
    if (isStored) {
      joinStoredMatch.mutate(
        { matchId: match!.id, seat },
        {
          onSuccess: () =>
            toast.show({
              variant: "success",
              label: "You're in",
              description: `${title} at ${match!.clubName || "a court to be booked"}. See you on court!`,
            }),
          onError: (error) =>
            toast.show({
              variant: "danger",
              label: "Couldn’t join the match",
              description: error.message,
            }),
        },
      );
      return;
    }
    // Nothing is saved yet for the mock matches
    setHasJoined(true);
    toast.show({
      variant: "success",
      label: "You're in",
      description: `${title} at ${match!.clubName}. See you on court!`,
    });
  }

  function askToJoin() {
    if (isStored) {
      toast.show({ label: "Requests are coming soon", description: "For now, join matches at your level." });
      return;
    }
    // Nothing is sent yet; the API will notify the host
    setHasAsked(true);
    toast.show({
      variant: "success",
      label: "Request sent",
      description: `${match!.host?.firstName ?? "The host"} will let you know.`,
    });
  }

  function share() {
    Share.share({
      message: `Padel match ${title} at ${match!.clubName}${
        match!.levelMin !== undefined
          ? `, level ${match!.levelMin.toFixed(1)} – ${match!.levelMax!.toFixed(1)}`
          : ""
      }. Join me on Padelna!`,
    });
  }

  const tags = [
    match.levelMin !== undefined && match.levelMax !== undefined
      ? {
          label: `Level ${match.levelMin.toFixed(1)} – ${match.levelMax.toFixed(1)}`,
          lime: true,
        }
      : null,
    { label: match.kind === "competitive" ? "Competitive" : "Friendly" },
    match.audience ? { label: match.audience } : null,
  ].filter((tag): tag is { label: string; lime?: boolean } => tag !== null);

  return (
    <Page surface underStatusBar>
      <Page.Body className="gap-0 px-0">
        <CourtHero
          tint={club?.placeholderTint ?? "blue"}
          showBall
          rightAction={
            <IconButton
              icon={Share2}
              label="Share match"
              onPress={share}
              className="border-0 bg-white/90"
            />
          }
        />

        <View
          className="gap-[18px] rounded-t-[28px] bg-surface px-5 pt-[22px]"
          style={{ marginTop: -SHEET_OVERLAP }}
        >
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Text
                  key={tag.label}
                  className={cn(
                    "overflow-hidden rounded-[10px] px-2.5 py-1 font-bold text-[12px]",
                    tag.lime ? "bg-lime-soft text-lime-foreground" : "bg-out-of-range text-ink-2",
                  )}
                >
                  {tag.label}
                </Text>
              ))}
            </View>
            <Text
              accessibilityRole="header"
              className="font-black text-[26px] tracking-[-0.4px] text-foreground"
            >
              {title}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Icon as={MapPin} size={16} color="muted" />
              <Text
                numberOfLines={1}
                className="shrink font-normal text-[15px] text-muted"
                onPress={
                  club
                    ? () => router.push({ pathname: "/club/[id]", params: { id: club.id } })
                    : undefined
                }
                accessibilityRole={club ? "link" : undefined}
              >
                <Text className="font-bold text-foreground">{match.clubName}</Text>
                {match.courtName ? ` · ${match.courtName}` : ""}
              </Text>
              <View
                className={cn(
                  "ms-auto flex-row items-center gap-1 rounded-[10px] px-2.5 py-1",
                  match.isCourtBooked ? "bg-success-soft" : "bg-warning-soft",
                )}
              >
                <Icon
                  as={match.isCourtBooked ? Check : Clock}
                  size={12}
                  color={match.isCourtBooked ? "success" : "warning"}
                />
                <Text
                  className={cn(
                    "font-bold text-[12px]",
                    match.isCourtBooked ? "text-success" : "text-warning",
                  )}
                >
                  {match.isCourtBooked ? "Court booked" : "Not booked yet"}
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-2.5">
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                Players · {players.length}/{match.capacity}
              </Text>
              {canPick ? (
                <Text className="font-bold text-[13px] text-accent">
                  {selectedSeat === undefined ? "Choose your spot" : "Tap another spot to switch"}
                </Text>
              ) : averageLevel !== undefined ? (
                <Text className="font-normal text-[13px] text-muted">
                  Avg level {averageLevel.toFixed(1)}
                </Text>
              ) : null}
            </View>
            <TeamPicker
              seats={seats}
              selectedSeat={selectedSeat}
              me={self}
              preferredSide={account?.side}
              onSelectSeat={canPick ? setSelectedSeat : undefined}
            />
            {fit !== undefined && !isMine ? (
              <View
                className={cn(
                  "flex-row items-center gap-2 rounded-[14px] px-3 py-2.5",
                  fits ? "bg-success-soft" : "bg-warning-soft",
                )}
              >
                <Icon as={fits ? Check : Clock} size={18} color={fits ? "success" : "warning"} />
                <Text className={cn("font-bold text-[14px]", fits ? "text-success" : "text-warning")}>
                  {fits
                    ? `Your level ${level.toFixed(1)} fits this match`
                    : `Your level ${level.toFixed(1)} is outside this range. You can still ask the host.`}
                </Text>
              </View>
            ) : null}
          </View>

          {match.host && match.note ? (
            <View className="flex-row items-center gap-3">
              <PlayerAvatar player={match.host} size={40} />
              <Text className="flex-1 font-normal text-[14px] leading-5 text-ink-2">
                <Text className="font-bold text-foreground">{match.host.firstName} (host):</Text>{" "}
                {match.note}
              </Text>
            </View>
          ) : null}
        </View>
      </Page.Body>

      <Page.Footer className="flex-row">
        <Button
          size="lg"
          variant="secondary"
          isIconOnly
          accessibilityLabel={isMine ? "Message the players" : "Message the host"}
          className="w-14"
        >
          <Icon as={MessageSquare} size={22} color="accent" />
        </Button>
        {isMine ? (
          <Button size="lg" variant="secondary" isDisabled className="flex-1">
            <Icon as={Check} size={20} color="primary-dark" />
            <Button.Label>You&apos;re in</Button.Label>
          </Button>
        ) : (
          <Button
            size="lg"
            variant={fits ? "primary" : "outline"}
            isDisabled={
              isFull ||
              hasAsked ||
              joinStoredMatch.isPending ||
              (fits && selectedSeat === undefined)
            }
            onPress={fits ? () => join(selectedSeat!) : askToJoin}
            className="flex-1"
          >
            {isFull
              ? "Match is full"
              : !fits
                ? hasAsked
                  ? "Request sent"
                  : "Ask to join"
                : picked
                  ? `Join Team ${picked.team} · ${picked.side === "left" ? "Left" : "Right"} side`
                  : "Pick a spot to join"}
          </Button>
        )}
      </Page.Footer>
    </Page>
  );
}
