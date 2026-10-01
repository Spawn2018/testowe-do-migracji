package pl.logmar.watchtower.sms

import android.content.Context
import android.content.SharedPreferences

/** Preferencje lokalne — token i sekrety tylko na urządzeniu. */
class Prefs(ctx: Context) {
  private val p: SharedPreferences =
    ctx.getSharedPreferences("sms_gateway", Context.MODE_PRIVATE)

  var supabaseUrl: String
    get() = p.getString(KEY_URL, "") ?: ""
    set(v) = p.edit().putString(KEY_URL, v.trim().trimEnd('/')).apply()

  var anonKey: String
    get() = p.getString(KEY_ANON, "") ?: ""
    set(v) = p.edit().putString(KEY_ANON, v.trim()).apply()

  var deviceToken: String
    get() = p.getString(KEY_TOKEN, "") ?: ""
    set(v) = p.edit().putString(KEY_TOKEN, v.trim()).apply()

  /** Numer SIM bramki — wpisuje właściciel; nigdy w repo. */
  var gatewayPhone: String
    get() = p.getString(KEY_PHONE, "") ?: ""
    set(v) = p.edit().putString(KEY_PHONE, v.trim()).apply()

  var enabled: Boolean
    get() = p.getBoolean(KEY_ON, false)
    set(v) = p.edit().putBoolean(KEY_ON, v).apply()

  fun isConfigured(): Boolean =
    supabaseUrl.startsWith("https://") &&
      anonKey.length > 20 &&
      deviceToken.length >= 32 &&
      gatewayPhone.matches(Regex("^\\+[1-9][0-9]{7,14}$"))

  companion object {
    private const val KEY_URL = "url"
    private const val KEY_ANON = "anon"
    private const val KEY_TOKEN = "token"
    private const val KEY_PHONE = "phone"
    private const val KEY_ON = "on"
  }
}
