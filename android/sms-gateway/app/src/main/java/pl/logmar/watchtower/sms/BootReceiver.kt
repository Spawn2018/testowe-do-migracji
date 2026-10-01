package pl.logmar.watchtower.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/**
 * Autostart: BOOT_COMPLETED, szybki restart Realme/Oppo, aktualizacja APK.
 * Tylko gdy prefs.enabled && konfiguracja kompletna.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    val restart = action == Intent.ACTION_BOOT_COMPLETED ||
      action == Intent.ACTION_MY_PACKAGE_REPLACED ||
      action == "android.intent.action.QUICKBOOT_POWERON" ||
      action == "com.htc.intent.action.QUICKBOOT_POWERON"
    if (!restart) return

    val prefs = Prefs(context)
    if (!prefs.enabled || !prefs.isConfigured()) return
    KeepAliveReceiver.schedule(context, delayMs = 5_000L)
    try {
      ContextCompat.startForegroundService(context, Intent(context, GatewayService::class.java))
    } catch (_: Exception) {
      // KeepAlive dogoni
    }
  }
}
