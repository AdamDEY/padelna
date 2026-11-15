import { router, usePathname } from "expo-router";
import { useState } from "react";

import { FeedbackSheet } from "@/components/feedback-sheet";
import { useShake } from "@/hooks/useShake";
import { useShakeToReport } from "@/lib/shake-preference";

/** Opens the feedback sheet when the phone is shaken, on any screen, unless the player turned it off. */
export function ShakeFeedback() {
  const enabled = useShakeToReport();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  // Where the player was when they shook, not where they are while typing
  const [screen, setScreen] = useState(pathname);

  useShake(() => {
    if (isOpen) return;
    setScreen(pathname);
    setIsOpen(true);
  }, enabled);

  return (
    <FeedbackSheet
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      screen={screen}
      onOpenSettings={() => router.push("/settings")}
    />
  );
}
