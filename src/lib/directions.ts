import { t } from "i18next";
import { ActionSheetIOS, Linking, Platform } from "react-native";

export type Destination = {
  name: string;
  /** Left empty until the club fills it in */
  address: string;
  area: string;
  city: string;
  latitude?: number;
  longitude?: number;
};

type MapsApp = "apple" | "google";

function hasPin(place: Destination) {
  return place.latitude !== undefined && place.longitude !== undefined;
}

/** Name and address, for clubs that have no map pin yet. */
function addressText(place: Destination) {
  return `${place.name}, ${place.address || `${place.area}, ${place.city}`}`;
}

// Both links open the installed app and fall back to the website
function appleMapsUrl(place: Destination) {
  return hasPin(place)
    ? `https://maps.apple.com/?ll=${place.latitude},${place.longitude}&q=${encodeURIComponent(place.name)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(addressText(place))}`;
}

function googleMapsUrl(place: Destination) {
  const query = hasPin(place) ? `${place.latitude},${place.longitude}` : addressText(place);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function androidUrl(place: Destination) {
  return hasPin(place)
    ? `geo:${place.latitude},${place.longitude}?q=${place.latitude},${place.longitude}(${encodeURIComponent(place.name)})`
    : `geo:0,0?q=${encodeURIComponent(addressText(place))}`;
}

function open(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

/**
 * Directions to a club. On iOS the player picks Apple Maps or Google Maps; Android's own
 * geo link already lets them pick any maps app they have, so it goes straight there.
 */
export function showDirections(place: Destination) {
  if (Platform.OS !== "ios") {
    open(androidUrl(place));
    return;
  }

  const options: { label: string; app: MapsApp }[] = [
    { label: t("directions.appleMaps"), app: "apple" },
    { label: t("directions.googleMaps"), app: "google" },
  ];
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: t("directions.title"),
      options: [...options.map((option) => option.label), t("directions.cancel")],
      cancelButtonIndex: options.length,
    },
    (index) => {
      const choice = options[index];
      if (choice) open(choice.app === "apple" ? appleMapsUrl(place) : googleMapsUrl(place));
    },
  );
}
