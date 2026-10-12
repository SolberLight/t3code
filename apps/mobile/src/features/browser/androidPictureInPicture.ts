import { requireOptionalNativeModule, type EventSubscription } from "expo";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

interface AndroidPictureInPicture {
  isSupported(): boolean;
  enter(width: number, height: number): Promise<boolean>;
  addListener(
    eventName: "onChange",
    listener: (event: { readonly active: boolean }) => void,
  ): EventSubscription;
}

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<AndroidPictureInPicture>("T3PictureInPicture")
    : null;
const supported = native?.isSupported() === true;

/**
 * Android WebView cannot float a video, so the whole app floats instead. `active`
 * holds from the request until the floating window closes or expands.
 */
export function useAndroidPictureInPicture() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const subscription = native?.addListener("onChange", (event) => setActive(event.active));
    return () => subscription?.remove();
  }, []);
  /** Floats a player shaped like the page; false when the system declines. */
  const enter = async (width: number, height: number) => {
    // The app pauses as it floats, which reads as backgrounding; stay live through it.
    setActive(true);
    const entered = (await native?.enter(width, height).catch(() => false)) ?? false;
    if (!entered) setActive(false);
    return entered;
  };
  return { supported, active, enter };
}
