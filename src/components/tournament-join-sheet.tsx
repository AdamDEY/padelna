import { BottomSheet, Button, cn, SearchField, Spinner, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { Check, ChevronRight, UsersRound } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable, ScrollView } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";
import { LoadError } from "@/components/load-error";
import { PlayerAvatar } from "@/components/player-avatar";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useJoinTournament, useJoinTournamentPartnerList, usePartnerCandidates } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay } from "@/lib/format-date";
import { formatFee, formatTeamLevel } from "@/lib/tournament";
import type { PartnerCandidate, TournamentDetail, TournamentFit } from "@/types/tournament";

const RING_SIZE = 30;
const STACK_OVERLAP = 9;

type TournamentJoinSheetProps = {
  tournament: TournamentDetail;
  isOpen: boolean;
  onClose: () => void;
};

/** "Who is your partner?" (design "Tournament · join"): invite a friend or join the partner list. */
export function TournamentJoinSheet({ tournament, isOpen, onClose }: TournamentJoinSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const candidates = usePartnerCandidates(tournament.id, isOpen);
  const me = useMyProfile().data?.player;
  const join = useJoinTournament();
  const joinList = useJoinTournamentPartnerList();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();

  const isFull = tournament.spotsLeft === 0;
  const isBusy = join.isPending || joinList.isPending;

  function close() {
    setQuery("");
    setSelectedId(undefined);
    onClose();
  }

  const shown = useMemo(() => {
    const search = query.trim().toLowerCase();
    const all = candidates.data ?? [];
    return search ? all.filter((friend) => `${friend.firstName} ${friend.lastName}`.toLowerCase().includes(search)) : all;
  }, [candidates.data, query]);

  const selected = candidates.data?.find((friend) => friend.id === selectedId && friend.fit === "ok");
  const teamLevel =
    selected?.level !== undefined && tournament.myLevel !== undefined
      ? (selected.level + tournament.myLevel) / 2
      : undefined;

  const subtitle = [
    tournament.name,
    tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined,
    isFull ? t("tournaments.full") : tournament.spotsLeft !== undefined ? t("tournaments.spotsLeft", { count: tournament.spotsLeft }) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  function sendInvite() {
    if (!selected) return;
    join.mutate(
      { tournamentId: tournament.id, partnerId: selected.id },
      {
        onSuccess: () => {
          toast.show({
            variant: "success",
            label: t("tournaments.join.inviteSent", { name: selected.firstName }),
            description: t("tournaments.join.inviteSentText", { name: selected.firstName }),
          });
          close();
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: t("tournaments.join.inviteFailed"), description: errorMessage(error) }),
      },
    );
  }

  function joinPartnerList() {
    joinList.mutate(tournament.id, {
      onSuccess: () => {
        toast.show({ variant: "success", label: t("tournaments.join.listJoined"), description: t("tournaments.join.listJoinedText") });
        close();
      },
      onError: (error) =>
        toast.show({ variant: "danger", label: t("tournaments.join.listFailed"), description: errorMessage(error) }),
    });
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-3.5 px-5 pb-[30px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <BottomSheet.Title className="font-black text-[20px] text-foreground">{t("tournaments.join.title")}</BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[13px] text-muted">{subtitle}</BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-background" />
          </View>

          <PartnerSearch value={query} onChange={setQuery} />

          {candidates.error && !candidates.data ? (
            <LoadError
              message={t("tournaments.join.loadFailed", { message: errorMessage(candidates.error) })}
              onRetry={() => candidates.refetch()}
              isRetrying={candidates.isRefetching}
            />
          ) : candidates.data === undefined ? (
            <Spinner accessibilityLabel={t("tournaments.join.loading")} className="self-start" />
          ) : candidates.data.length === 0 ? (
            <View className="gap-1 rounded-[14px] bg-background px-3.5 py-3">
              <Text className="font-bold text-[15px] text-foreground">{t("tournaments.join.noFriends")}</Text>
              <Text className="font-normal text-[13px] leading-[19px] text-muted">{t("tournaments.join.noFriendsText")}</Text>
            </View>
          ) : shown.length === 0 ? (
            <Text className="py-2 font-normal text-[14px] text-muted">{t("tournaments.join.noResults", { query: query.trim() })}</Text>
          ) : (
            <ScrollView className="-mx-2.5 max-h-[280px]" keyboardShouldPersistTaps="handled">
              <View className="gap-0.5">
                {shown.map((friend) => (
                  <PartnerRow
                    key={friend.id}
                    friend={friend}
                    isSelected={friend.id === selectedId}
                    onPress={() => setSelectedId(friend.id === selectedId ? undefined : friend.id)}
                  />
                ))}
              </View>
            </ScrollView>
          )}

          {tournament.myEntry?.status === "looking" ? null : (
            <Pressable
              onPress={joinPartnerList}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel={`${t("tournaments.join.noPartner")} ${t("tournaments.join.noPartnerText")}`}
            >
              {/* The gesture-handler Pressable takes no className */}
              <View className="flex-row items-center gap-3 rounded-2xl border border-dashed border-line-input p-3">
                <View className="size-[42px] items-center justify-center rounded-full bg-lime-soft">
                  <Icon as={UsersRound} size={20} color="lime-foreground" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-[14px] text-foreground">{t("tournaments.join.noPartner")}</Text>
                  <Text className="font-normal text-[12px] text-muted">{t("tournaments.join.noPartnerText")}</Text>
                </View>
                <Icon as={ChevronRight} size={18} color="muted" />
              </View>
            </Pressable>
          )}

          {selected ? (
            <>
              <View className="flex-row items-center gap-2.5 rounded-[14px] bg-background px-3 py-2.5">
                <View className="flex-row">
                  {me ? <PlayerAvatar player={me} size={RING_SIZE} ringClassName="border-background" /> : null}
                  {/* Keyed: reusing the view from a photo to initials can leave it blank */}
                  <View key={selected.id} collapsable={false} style={me ? { marginStart: -STACK_OVERLAP } : undefined}>
                    <PlayerAvatar player={selected} size={RING_SIZE} ringClassName="border-background" />
                  </View>
                </View>
                <Text className="flex-1 font-normal text-[13px] text-ink-2">
                  {teamLevel !== undefined ? (
                    <>
                      {t("tournaments.join.teamLevel")} <Text className="font-bold text-foreground">{formatTeamLevel(teamLevel)}</Text>
                      {tournament.levelMin !== undefined && tournament.levelMax !== undefined
                        ? ` · ${t("tournaments.join.fits", { min: tournament.levelMin.toFixed(1), max: tournament.levelMax.toFixed(1) })}`
                        : ""}
                    </>
                  ) : (
                    selected.firstName
                  )}
                </Text>
              </View>
              <Button size="lg" onPress={sendInvite} isDisabled={isBusy}>
                {t("tournaments.join.sendInvite", { name: selected.firstName })}
              </Button>
              <Text className="-mt-1 text-center font-normal text-[12px] text-muted">
                {isFull
                  ? t("tournaments.join.holdFull", { name: selected.firstName })
                  : t("tournaments.join.hold", { name: selected.firstName })}
                {tournament.entryFee !== undefined ? ` ${t("tournaments.join.payAtDesk", { fee: formatFee(tournament.entryFee) })}` : ""}
              </Text>
            </>
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** The search box; tells the sheet about the keyboard so it moves above it. */
function PartnerSearch({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <SearchField value={value} onChange={onChange}>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input
          placeholder={t("tournaments.join.search")}
          accessibilityLabel={t("tournaments.join.search")}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={onFocus}
          onBlur={onBlur}
          className="h-11 rounded-[14px] border-0 bg-background text-[15px]"
        />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

const FIT_REASONS: Record<Exclude<TournamentFit, "ok" | "already_in_team">, "belowRange" | "aboveRange" | "wrongCategory"> = {
  below_range: "belowRange",
  above_range: "aboveRange",
  wrong_category: "wrongCategory",
};

function PartnerRow({ friend, isSelected, onPress }: { friend: PartnerCandidate; isSelected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { fit, level } = friend;
  const canPick = fit === "ok";
  const levelText = level !== undefined ? level.toFixed(1) : undefined;
  const detail =
    fit === "ok" || fit === "already_in_team"
      ? friend.matchesTogether > 0
        ? t("tournaments.join.matchesTogether", { count: friend.matchesTogether })
        : t("tournaments.join.notPlayedYet")
      : t(`tournaments.join.${FIT_REASONS[fit]}`);

  return (
    <Pressable
      onPress={onPress}
      disabled={!canPick}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected, disabled: !canPick }}
      accessibilityLabel={[`${friend.firstName} ${friend.lastName}`, detail, levelText].filter(Boolean).join(", ")}
    >
      {/* Not flattened: gaining a background on selection re-parents the children, which can leave them unpainted */}
      <View
        collapsable={false}
        className={cn(
          "flex-row items-center gap-3 rounded-2xl border-2 px-2.5 py-2",
          isSelected ? "border-accent bg-unread" : "border-transparent",
          fit === "already_in_team" && "opacity-55",
        )}
      >
        <PlayerAvatar player={friend} size={42} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
            {friend.firstName} {friend.lastName}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {detail}
          </Text>
        </View>
        {canPick || fit === "already_in_team" ? (
          levelText ? (
            <View className="rounded-[10px] bg-lime-soft px-2.5 py-1">
              <Text className="font-bold text-[12px] text-lime-foreground">{levelText}</Text>
            </View>
          ) : null
        ) : levelText ? (
          <Text className="font-bold text-[12px] text-attention">{t("tournaments.join.levelValue", { level: levelText })}</Text>
        ) : null}
        {fit === "already_in_team" ? (
          <Text className="font-bold text-[12px] text-muted">{t("tournaments.join.alreadyInTeam")}</Text>
        ) : canPick ? (
          <View
            collapsable={false}
            className={cn(
              "size-6 items-center justify-center rounded-full border-2",
              isSelected ? "border-accent bg-accent" : "border-line-input",
            )}
          >
            <View collapsable={false} style={{ opacity: isSelected ? 1 : 0 }}>
              <Icon as={Check} size={14} color="accent-foreground" />
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
