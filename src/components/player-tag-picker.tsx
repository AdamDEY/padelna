import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { FilterChip } from "@/components/filter-chip";
import { MAX_TAGS_PER_PLAYER, PLAYER_TAG_GROUPS, type PlayerTag } from "@/data/player-tags";

type PlayerTagPickerProps = {
  value: PlayerTag[];
  onChange: (value: PlayerTag[]) => void;
  /** Used to word the hint, e.g. "What stood out about Mehdi?" */
  name: string;
};

/** What stood out about a player: up to a few tags from a fixed, positive list (optional). */
export function PlayerTagPicker({ value, onChange, name }: PlayerTagPickerProps) {
  const { t } = useTranslation();
  const isFull = value.length >= MAX_TAGS_PER_PLAYER;

  function toggle(tag: PlayerTag) {
    if (value.includes(tag)) onChange(value.filter((item) => item !== tag));
    else if (!isFull) onChange([...value, tag]);
  }

  return (
    <View className="gap-2.5">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 font-bold text-[14px] text-foreground">
          {t("rating.tagsTitle", { name })}{" "}
          <Text className="font-normal text-muted">{t("rating.tagsOptional")}</Text>
        </Text>
        <Text className="font-semibold text-[13px] text-muted">
          {value.length}/{MAX_TAGS_PER_PLAYER}
        </Text>
      </View>

      {PLAYER_TAG_GROUPS.map((group) => (
        <View key={group.key} className="gap-1.5">
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
            {t(`rating.tagGroups.${group.key}`)}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const selected = value.includes(tag);
              return (
                <View key={tag} style={{ opacity: isFull && !selected ? 0.4 : 1 }}>
                  <FilterChip label={t(`playerTags.${tag}`)} selected={selected} onPress={() => toggle(tag)} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
