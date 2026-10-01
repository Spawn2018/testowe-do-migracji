package pl.logmar.watchtower.sms

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.textfield.TextInputEditText

class MainActivity : AppCompatActivity() {
  private lateinit var prefs: Prefs
  private lateinit var status: TextView

  private val askPerms = registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions(),
  ) { map ->
    val ok = map.values.all { it }
    status.text = if (ok) {
      "Uprawnienia SMS OK — możesz uruchomić bramkę."
    } else {
      "Brak uprawnień SMS — bramka nie wyśle."
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    prefs = Prefs(this)

    val inputUrl = findViewById<TextInputEditText>(R.id.inputUrl)
    val inputAnon = findViewById<TextInputEditText>(R.id.inputAnon)
    val inputToken = findViewById<TextInputEditText>(R.id.inputToken)
    val inputPhone = findViewById<TextInputEditText>(R.id.inputPhone)
    status = findViewById(R.id.status)
    val vendorHint = findViewById<TextView>(R.id.vendorHint)
    vendorHint.text = getString(R.string.realme_setup)

    inputUrl.setText(prefs.supabaseUrl)
    inputAnon.setText(prefs.anonKey)
    inputToken.setText(prefs.deviceToken)
    inputPhone.setText(prefs.gatewayPhone)
    refreshStatus()

    findViewById<Button>(R.id.btnSave).setOnClickListener {
      prefs.supabaseUrl = inputUrl.text?.toString().orEmpty()
      prefs.anonKey = inputAnon.text?.toString().orEmpty()
      prefs.deviceToken = inputToken.text?.toString().orEmpty()
      prefs.gatewayPhone = inputPhone.text?.toString().orEmpty()
      status.text = if (prefs.isConfigured()) {
        "Zapisano. Konfiguracja kompletna."
      } else {
        "Zapisano, ale brakuje pól (URL https, anon, token ≥32, telefon E.164)."
      }
    }

    findViewById<Button>(R.id.btnStart).setOnClickListener {
      if (!prefs.isConfigured()) {
        Toast.makeText(this, "Najpierw zapisz pełną konfigurację", Toast.LENGTH_LONG).show()
        return@setOnClickListener
      }
      ensureSmsPerms()
      prefs.enabled = true
      ContextCompat.startForegroundService(this, Intent(this, GatewayService::class.java))
      KeepAliveReceiver.schedule(this)
      refreshStatus()
      maybePromptBatteryAndVendor()
    }

    findViewById<Button>(R.id.btnStop).setOnClickListener {
      val stop = Intent(this, GatewayService::class.java).setAction(GatewayService.ACTION_STOP)
      ContextCompat.startForegroundService(this, stop)
      prefs.enabled = false
      KeepAliveReceiver.cancel(this)
      refreshStatus()
    }

    findViewById<Button>(R.id.btnBattery).setOnClickListener {
      requestBatteryExemption()
    }

    findViewById<Button>(R.id.btnVendor).setOnClickListener {
      showVendorDialog()
      openVendorAutostartSettings()
    }

    ensureSmsPerms()

    // Po otwarciu aplikacji: jeśli miała być włączona — wznów usługę
    if (prefs.enabled && prefs.isConfigured()) {
      ContextCompat.startForegroundService(this, Intent(this, GatewayService::class.java))
      KeepAliveReceiver.schedule(this)
    }

    if (!prefs.batteryPromptDone) {
      maybePromptBatteryAndVendor()
    }
  }

  override fun onResume() {
    super.onResume()
    refreshStatus()
  }

  private fun refreshStatus() {
    val bat = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val pm = getSystemService(PowerManager::class.java)
      if (pm.isIgnoringBatteryOptimizations(packageName)) "bateria: bez ograniczeń" else "bateria: OGRANICZONA"
    } else {
      "bateria: n/d"
    }
    status.text = if (prefs.enabled) {
      "Status: włączona (zapisane) · $bat · v${BuildConfig.VERSION_NAME}"
    } else {
      "Status: zatrzymana · $bat · v${BuildConfig.VERSION_NAME}"
    }
  }

  private fun ensureSmsPerms() {
    val need = mutableListOf(Manifest.permission.SEND_SMS)
    if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
    val missing = need.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) askPerms.launch(missing.toTypedArray())
  }

  private fun maybePromptBatteryAndVendor() {
    if (prefs.batteryPromptDone) return
    AlertDialog.Builder(this)
      .setTitle(R.string.battery_dialog_title)
      .setMessage(R.string.battery_dialog_msg)
      .setPositiveButton(R.string.battery_dialog_ok) { _, _ ->
        prefs.batteryPromptDone = true
        requestBatteryExemption()
        showVendorDialog()
      }
      .setNegativeButton(R.string.battery_dialog_later) { _, _ ->
        prefs.batteryPromptDone = true
      }
      .setCancelable(false)
      .show()
  }

  private fun showVendorDialog() {
    AlertDialog.Builder(this)
      .setTitle(R.string.realme_dialog_title)
      .setMessage(R.string.realme_setup)
      .setPositiveButton(android.R.string.ok, null)
      .setNeutralButton(R.string.realme_open_settings) { _, _ ->
        openVendorAutostartSettings()
      }
      .show()
  }

  private fun requestBatteryExemption() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val pm = getSystemService(PowerManager::class.java)
    if (pm.isIgnoringBatteryOptimizations(packageName)) {
      Toast.makeText(this, R.string.battery_already_ok, Toast.LENGTH_LONG).show()
      refreshStatus()
      return
    }
    try {
      startActivity(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:$packageName")
        },
      )
    } catch (_: Exception) {
      startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }
  }

  /** Realme / Oppo / ColorOS — najlepsze dostępne ustawienia systemowe. */
  private fun openVendorAutostartSettings() {
    val candidates = listOf(
      Intent().setClassName(
        "com.coloros.safecenter",
        "com.coloros.safecenter.permission.startup.StartupAppListActivity",
      ),
      Intent().setClassName(
        "com.oplus.safecenter",
        "com.oplus.safecenter.permission.startup.StartupAppListActivity",
      ),
      Intent().setClassName(
        "com.coloros.safecenter",
        "com.coloros.safecenter.startupapp.StartupAppListActivity",
      ),
      Intent().setClassName(
        "com.oppo.safe",
        "com.oppo.safe.permission.startup.StartupAppListActivity",
      ),
      Intent().setClassName(
        "com.coloros.oppoguardelf",
        "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity",
      ),
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:$packageName")
      },
    )
    for (i in candidates) {
      try {
        startActivity(i)
        return
      } catch (_: Exception) {
        // następny
      }
    }
  }
}
