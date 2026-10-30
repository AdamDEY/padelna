import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageIcon, X } from "lucide-react-native";
import { Text, View } from "react-native";
// Gesture Handler's Pressable: React Native's doesn't get taps inside the sheet
import { Pressable as GesturePressable } from "react-native-gesture-handler";

import { Icon } from "@/components/icon";

// design: 120 px photo tiles, radius 18
const TILE_HEIGHT = 120;
const PREVIEW_HEIGHT = 170;
const RADIUS = 18;

type TeamPhotoPickerProps = {
  /** The picked photo, or the one already saved; undefined shows the Gallery tile */
  uri: string | undefined;
  onChange: (uri: string | undefined) => void;
  /** Show the remove button; off for a photo that's already saved */
  canRemove?: boolean;
};

/**
 * "Team photo (optional)" in the Match finished sheet. Gallery only for now; taking a
 * photo with the camera comes later.
 */
export function TeamPhotoPicker({
  uri,
  onChange,
  canRemove = true,
}: TeamPhotoPickerProps) {
  async function pick() {
    // The library picker doesn't need a permission prompt
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
    });
    if (!result.canceled) onChange(result.assets[0].uri);
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline gap-1">
        <Text className="font-bold text-[14px] text-foreground">
          Team photo
        </Text>
        <Text className="font-medium text-[14px] text-muted">(optional)</Text>
      </View>

      {uri ? (
        <View>
          <GesturePressable
            onPress={pick}
            accessibilityRole="button"
            accessibilityLabel="Change the team photo"
          >
            <Image
              source={{ uri }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
              style={{ height: PREVIEW_HEIGHT, borderRadius: RADIUS }}
            />
          </GesturePressable>
          {canRemove ? (
            <View className="absolute end-2.5 top-2.5">
              <GesturePressable
                onPress={() => onChange(undefined)}
                accessibilityRole="button"
                accessibilityLabel="Remove the team photo"
                hitSlop={6}
              >
                <View className="size-9 items-center justify-center rounded-full bg-surface">
                  <Icon as={X} size={18} color="foreground" />
                </View>
              </GesturePressable>
            </View>
          ) : null}
          <View
            pointerEvents="none"
            className="absolute bottom-2.5 start-2.5 rounded-xl bg-surface px-2.5 py-1"
          >
            <Text className="font-bold text-[12px] text-foreground">
              Tap to change
            </Text>
          </View>
        </View>
      ) : (
        <GesturePressable
          onPress={pick}
          accessibilityRole="button"
          accessibilityLabel="Add a team photo from your gallery"
        >
          {/* Gesture Handler's Pressable takes no className, so the tile is a View inside it */}
          <View
            style={{ height: TILE_HEIGHT, borderRadius: RADIUS }}
            className="items-center justify-center gap-1.5 border border-line-input bg-surface"
          >
            <Icon as={ImageIcon} size={26} color="foreground" />
            <Text className="font-bold text-[14px] text-foreground">Gallery</Text>
          </View>
        </GesturePressable>
      )}
    </View>
  );
}
