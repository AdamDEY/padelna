import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Tabs,
  TextField,
} from "heroui-native";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  CircleCheck,
  Clock,
  MapPin,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";

// Temporary screen to check the theme against design.md. Replace once real screens exist.
export default function DesignCheck() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("friendly");

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-5 gap-5"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 34,
      }}
    >
      <View className="flex-row items-center justify-between">
        <Button variant="outline" isIconOnly accessibilityLabel="Back" className="size-11 rounded-full border-line">
          <Icon as={ChevronLeft} size={22} />
        </Button>
        <Button variant="outline" isIconOnly accessibilityLabel="Notifications" className="size-11 rounded-full border-line">
          <Icon as={Bell} size={22} />
        </Button>
      </View>

      <View className="gap-1">
        <Text className="font-bold text-[13px] tracking-[0.7px] text-muted">
          YOUR NEXT MATCH
        </Text>
        <Text className="font-black text-[30px] leading-[34px] tracking-[-0.5px] text-foreground">
          Design check
        </Text>
        <Text className="font-normal text-[16px] leading-6 text-ink-2">
          Nunito, the Padelna colours and HeroUI components together.
        </Text>
      </View>

      <Card className="border border-line p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="font-black text-[22px] tracking-[-0.3px] text-foreground">
            Sat 25 Oct · 18:00
          </Text>
          <View className="rounded-[10px] bg-lime-soft px-2.5 py-1">
            <Text className="font-bold text-[12px] text-lime-foreground">4.0 – 5.0</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon as={MapPin} size={16} color="muted" />
          <Text className="font-semibold text-[13px] text-muted">Padel Club Les Berges du Lac</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row">
            {[
              { initials: "SB", bg: "bg-avatar-blue", fg: "text-avatar-blue-foreground" },
              { initials: "YM", bg: "bg-avatar-peach", fg: "text-avatar-peach-foreground" },
              { initials: "AK", bg: "bg-avatar-mint", fg: "text-avatar-mint-foreground" },
            ].map((p, i) => (
              <Avatar
                key={p.initials}
                alt={p.initials}
                size="sm"
                className={`border-2 border-surface ${i > 0 ? "-ms-2.5" : ""}`}
              >
                <Avatar.Fallback className={p.bg}>
                  <Text className={`font-black text-[12px] ${p.fg}`}>{p.initials}</Text>
                </Avatar.Fallback>
              </Avatar>
            ))}
            <View className="-ms-2.5 size-8 items-center justify-center rounded-full border-2 border-dashed border-slot-border bg-surface">
              <Text className="font-black text-[14px] text-accent">+</Text>
            </View>
          </View>
          <Chip variant="soft" color="success" size="sm">
            <Icon as={CircleCheck} size={14} color="success" />
            <Chip.Label>Court booked</Chip.Label>
          </Chip>
        </View>
      </Card>

      <Tabs value={mode} onValueChange={setMode}>
        <Tabs.List className="bg-track">
          <Tabs.Indicator />
          <Tabs.Trigger value="friendly">
            <Tabs.Label>Friendly</Tabs.Label>
          </Tabs.Trigger>
          <Tabs.Trigger value="competitive">
            <Tabs.Label>Competitive</Tabs.Label>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <TextField>
        <Label>First name</Label>
        <Input placeholder="e.g. Sami" />
      </TextField>

      <View className="flex-row flex-wrap gap-2">
        <Chip variant="soft" color="accent">
          <Chip.Label>Fair play · 12</Chip.Label>
        </Chip>
        <Chip variant="soft" color="warning">
          <Icon as={Clock} size={14} color="warning" />
          <Chip.Label>Starting level</Chip.Label>
        </Chip>
        <Chip variant="soft" color="danger">
          <Chip.Label>1 spot left</Chip.Label>
        </Chip>
        <View className="flex-row items-center gap-1 rounded-full bg-lime px-3 py-1">
          <Icon as={CalendarDays} size={14} color="lime-foreground" />
          <Text className="font-bold text-[13px] text-lime-foreground">In 2 days</Text>
        </View>
      </View>

      <View className="gap-3">
        <Button size="lg">Continue</Button>
        <View className="flex-row gap-3">
          <Button size="lg" variant="secondary" className="flex-1">
            Message
          </Button>
          <Button size="lg" variant="outline" className="flex-1">
            Invite
          </Button>
        </View>
        <Button variant="ghost">Skip for now</Button>
      </View>
    </ScrollView>
  );
}
