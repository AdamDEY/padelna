import { router, usePathname, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import i18n from "i18next";
import { useEffect } from "react";
import { AppState } from "react-native";

import { registerThisPhone } from "@/hooks/usePushNotifications";

// The screen on show, so a push about it (a message in the chat you're reading) stays quiet
let currentPath = "";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAboutThisScreen = notification.request.content.data?.url === currentPath;
    return {
      shouldShowBanner: !isAboutThisScreen,
      shouldShowList: !isAboutThisScreen,
      shouldPlaySound: !isAboutThisScreen,
      shouldSetBadge: false,
    };
  },
});

function openFrom(response: Notifications.NotificationResponse) {
  const url = response.notification.request.content.data?.url;
  if (typeof url === "string" && url.startsWith("/")) router.push(url as Href);
}

/**
 * Wires push notifications into the app for a signed-in player: saves this phone's token,
 * opens the right screen when a push is tapped (also when the tap launched the app), and
 * keeps pushes about the screen you're on from showing. Renders nothing.
 */
export function PushNotificationObserver() {
  const pathname = usePathname();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    currentPath = pathname;
  }, [pathname]);

  // Saved on every launch, language change and return to the app (pushes may have just been
  // turned on in the phone's Settings), so the token and push language stay current
  useEffect(() => {
    const register = () => registerThisPhone().catch((error) => console.warn("Push token not saved", error));
    register();
    i18n.on("languageChanged", register);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") register();
    });
    return () => {
      i18n.off("languageChanged", register);
      subscription.remove();
    };
  }, []);

  // The tap that opened the app, or one while it's running
  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    openFrom(lastResponse);
    Notifications.clearLastNotificationResponse();
  }, [lastResponse]);

  return null;
}
