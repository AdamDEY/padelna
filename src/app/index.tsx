import { Button } from "heroui-native";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background">
      <Text className="text-foreground text-lg">HeroUI Native is set up.</Text>
      <Button onPress={() => console.log("pressed")}>Get started</Button>
    </View>
  );
}
