package pl.logmar.watchtower.sms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.content.ContextCompat

/**
 * Strażnik lokalny: co ~12 min sprawdza, czy bramka ma być włączona —
 * jeśli tak, a usługa nie żyje (Realme/ColorOS), uruchamia ją ponownie.
 */
class KeepAliveReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val prefs = Prefs(context)
    if (!prefs.enabled || !prefs.isConfigured()) return
    try {
      ContextCompat.startForegroundService(context, Intent(context, GatewayService::class.java))
    } catch (_: Exception) {
      // kolejny alarm
    }
    schedule(context)
  }

  companion object {
    const val ACTION = "pl.logmar.watchtower.sms.KEEPALIVE"
    private const val REQ = 7104
    /** ~12 min — poniżej progu ciszy 15 min strażnika serwera */
    private const val INTERVAL_MS = 12 * 60 * 1000L

    fun schedule(context: Context, delayMs: Long = INTERVAL_MS) {
      val am = context.getSystemService(AlarmManager::class.java) ?: return
      val pi = pending(context)
      val at = SystemClock.elapsedRealtime() + delayMs.coerceAtLeast(1_000L)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
        } else {
          @Suppress("DEPRECATION")
          am.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
        }
      } catch (_: SecurityException) {
        am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
      }
    }

    fun cancel(context: Context) {
      val am = context.getSystemService(AlarmManager::class.java) ?: return
      am.cancel(pending(context))
    }

    private fun pending(context: Context): PendingIntent {
      val i = Intent(context, KeepAliveReceiver::class.java).setAction(ACTION)
      return PendingIntent.getBroadcast(
        context,
        REQ,
        i,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
