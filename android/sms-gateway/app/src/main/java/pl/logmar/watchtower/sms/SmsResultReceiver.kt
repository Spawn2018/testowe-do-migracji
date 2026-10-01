package pl.logmar.watchtower.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import java.util.concurrent.Executors

/**
 * Raport SENT / FAILED z sentIntent oraz DELIVERED z deliveryIntent.
 * goAsync + wątek w tle — inaczej proces ginie przed HTTP i status zostaje CLAIMED.
 */
class SmsResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(EXTRA_SMS_ID) ?: return
    val parts = intent.getIntExtra(EXTRA_PARTS, 1)
    val action = intent.action ?: return
    val code = resultCode
    val prefs = Prefs(context)
    if (!prefs.isConfigured()) return

    val pending = goAsync()
    EXECUTOR.execute {
      try {
        val api = TowerApi(prefs)
        when (action) {
          ACTION_SENT -> {
            when (code) {
              Activity.RESULT_OK -> api.report(id, "SENT", parts = parts)
              SmsManager.RESULT_ERROR_GENERIC_FAILURE ->
                api.report(id, "FAILED", error = "generic_failure", parts = parts)
              SmsManager.RESULT_ERROR_NO_SERVICE ->
                api.report(id, "FAILED", error = "no_service", parts = parts)
              SmsManager.RESULT_ERROR_NULL_PDU ->
                api.report(id, "FAILED", error = "null_pdu", parts = parts)
              SmsManager.RESULT_ERROR_RADIO_OFF ->
                api.report(id, "FAILED", error = "radio_off", parts = parts)
              else -> api.report(id, "FAILED", error = "sent_rc_$code", parts = parts)
            }
          }
          ACTION_DELIVERED -> {
            if (code == Activity.RESULT_OK) {
              api.report(id, "DELIVERED", parts = parts)
            }
            // RESULT_CANCELED = brak raportu sieci — zostaje SENT; watchdog 10 min
          }
        }
      } catch (_: Exception) {
        // błąd sieci: sms_pull przywróci CLAIMED po 3 min
      } finally {
        pending.finish()
      }
    }
  }

  companion object {
    const val ACTION_SENT = "pl.logmar.watchtower.sms.SMS_SENT"
    const val ACTION_DELIVERED = "pl.logmar.watchtower.sms.SMS_DELIVERED"
    const val EXTRA_SMS_ID = "sms_id"
    const val EXTRA_PARTS = "parts"
    private val EXECUTOR = Executors.newSingleThreadExecutor()
  }
}
