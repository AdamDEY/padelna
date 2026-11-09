import { ArrowLeftRight, Network } from "lucide-react-native";

import { Icon } from "@/components/icon";
import type { TournamentFormat } from "@/types/tournament";

const icons = {
  americano: { icon: ArrowLeftRight, color: "primary-dark" },
  groups: { icon: Network, color: "lime-foreground" },
} as const;

type TournamentFormatIconProps = {
  format: TournamentFormat;
  size?: number;
};

/** Rotating partners for Americano, a bracket for groups + knockout. */
export function TournamentFormatIcon({ format, size = 24 }: TournamentFormatIconProps) {
  return <Icon as={icons[format].icon} size={size} color={icons[format].color} />;
}
