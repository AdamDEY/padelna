import { BadgeCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ScopedTheme } from "uniwind";

import { Icon } from "@/components/icon";
import { PadelnaLogo } from "@/components/padelna-logo";
import { QrCode } from "@/components/qr-code";
import type { ShareProfile } from "@/hooks/useShareProfile";

const QR_SIZE = 236;
// Under this the card scrolls instead of squeezing the code
const CARD_MIN_HEIGHT = 470;

/** "Level 4.5" and, when a coach set it, "Coach-verified": the chips under a name on the code cards. */
export function ProfileChips({ profile }: { profile: ShareProfile }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row gap-1.5">
      {profile.level !== undefined ? (
        <Text className="overflow-hidden rounded-[10px] bg-lime-soft px-2.5 py-1 font-bold text-[12px] text-lime-foreground">
          {t("shareProfile.level", { level: profile.level.toFixed(1) })}
        </Text>
      ) : null}
      {profile.isCoachVerified ? (
        <View className="flex-row items-center gap-1 rounded-[10px] bg-success-soft px-[9px] py-1">
          <Icon as={BadgeCheck} size={14} color="success" />
          <Text className="font-bold text-[12px] text-success">{t("shareProfile.coachVerified")}</Text>
        </View>
      ) : null}
    </View>
  );
}

// The lime logo (mark over the wordmark) on the blue panel
const LOGO_WIDTH = 120;
// Nudges the logo up, away from the white card
const LOGO_LIFT = 14;

/**
 * The player's code card (design: "Share profile · my code"): a blue panel with the Padelna logo
 * and a white card holding their name, @handle and QR code. It grows to fill the sheet.
 */
export function ShareProfileCard({ profile }: { profile: ShareProfile }) {
  const { t } = useTranslation();

  return (
    <ScopedTheme theme="light">
      <View
        className="flex-1 items-center justify-center gap-4 overflow-hidden rounded-[28px] bg-hero px-5 py-[22px]"
        style={{ minHeight: CARD_MIN_HEIGHT }}
      >
        {/* Faint circles in the corners, like the court lines on the Profile header */}
        <View aria-hidden className="absolute -end-[50px] -top-[50px] size-[180px] rounded-full border-2 border-white/15" />
        <View aria-hidden className="absolute -bottom-10 -start-[70px] size-[190px] rounded-full border-2 border-white/10" />

        <View style={{ transform: [{ translateY: -LOGO_LIFT }] }}>
          <PadelnaLogo width={LOGO_WIDTH} tone="lime" />
        </View>

        <View className="items-center gap-3.5 self-stretch rounded-[28px] bg-surface px-5 pb-5 pt-[22px]">
          <View className="items-center gap-0.5">
            <Text numberOfLines={1} className="font-black text-[22px] tracking-[-0.3px] text-foreground">
              {profile.name}
            </Text>
            <Text className="font-bold text-[15px] tracking-[1px] text-muted">
              {t("shareProfile.codeLabel", { code: profile.code })}
            </Text>
          </View>
          <QrCode
            logo
            value={profile.link}
            size={QR_SIZE}
            accessibilityLabel={t("shareProfile.qrA11y", { name: profile.name })}
          />
          <Text className="text-center font-normal text-[13px] text-muted">{t("shareProfile.scanToConnect")}</Text>
        </View>
      </View>
    </ScopedTheme>
  );
}
