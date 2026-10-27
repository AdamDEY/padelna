import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { PressableFeedback } from "heroui-native";
import { Camera, Plus } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";

const SIZE = 92;

type PhotoPickerProps = {
  uri: string | undefined;
  onChange: (uri: string) => void;
};

/** Round profile photo picker: a dashed "add" circle until a photo is chosen. */
export function PhotoPicker({ uri, onChange }: PhotoPickerProps) {
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
      <PressableFeedback
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change your profile photo" : "Add a profile photo"}
        style={{ width: SIZE, height: SIZE }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2 }}
            contentFit="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center rounded-full border-2 border-dashed border-slot-border bg-primary-soft">
            <Icon as={Camera} size={30} color="accent" />
          </View>
        )}
        <View className="absolute end-0.5 bottom-0.5 size-8 items-center justify-center rounded-full border-[3px] border-background bg-accent">
          <Icon as={Plus} size={16} color="accent-foreground" />
        </View>
      </PressableFeedback>
      <Text className="font-semibold text-[14px] text-accent">
        {uri ? "Change photo" : "Add a photo"}
      </Text>
    </View>
  );
}
