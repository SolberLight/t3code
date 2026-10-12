const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

// The browser screen floats the whole activity in picture in picture
// (T3PictureInPictureModule), since Android WebView cannot float a video. The
// template's configChanges already keep the activity alive as it resizes.
module.exports = function withAndroidPictureInPicture(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(nextConfig.modResults);
    activity.$["android:supportsPictureInPicture"] = "true";
    return nextConfig;
  });
};
