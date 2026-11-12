import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { PressableFeedback } from "heroui-native";
import { Camera, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

const SIZE = 92;

type PhotoPickerProps = {
  uri: string | undefined;
  onChange: (uri: string) => void;
  /** Shown until a new photo is picked, e.g. the current avatar. Without it, a dashed "add" circle. */
  current?: ReactNode;
};

/** Round profile photo picker: a dashed "add" circle (or the current avatar) until a photo is chosen. */
export function PhotoPicker({ uri, onChange, current }: PhotoPickerProps) {
  const { t } = useTranslation();
  const hasPhoto = uri !== undefined || current !== undefined;

  async function pick() {
    // The library picker doesn't need a permission prompt for photos
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  return (
    <View className="items-center gap-1.5">
      <View style={{ width: SIZE, height: SIZE }}>
        <PressableFeedback
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel={hasPhoto ? t("profilePhoto.change") : t("profilePhoto.add")}
          // Round, so the press highlight doesn't show as a square around the photo
          className="flex-1 rounded-full"
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2 }}
              contentFit="cover"
            />
          ) : current ? (
            current
          ) : (
            <View className="flex-1 items-center justify-center rounded-full border-2 border-dashed border-slot-border bg-primary-soft">
              <Icon as={Camera} size={30} color="accent-text" />
            </View>
          )}
        </PressableFeedback>
        {/* Outside the round pressable so it isn't clipped; taps pass through to it */}
        <View
          pointerEvents="none"
          className="absolute end-0.5 bottom-0.5 size-8 items-center justify-center rounded-full border-[3px] border-background bg-accent"
        >
          <Icon as={hasPhoto ? Camera : Plus} size={16} color="accent-foreground" />
        </View>
      </View>
      <Text className="font-semibold text-[14px] text-accent-text">
        {hasPhoto ? t("profilePhoto.changeLabel") : t("profilePhoto.addLabel")}
      </Text>
    </View>
  );
}
