import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "padelna.skipBookingNotice";

/** True once the player ticked "Don't show this again" on the booking notice. */
export async function shouldSkipBookingNotice() {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setSkipBookingNotice(skip: boolean) {
  try {
    await AsyncStorage.setItem(KEY, skip ? "1" : "0");
  } catch {
    // The notice just shows again next time
  }
}
