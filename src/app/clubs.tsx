import { router } from "expo-router";
import { SearchField } from "heroui-native";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubListItem } from "@/components/club-list-item";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { allClubs, clubRegions } from "@/data/mock";

const ALL = "all";

type SortOrder = "nearest" | "rating";

const sortLabels = {
  nearest: "clubs.sortNearest",
  rating: "clubs.sortRating",
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
  const [sortOrder, setSortOrder] = useState<SortOrder>("nearest");

  const clubs = useMemo(() => {
    const search = normalize(query.trim());
    return allClubs
      .filter((club) => region === ALL || club.region === region)
      .filter(
        (club) =>
          !search ||
          normalize(`${club.name} ${club.area} ${club.region}`).includes(search),
      )
      .sort((a, b) =>
        sortOrder === "nearest" ? a.distanceKm - b.distanceKm : b.rating - a.rating,
      );
  }, [query, region, sortOrder]);

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
            <Text className="font-normal text-[13px] text-muted">
              {t("clubs.subtitle", { count: allClubs.length })}
            </Text>
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
            ...clubRegions.map((name) => ({ value: name, label: name })),
          ]}
          value={region}
          onChange={setRegion}
        />

        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-[14px] text-foreground">
            {t("clubs.count", { count: clubs.length })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("clubs.sortA11y", { order: t(sortLabels[sortOrder]).toLowerCase() })}
            onPress={() => setSortOrder((order) => (order === "nearest" ? "rating" : "nearest"))}
            hitSlop={10}
            className="flex-row items-center gap-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="font-bold text-[13px] text-link">{t(sortLabels[sortOrder])}</Text>
            <Icon as={ChevronDown} size={14} color="link" />
          </Pressable>
        </View>

        <View className="gap-2.5">
          {clubs.map((club) => (
            <ClubListItem
              key={club.id}
              club={club}
              onPress={() => router.push({ pathname: "/club/[id]", params: { id: club.id } })}
            />
          ))}
          {clubs.length === 0 ? (
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
