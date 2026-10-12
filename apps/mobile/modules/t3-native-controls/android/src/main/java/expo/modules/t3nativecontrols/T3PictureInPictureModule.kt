package expo.modules.t3nativecontrols

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.core.app.OnPictureInPictureModeChangedProvider
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.roundToInt

/**
 * Android WebView cannot float a video, so the browser screen floats the whole
 * activity instead and lays itself out as the player while `onChange` reports it active.
 */
class T3PictureInPictureModule : Module() {
  private var observed: OnPictureInPictureModeChangedProvider? = null
  private val onModeChanged = Consumer<PictureInPictureModeChangedInfo> { info ->
    sendEvent("onChange", mapOf("active" to info.isInPictureInPictureMode))
  }

  override fun definition() = ModuleDefinition {
    Name("T3PictureInPicture")
    Events("onChange")

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        appContext.reactContext
          ?.packageManager
          ?.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE) == true
    }

    // False when the system declines, e.g. the person turned picture in picture off for the app.
    AsyncFunction("enter") { width: Double, height: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      observe(activity)
      val params = PictureInPictureParams.Builder().setAspectRatio(aspectRatio(width, height))
      // Page text blurs when the system stretches the old frame during a resize.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) params.setSeamlessResizeEnabled(false)
      activity.enterPictureInPictureMode(params.build())
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      observed?.removeOnPictureInPictureModeChangedListener(onModeChanged)
      observed = null
    }
  }

  private fun observe(activity: Activity) {
    val provider = activity as? OnPictureInPictureModeChangedProvider ?: return
    if (provider === observed) return
    observed?.removeOnPictureInPictureModeChangedListener(onModeChanged)
    provider.addOnPictureInPictureModeChangedListener(onModeChanged)
    observed = provider
  }

  // The system rejects ratios outside 1:2.39 to 2.39:1.
  private fun aspectRatio(width: Double, height: Double): Rational {
    val ratio = if (width > 0 && height > 0) width / height else 1.0
    return Rational((ratio.coerceIn(0.42, 2.38) * 1000).roundToInt(), 1000)
  }
}
