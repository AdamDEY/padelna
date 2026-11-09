import type { ComponentRef, Ref } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PadelnaMark } from "@/components/padelna-logo";
import { PlayerAvatar } from "@/components/player-avatar";
import { QrCode } from "@/components/qr-code";
import { ProfileChips } from "@/components/share-profile-card";
import type { ShareProfile } from "@/hooks/useShareProfile";

/** The image is laid out at the design's size, then captured at story resolution (9:16). */
export const SHARE_IMAGE_WIDTH = 390;
export const SHARE_IMAGE_HEIGHT = 694;
const QR_SIZE = 220;

type ShareProfileImageProps = {
  profile: ShareProfile;
  /** The view to capture */
  ref?: Ref<ComponentRef<typeof View>>;
};

/**
 * The picture sent to chats and stories (design: "Share profile · image for chats and stories").
 * It is never shown on screen: the share sheet draws it off-screen and saves it as a PNG.
 */
export function ShareProfileImage({ profile, ref }: ShareProfileImageProps) {
  const { t } = useTranslation();

  return (
    <View
      ref={ref}
      collapsable={false}
      className="items-center justify-center gap-[18px] overflow-hidden bg-accent px-[26px] py-9"
      style={{ width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT }}
    >
      {/* Faint circles in the corners, like the court lines on the Profile header */}
      <View aria-hidden className="absolute -end-[60px] -top-[60px] size-[220px] rounded-full border-2 border-white/15" />
      <View aria-hidden className="absolute -start-[90px] bottom-[120px] size-[240px] rounded-full border-2 border-white/10" />

      <View className="flex-row items-center gap-2">
        <PadelnaMark size={30} />
        <Text className="font-black text-[18px] text-accent-foreground">Padelna</Text>
      </View>
      <Text className="text-center font-black text-[26px] leading-[31px] tracking-[-0.4px] text-accent-foreground">
        {t("shareProfile.imageHeadline")}
      </Text>

      <View className="items-center gap-2.5 self-stretch rounded-[28px] bg-surface p-5">
        <View className="flex-row items-center gap-3 self-stretch">
          <PlayerAvatar player={profile.player} size={56} />
          <View className="flex-1 gap-1">
            <Text numberOfLines={1} className="font-bold text-[18px] text-foreground">
              {profile.name}
            </Text>
            <ProfileChips profile={profile} />
          </View>
        </View>
        <View className="p-2">
          <QrCode value={profile.link} size={QR_SIZE} accessibilityLabel={t("shareProfile.qrA11y", { name: profile.name })} />
        </View>
        <Text className="text-center font-normal text-[13px] text-muted">
          {t("shareProfile.scanWithCamera")}
          {"\n"}
          <Text className="font-bold text-foreground">{profile.code}</Text>
        </Text>
      </View>

      <Text className="text-center font-normal text-[13px] text-primary-tint-text">{t("shareProfile.imageFooter")}</Text>
    </View>
  );
}
