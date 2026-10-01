package pl.logmar.watchtower.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Autostart po restarcie telefonu, gdy bramka była włączona. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    val prefs = Prefs(context)
    if (!prefs.enabled || !prefs.isConfigured()) return
    ContextCompat.startForegroundService(context, Intent(context, GatewayService::class.java))
  }
}
