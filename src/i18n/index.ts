import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18n, { changeLanguage, exists, t } from "i18next";
import { initReactI18next } from "react-i18next";

import { queryClient } from "@/lib/query-client";
import { en } from "@/i18n/locales/en";
import { fr } from "@/i18n/locales/fr";

export const LANGUAGES = ["en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language in its own words, so a player can always find theirs */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", fr: "Français" };

const STORAGE_KEY = "padelna.language";

function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.some((language) => language === value);
}

/** The phone's language when we have it, English otherwise */
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : "en";
}

// eslint-disable-next-line import/no-named-as-default-member -- `use` is also a hook-looking named export
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: deviceLanguage(),
  fallbackLng: "en",
  // React Native escapes nothing
  interpolation: { escapeValue: false },
});

// Some cached data carries text made in the old language (court names, "Guest"), so it reloads
async function applyLanguage(language: Language) {
  await changeLanguage(language);
  await queryClient.invalidateQueries();
}

/** Switches the app language and remembers it for the next launch. */
export async function setLanguage(language: Language) {
  await applyLanguage(language);
  await AsyncStorage.setItem(STORAGE_KEY, language).catch(() => {});
}

/** Applies the language the player picked earlier. Without one, the phone's language stays. */
export async function restoreLanguage() {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  if (isLanguage(saved) && saved !== i18n.language) await applyLanguage(saved);
}

/**
 * Translates a label that comes from data (sample stats, tags, months). Labels without a
 * translation show as written.
 */
export function translateLabel(
  group: "tags" | "winTitles" | "winStats" | "months" | "clubTags" | "amenities" | "aspects",
  label: string,
) {
  const key = `labels.${group}.${label}`;
  return exists(key) ? String(t(key as never)) : label;
}

/** "Court 3" from a stored court name; anything else shows as written. */
export function translateCourt(name: string) {
  const match = /^Court (\d+)$/.exec(name);
  return match ? String(t("match.courtNumber", { number: Number(match[1]) })) : name;
}

export { i18n };
