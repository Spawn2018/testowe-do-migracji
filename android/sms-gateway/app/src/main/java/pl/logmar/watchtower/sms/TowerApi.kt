package pl.logmar.watchtower.sms

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class OutboxItem(
  val id: String,
  val toE164: String,
  val body: String,
)

/**
 * Klient PULL: sms_pull / sms_report / sms_heartbeat (anon + token urządzenia).
 * Token nigdy nie trafia do logów aplikacji.
 */
class TowerApi(private val prefs: Prefs) {
  private val http = OkHttpClient.Builder()
    .connectTimeout(20, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build()

  private val json = "application/json; charset=utf-8".toMediaType()

  fun heartbeat(): JSONObject {
    val body = JSONObject()
      .put("p_token", prefs.deviceToken)
      .put(
        "p_info",
        JSONObject()
          .put("app", "watch-tower-sms")
          .put("ver", "1.0.2")
          .put("phone_set", prefs.gatewayPhone.isNotBlank()),
      )
    return postRpc("sms_heartbeat", body)
  }

  fun pull(limit: Int = 5): List<OutboxItem> {
    val body = JSONObject()
      .put("p_token", prefs.deviceToken)
      .put("p_limit", limit)
    val res = postRpcRaw("sms_pull", body)
    if (res.isBlank() || res == "null") return emptyList()
    val arr = JSONArray(res)
    val out = ArrayList<OutboxItem>(arr.length())
    for (i in 0 until arr.length()) {
      val o = arr.getJSONObject(i)
      out.add(
        OutboxItem(
          id = o.getString("id"),
          toE164 = o.getString("to_e164"),
          body = o.getString("body"),
        ),
      )
    }
    return out
  }

  fun report(id: String, status: String, error: String? = null, parts: Int? = null) {
    val body = JSONObject()
      .put("p_token", prefs.deviceToken)
      .put("p_id", id)
      .put("p_status", status)
    if (error != null) body.put("p_error", error.take(300))
    if (parts != null) body.put("p_parts", parts)
    postRpcRaw("sms_report", body)
  }

  private fun postRpc(name: String, body: JSONObject): JSONObject {
    val raw = postRpcRaw(name, body)
    return if (raw.isBlank() || raw == "null") JSONObject() else JSONObject(raw)
  }

  private fun postRpcRaw(name: String, body: JSONObject): String {
    val url = "${prefs.supabaseUrl}/rest/v1/rpc/$name"
    val req = Request.Builder()
      .url(url)
      .post(body.toString().toRequestBody(json))
      .header("apikey", prefs.anonKey)
      .header("Authorization", "Bearer ${prefs.anonKey}")
      .header("Content-Type", "application/json")
      .header("Prefer", "return=representation")
      .header("x-device-token", prefs.deviceToken)
      .build()
    http.newCall(req).execute().use { resp ->
      val text = resp.body?.string().orEmpty()
      if (!resp.isSuccessful) {
        // Bez tokenu w komunikacie
        throw RuntimeException("RPC $name HTTP ${resp.code}: ${text.take(180)}")
      }
      return text
    }
  }
}
