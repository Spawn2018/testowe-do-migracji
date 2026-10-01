package pl.logmar.watchtower.sms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicInteger

/**
 * Usługa pierwszoplanowa: heartbeat + pull + wysyłka.
 * Stan „włączona” w Prefs — onDestroy NIE wyłącza (zabicie przez system ≠ Stop).
 * KeepAliveAlarm + BOOT przywracają usługę na Realme/ColorOS.
 */
class GatewayService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private var loop: Job? = null
  private lateinit var prefs: Prefs
  private lateinit var api: TowerApi
  private val reqSeq = AtomicInteger(1)

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    prefs = Prefs(this)
    api = TowerApi(prefs)
    ensureChannel()
    // Android 12+: startForeground jak najszybciej po startForegroundService
    startForeground(NOTIF_ID, buildNotif("start"))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      prefs.enabled = false
      KeepAliveReceiver.cancel(this)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIF_ID, buildNotif("aktywna"))
    prefs.enabled = true
    KeepAliveReceiver.schedule(this)

    if (loop?.isActive != true) {
      loop = scope.launch { runLoop() }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    // NIE kasuj prefs.enabled — zabicie przez system ma przywrócić usługę
    loop?.cancel()
    scope.cancel()
    if (Prefs(this).enabled) {
      KeepAliveReceiver.schedule(this)
    }
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
    if (prefs.enabled) {
      // Realme często zabija po swipe z ostatnich — alarm + natychmiastowy restart
      KeepAliveReceiver.schedule(this, delayMs = 2_000L)
      try {
        startForegroundService(Intent(this, GatewayService::class.java))
      } catch (_: Exception) {
        // Alarm dogoni
      }
    }
  }

  private suspend fun runLoop() {
    var pollMs = 15_000L
    while (scope.isActive) {
      if (!prefs.enabled) break
      try {
        if (!prefs.isConfigured()) {
          updateNotif("brak konfiguracji")
          delay(30_000)
          continue
        }
        val hb = api.heartbeat()
        pollMs = (hb.optInt("poll_s", 15).coerceIn(10, 120)) * 1000L
        val paused = hb.optBoolean("paused", false)
        val daySent = hb.optInt("day_sent", 0)
        val dayLimit = hb.optInt("day_limit", 150)
        updateNotif("OK · dziś $daySent/$dayLimit")
        KeepAliveReceiver.schedule(this)

        if (!paused) {
          val items = api.pull(1)
          for (item in items) {
            sendOne(item)
            delay(GAP_MS)
          }
        }
      } catch (e: Exception) {
        updateNotif("błąd: ${e.message?.take(80) ?: "nieznany"}")
      }
      delay(pollMs)
    }
  }

  private fun sendOne(item: OutboxItem) {
    try {
      @Suppress("DEPRECATION")
      val sm = SmsManager.getDefault()
      val parts = sm.divideMessage(item.body)
      val n = parts.size.coerceAtLeast(1)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE
        else 0
      val sentList = ArrayList<PendingIntent>(n)
      val delList = ArrayList<PendingIntent>(n)
      for (i in 0 until n) {
        val req = reqSeq.getAndIncrement()
        val sentIntent = Intent(this, SmsResultReceiver::class.java).apply {
          action = SmsResultReceiver.ACTION_SENT
          putExtra(SmsResultReceiver.EXTRA_SMS_ID, item.id)
          putExtra(SmsResultReceiver.EXTRA_PARTS, n)
          data = android.net.Uri.parse("wt-sms://sent/${item.id}/$i")
        }
        val delIntent = Intent(this, SmsResultReceiver::class.java).apply {
          action = SmsResultReceiver.ACTION_DELIVERED
          putExtra(SmsResultReceiver.EXTRA_SMS_ID, item.id)
          putExtra(SmsResultReceiver.EXTRA_PARTS, n)
          data = android.net.Uri.parse("wt-sms://delivered/${item.id}/$i")
        }
        sentList.add(PendingIntent.getBroadcast(this, req, sentIntent, flags))
        delList.add(PendingIntent.getBroadcast(this, req + 100_000, delIntent, flags))
      }
      if (n == 1) {
        sm.sendTextMessage(item.toE164, null, item.body, sentList[0], delList[0])
      } else {
        sm.sendMultipartTextMessage(item.toE164, null, parts, sentList, delList)
      }
    } catch (e: Exception) {
      api.report(item.id, "FAILED", error = e.message ?: "send failed")
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java)
    // DEFAULT — Realme czasem chowa kanały LOW
    mgr.createNotificationChannel(
      NotificationChannel(CHANNEL, getString(R.string.channel_name), NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = getString(R.string.channel_desc)
        setShowBadge(false)
      },
    )
  }

  private fun buildNotif(status: String): Notification {
    val open = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val whenTxt = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).apply {
      timeZone = TimeZone.getDefault()
    }.format(Date())
    return NotificationCompat.Builder(this, CHANNEL)
      .setContentTitle(getString(R.string.notif_title))
      .setContentText(getString(R.string.notif_text, "$whenTxt · $status"))
      .setSmallIcon(android.R.drawable.ic_dialog_email)
      .setContentIntent(open)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .build()
  }

  private fun updateNotif(status: String) {
    val mgr = getSystemService(NotificationManager::class.java)
    mgr.notify(NOTIF_ID, buildNotif(status))
  }

  companion object {
    const val CHANNEL = "sms_gateway"
    const val NOTIF_ID = 7103
    const val GAP_MS = 3_000L
    const val ACTION_STOP = "pl.logmar.watchtower.sms.STOP"
  }
}
