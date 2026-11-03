import { router } from "expo-router";
import { SearchField } from "heroui-native";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubListItem } from "@/components/club-list-item";
import { Icon } from "@/components/icon";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { useClubCards } from "@/hooks/useClubs";
import { errorMessage } from "@/lib/error-message";

const ALL = "all";

type SortOrder = "nearest" | "matches";

const sortLabels = {
  nearest: "clubs.sortNearest",
  matches: "clubs.sortMatches",
} as const satisfies Record<SortOrder, string>;

/** Lower-case and strip accents, so "cafe" finds "Café" */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function AllClubs() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(ALL);
  const [chosenSort, setChosenSort] = useState<SortOrder>("nearest");
  const { clubs: allClubs, isLoading, error, refetch, isRefetching, hasDistances } = useClubCards();

  // Without distances (no location shared, or no map pins yet) the list sorts by open matches
  const sortOrder: SortOrder = hasDistances ? chosenSort : "matches";
  const published = useMemo(() => allClubs.filter((club) => club.status !== "draft"), [allClubs]);
  const regions = useMemo(() => [...new Set(published.map((club) => club.region))].sort(), [published]);

  const clubs = useMemo(() => {
    const search = normalize(query.trim());
    return published
      .filter((club) => region === ALL || club.region === region)
      .filter(
        (club) =>
          !search ||
          normalize(`${club.name} ${club.area} ${club.city} ${club.region}`).includes(search),
      )
      .sort((a, b) => {
        if (sortOrder === "nearest" && a.distanceKm !== undefined && b.distanceKm !== undefined) {
          return a.distanceKm - b.distanceKm;
        }
        return b.openMatchCount - a.openMatchCount || a.name.localeCompare(b.name);
      });
  }, [published, query, region, sortOrder]);

  return (
    <Page>
      <Page.Header
        back
        leading={
          <>
            <Text
              accessibilityRole="header"
              className="font-black text-[22px] tracking-[-0.3px] text-foreground"
            >
              {t("clubs.title")}
            </Text>
            {/* A count of 0 would be wrong while the clubs haven't loaded */}
            {isLoading || error ? null : (
              <Text className="font-normal text-[13px] text-muted">
                {t("clubs.subtitle", { count: published.length })}
              </Text>
            )}
          </>
        }
      />

      <Page.Body className="gap-3.5">
        <SearchField value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              placeholder={t("clubs.searchPlaceholder")}
              accessibilityLabel={t("clubs.searchA11y")}
              // Club and place names: autocorrect would rewrite them
              autoCorrect={false}
              autoCapitalize="none"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <ChoiceChips
          options={[
            { value: ALL, label: t("clubs.allRegions") },
            ...regions.map((name) => ({ value: name, label: name })),
          ]}
          value={region}
          onChange={setRegion}
        />

        <View className="flex-row items-center justify-between">
          {error ? (
            <View />
          ) : (
            <Text className="font-bold text-[14px] text-foreground">
              {t("clubs.count", { count: clubs.length })}
            </Text>
          )}
          {hasDistances ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("clubs.sortA11y", { order: t(sortLabels[sortOrder]).toLowerCase() })}
              onPress={() => setChosenSort(sortOrder === "nearest" ? "matches" : "nearest")}
              hitSlop={10}
              className="flex-row items-center gap-1"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="font-bold text-[13px] text-link">{t(sortLabels[sortOrder])}</Text>
              <Icon as={ChevronDown} size={14} color="link" />
            </Pressable>
          ) : null}
        </View>

        <View className="gap-2.5">
          {clubs.map((club) => (
            <ClubListItem
              key={club.id}
              club={club}
              onPress={() => router.push({ pathname: "/club/[id]", params: { id: club.id } })}
            />
          ))}
          {error ? (
            <LoadError
              message={t("clubs.loadFailed", { message: errorMessage(error) })}
              onRetry={() => refetch()}
              isRetrying={isRefetching}
            />
          ) : !isLoading && clubs.length === 0 ? (
            <View className="items-center gap-1 rounded-[18px] border border-line bg-surface p-6">
              <Text className="font-bold text-[15px] text-foreground">{t("clubs.noneTitle")}</Text>
              <Text className="text-center font-normal text-[14px] text-muted">
                {t("clubs.noneText")}
              </Text>
            </View>
          ) : null}
        </View>
      </Page.Body>
    </Page>
  );
}
