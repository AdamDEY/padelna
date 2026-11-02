import { router, useLocalSearchParams } from "expo-router";
import { t } from "i18next";
import { Button, cn, Spinner, useToast } from "heroui-native";
import { Check, Clock, MapPin, MessageSquare, Share2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Share, Text, View } from "react-native";

import { CourtHero } from "@/components/court-hero";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { MyMatch } from "@/components/my-match";
import { Page } from "@/components/page";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-sheet";
import { seatInfo, TeamPicker } from "@/components/team-picker";
import { getMatchDetails, me, myLevel } from "@/data/mock";
import type { Player } from "@/types/player";
import { useClubs } from "@/hooks/useClubs";
import { useJoinMatch, useMatch } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { clubTint } from "@/lib/club";
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
  if (days === 0) return t("time.today");
  if (days === 1) return t("time.tomorrow");
  return formatMatchDay(date);
}

export default function MatchDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isStored = UUID.test(id);
  const stored = useMatch(id, isStored);
  const { data: account, isPending: isAccountPending } = useMyAccount();
  const match = isStored ? stored.data ?? undefined : getMatchDetails(id);
  const { data: clubs = [] } = useClubs();
  const joinStoredMatch = useJoinMatch();
  const { toast } = useToast();
  const [hasJoined, setHasJoined] = useState(false);
  const [hasAsked, setHasAsked] = useState(false);
  // The seat you tapped, until you confirm with the Join button
  const [selectedSeat, setSelectedSeat] = useState<number>();
  // Kept after the sheet closes so its content doesn't vanish mid-animation
  const [viewedPlayer, setViewedPlayer] = useState<Player>();
  const [isViewingPlayer, setIsViewingPlayer] = useState(false);

  if (isStored && (stored.isPending || isAccountPending)) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner accessibilityLabel={t("matchDetail.loading")} />
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
          <Page.Title description={t("matchDetail.notFoundText")}>
            {t("matchDetail.notFoundTitle")}
          </Page.Title>
        </Page.Body>
      </Page>
    );
  }

  const club = clubs.find((item) => item.id === match.clubId || item.name === match.clubName);
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
              label: t("matchDetail.youAreIn"),
              description: t("matchDetail.joinedText", {
                title,
                club: match!.clubName || t("matchDetail.courtToBook"),
              }),
            }),
          onError: (error) =>
            toast.show({
              variant: "danger",
              label: t("matchDetail.joinFailed"),
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
      label: t("matchDetail.youAreIn"),
      description: t("matchDetail.joinedText", { title, club: match!.clubName }),
    });
  }

  function askToJoin() {
    if (isStored) {
      toast.show({ label: t("matchDetail.requestsSoon"), description: t("matchDetail.requestsSoonText") });
      return;
    }
    // Nothing is sent yet; the API will notify the host
    setHasAsked(true);
    toast.show({
      variant: "success",
      label: t("matchDetail.requestSent"),
      description: t("matchDetail.hostWillLetYouKnow", {
        host: match!.host?.firstName ?? t("matchDetail.theHost"),
      }),
    });
  }

  function share() {
    Share.share({
      message: t("matchDetail.shareMessage", {
        title,
        club: match!.clubName,
        level:
          match!.levelMin !== undefined
            ? t("matchDetail.shareLevel", {
                min: match!.levelMin.toFixed(1),
                max: match!.levelMax!.toFixed(1),
              })
            : "",
      }),
    });
  }

  const tags = [
    match.levelMin !== undefined && match.levelMax !== undefined
      ? {
          label: t("matchDetail.levelTag", {
            min: match.levelMin.toFixed(1),
            max: match.levelMax.toFixed(1),
          }),
          lime: true,
        }
      : null,
    { label: t(match.kind === "competitive" ? "match.kind.competitive" : "match.kind.friendly") },
    match.audience ? { label: match.audience } : null,
  ].filter((tag): tag is { label: string; lime?: boolean } => tag !== null);

  return (
    <Page surface underStatusBar>
      <Page.Body className="gap-0 px-0">
        <CourtHero
          tint={club ? clubTint(club.id) : "blue"}
          showBall
          rightAction={
            <IconButton
              icon={Share2}
              label={t("matchDetail.share")}
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
                  {match.isCourtBooked ? t("matchDetail.courtBooked") : t("matchDetail.notBookedYet")}
                </Text>
              </View>
            </View>
          </View>

          <View className="gap-2.5">
            <View className="flex-row items-baseline justify-between">
              <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
                {t("matchDetail.players", { count: players.length, capacity: match.capacity })}
              </Text>
              {canPick ? (
                <Text className="font-bold text-[13px] text-accent">
                  {selectedSeat === undefined ? t("matchDetail.chooseSpot") : t("matchDetail.tapAnother")}
                </Text>
              ) : averageLevel !== undefined ? (
                <Text className="font-normal text-[13px] text-muted">
                  {t("matchDetail.avgLevel", { level: averageLevel.toFixed(1) })}
                </Text>
              ) : null}
            </View>
            <TeamPicker
              seats={seats}
              selectedSeat={selectedSeat}
              me={self}
              preferredSide={account?.side}
              onSelectSeat={canPick ? setSelectedSeat : undefined}
              // Mock matches' players have no profile in the database
              onPlayerPress={
                isStored
                  ? (player) => {
                      setViewedPlayer(player);
                      setIsViewingPlayer(true);
                    }
                  : undefined
              }
              myId={account?.id}
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
                    ? t("matchDetail.fits", { level: level.toFixed(1) })
                    : t("matchDetail.outside", { level: level.toFixed(1) })}
                </Text>
              </View>
            ) : null}
          </View>

          {match.host && match.note ? (
            <View className="flex-row items-center gap-3">
              <PlayerAvatar player={match.host} size={40} />
              <Text className="flex-1 font-normal text-[14px] leading-5 text-ink-2">
                <Text className="font-bold text-foreground">{t("matchDetail.hostNote", { name: match.host.firstName })}</Text>{" "}
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
          accessibilityLabel={isMine ? t("matchDetail.messagePlayers") : t("matchDetail.messageHost")}
          className="w-14"
        >
          <Icon as={MessageSquare} size={22} color="accent" />
        </Button>
        {isMine ? (
          <Button size="lg" variant="secondary" isDisabled className="flex-1">
            <Icon as={Check} size={20} color="primary-dark" />
            <Button.Label>{t("matchDetail.youAreIn")}</Button.Label>
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
              ? t("matchDetail.full")
              : !fits
                ? hasAsked
                  ? t("matchDetail.requestSent")
                  : t("matchDetail.askToJoin")
                : picked
                  ? t(picked.side === "left" ? "matchDetail.joinLeft" : "matchDetail.joinRight", {
                      team: picked.team,
                    })
                  : t("matchDetail.pickSpot")}
          </Button>
        )}
      </Page.Footer>
      <PlayerSheet
        player={viewedPlayer}
        isOpen={isViewingPlayer}
        onOpenChange={setIsViewingPlayer}
      />
    </Page>
  );
}
