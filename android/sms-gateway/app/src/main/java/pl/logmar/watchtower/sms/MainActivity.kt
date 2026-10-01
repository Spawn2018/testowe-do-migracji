package pl.logmar.watchtower.sms

import android.Manifest
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
    status.text = if (ok) "Uprawnienia SMS OK — możesz uruchomić bramkę." else "Brak uprawnień SMS — bramka nie wyśle."
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

    inputUrl.setText(prefs.supabaseUrl)
    inputAnon.setText(prefs.anonKey)
    inputToken.setText(prefs.deviceToken)
    inputPhone.setText(prefs.gatewayPhone)
    status.text = if (prefs.enabled) "Status: uruchomiona" else "Status: zatrzymana"

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
      ContextCompat.startForegroundService(this, Intent(this, GatewayService::class.java))
      status.text = "Status: uruchomiona"
    }

    findViewById<Button>(R.id.btnStop).setOnClickListener {
      stopService(Intent(this, GatewayService::class.java))
      prefs.enabled = false
      status.text = "Status: zatrzymana"
    }

    findViewById<Button>(R.id.btnBattery).setOnClickListener {
      requestBatteryExemption()
    }

    ensureSmsPerms()
  }

  private fun ensureSmsPerms() {
    val need = mutableListOf(Manifest.permission.SEND_SMS)
    if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
    val missing = need.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) askPerms.launch(missing.toTypedArray())
  }

  private fun requestBatteryExemption() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val pm = getSystemService(PowerManager::class.java)
    if (pm.isIgnoringBatteryOptimizations(packageName)) {
      Toast.makeText(this, "Oszczędzanie baterii już wyłączone dla tej aplikacji", Toast.LENGTH_LONG).show()
      return
    }
    val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:$packageName")
    }
    startActivity(i)
  }
}
