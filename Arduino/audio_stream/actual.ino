// ============================================================
//  CONFIG — edit before flashing
// ============================================================
#define WIFI_SSID           "NEWORKNAME"
#define WIFI_PASSWORD       "PASSWORD"
#define ELEVENLABS_API_KEY  "sk_SECRET"
#define RECORD_SECONDS      30
// ============================================================
//  INMP441 I2S pins — verify against your wiring
// ============================================================
#define I2S_SCK_PIN   14   // BCLK
#define I2S_WS_PIN    15   // LRCLK / WS
#define I2S_SD_PIN    32   // Data
// ============================================================

#include <driver/i2s.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <SPIFFS.h>

#define SAMPLE_RATE      16000
#define WAV_HEADER_SIZE  44
#define VOLUME_GAIN      2
#define I2S_PORT         I2S_NUM_0
#define LED_PIN          2
#define WAV_PATH         "/rec.wav"

WebServer httpServer(80);
String    lastTranscript    = "Waiting for first recording...";
uint32_t  transcriptIndex   = 0;
uint32_t  transcriptTimestamp = 0;

// ── WiFi ─────────────────────────────────────────────────────
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF); delay(100);
  WiFi.mode(WIFI_STA); delay(100);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - t > 15000) {
      Serial.println("\n[WiFi] Timeout — retrying");
      WiFi.disconnect(true); delay(500);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      t = millis();
    }
    delay(500); Serial.print(".");
  }
  Serial.printf("\n[WiFi] Connected — http://%s/transcript\n",
                WiFi.localIP().toString().c_str());
}

// ── I2S (legacy driver — works with INMP441 standard I2S) ────
void initI2S() {
  i2s_config_t cfg = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,  // L/R pin to GND = left ch
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = 8,
    .dma_buf_len          = 512,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };
  i2s_pin_config_t pins = {
    .bck_io_num   = I2S_SCK_PIN,
    .ws_io_num    = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_SD_PIN
  };
  ESP_ERROR_CHECK(i2s_driver_install(I2S_PORT, &cfg, 0, NULL));
  ESP_ERROR_CHECK(i2s_set_pin(I2S_PORT, &pins));
  ESP_ERROR_CHECK(i2s_zero_dma_buffer(I2S_PORT));
  Serial.println("[I2S] Ready");
}

// ── WAV header ───────────────────────────────────────────────
void writeWavHeader(File& f, uint32_t pcm_bytes) {
  uint32_t file_size = pcm_bytes + WAV_HEADER_SIZE - 8;
  uint32_t byte_rate = SAMPLE_RATE * 2;  // mono 16-bit
  uint8_t h[WAV_HEADER_SIZE] = {
    'R','I','F','F',
    (uint8_t)file_size,(uint8_t)(file_size>>8),(uint8_t)(file_size>>16),(uint8_t)(file_size>>24),
    'W','A','V','E',
    'f','m','t',' ',
    0x10,0x00,0x00,0x00,   // subchunk1 size = 16
    0x01,0x00,             // PCM
    0x01,0x00,             // mono
    (uint8_t)SAMPLE_RATE,(uint8_t)(SAMPLE_RATE>>8),(uint8_t)(SAMPLE_RATE>>16),(uint8_t)(SAMPLE_RATE>>24),
    (uint8_t)byte_rate,(uint8_t)(byte_rate>>8),(uint8_t)(byte_rate>>16),(uint8_t)(byte_rate>>24),
    0x02,0x00,             // block align
    0x10,0x00,             // bits per sample = 16
    'd','a','t','a',
    (uint8_t)pcm_bytes,(uint8_t)(pcm_bytes>>8),(uint8_t)(pcm_bytes>>16),(uint8_t)(pcm_bytes>>24)
  };
  f.seek(0);
  f.write(h, WAV_HEADER_SIZE);
}

// ── Record 15 s to SPIFFS ────────────────────────────────────
void recordToSPIFFS() {
  File f = SPIFFS.open(WAV_PATH, FILE_WRITE);
  if (!f) { Serial.println("[REC] SPIFFS open failed"); return; }

  // Write blank header placeholder — filled in after recording
  uint8_t blank[WAV_HEADER_SIZE] = {0};
  f.write(blank, WAV_HEADER_SIZE);

  // 16-bit mode: samples come out as plain int16_t, no bit manipulation needed
  int16_t buf[256];
  uint32_t total_pcm_bytes = 0;
  unsigned long deadline = millis() + (uint32_t)(RECORD_SECONDS * 1000UL);

  Serial.printf("[REC] Recording %d s...\n", RECORD_SECONDS);
  digitalWrite(LED_PIN, HIGH);

  int32_t max_sample = 0;
  while (millis() < deadline) {
    size_t bytes_read = 0;
    i2s_read(I2S_PORT, buf, sizeof(buf), &bytes_read, pdMS_TO_TICKS(50));

    int n = bytes_read / 2;
    for (int i = 0; i < n; i++) {
      int32_t a = abs((int32_t)buf[i]);
      if (a > max_sample) max_sample = a;
    }
    f.write((uint8_t*)buf, bytes_read);
    total_pcm_bytes += bytes_read;

    httpServer.handleClient();  // keep HTTP server alive during recording
  }

  writeWavHeader(f, total_pcm_bytes);
  f.close();
  digitalWrite(LED_PIN, LOW);
  Serial.printf("[REC] Saved %u bytes PCM — peak sample: %d %s\n",
                total_pcm_bytes, max_sample,
                max_sample < 10 ? "⚠ SILENT — check wiring!" : "OK");
}

// ── Stream WAV to ElevenLabs, return transcript ──────────────
// Uses WiFiClientSecure directly so the WAV is streamed in chunks —
// the full file never needs to sit in RAM.
String transcribeWithElevenLabs() {
  File f = SPIFFS.open(WAV_PATH);
  if (!f) { Serial.println("[STT] Cannot open WAV"); return ""; }
  size_t wav_size = f.size();
  Serial.printf("[STT] WAV size: %u bytes\n", wav_size);

  String boundary = "----ESP32Boundary";
  String part1 =
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"model_id\"\r\n\r\n"
    "scribe_v1\r\n"
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n"
    "Content-Type: audio/wav\r\n\r\n";
  String part2 = "\r\n--" + boundary + "--\r\n";
  size_t body_len = part1.length() + wav_size + part2.length();

  WiFiClientSecure client;
  client.setInsecure();   // skip cert verification — OK for hackathon
  client.setTimeout(30);

  Serial.println("[STT] Connecting to api.elevenlabs.io...");
  if (!client.connect("api.elevenlabs.io", 443)) {
    Serial.println("[STT] TLS connect failed");
    f.close();
    return "";
  }

  // Send HTTP headers
  client.printf(
    "POST /v1/speech-to-text HTTP/1.1\r\n"
    "Host: api.elevenlabs.io\r\n"
    "xi-api-key: %s\r\n"
    "Content-Type: multipart/form-data; boundary=%s\r\n"
    "Content-Length: %d\r\n"
    "Connection: close\r\n\r\n",
    ELEVENLABS_API_KEY, boundary.c_str(), (int)body_len
  );

  // Stream multipart body — no large malloc needed
  client.print(part1);
  uint8_t buf[512];
  size_t sent = 0;
  while (f.available()) {
    size_t n = f.read(buf, sizeof(buf));
    client.write(buf, n);
    sent += n;
    httpServer.handleClient();
  }
  f.close();
  client.print(part2);
  Serial.printf("[STT] Streamed %u bytes — waiting for response...\n", sent);

  // Read full response
  String full_response = "";
  uint32_t t = millis();
  while (millis() - t < 30000) {
    if (client.available()) {
      full_response += client.readString();
      t = millis();           // reset timeout on new data
    }
    if (!client.connected() && !client.available()) break;
    delay(10);
    httpServer.handleClient();
  }
  client.stop();

  // Split headers / body on blank line
  int sep = full_response.indexOf("\r\n\r\n");
  String body = (sep >= 0) ? full_response.substring(sep + 4) : full_response;
  Serial.printf("[STT] Response body: %s\n", body.c_str());

  // Parse JSON
  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, body) != DeserializationError::Ok) {
    Serial.println("[STT] JSON parse failed");
    return "";
  }
  if (!doc.containsKey("text")) {
    Serial.println("[STT] No 'text' field in response");
    return "";
  }
  return doc["text"].as<String>();
}

// ── HTTP endpoint: GET /transcript ───────────────────────────
void handleTranscript() {
  StaticJsonDocument<1024> doc;
  doc["text"]      = lastTranscript;
  doc["index"]     = transcriptIndex;
  doc["timestamp"] = transcriptTimestamp;
  String out;
  serializeJson(doc, out);
  httpServer.send(200, "application/json", out);
}

// ─────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== ESP32-WROOM Audio Transcriber ===");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  initI2S();

  if (!SPIFFS.begin(true)) {
    Serial.println("[SPIFFS] Mount failed — halting");
    while (true);
  }
  Serial.printf("[SPIFFS] Free: %u / %u bytes\n",
                SPIFFS.totalBytes() - SPIFFS.usedBytes(), SPIFFS.totalBytes());

  connectWiFi();

  httpServer.on("/transcript", HTTP_GET, handleTranscript);
  httpServer.onNotFound([]() {
    httpServer.send(200, "text/plain",
      "ESP32 Transcriber — GET /transcript for latest JSON");
  });
  httpServer.begin();
  Serial.printf("[HTTP] Ready at http://%s/transcript\n",
                WiFi.localIP().toString().c_str());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    connectWiFi();
    return;
  }

  httpServer.handleClient();

  // ── 1. Record ────────────────────────────────────────────
  recordToSPIFFS();

  // ── 2. Transcribe ────────────────────────────────────────
  Serial.println("[STT] Sending to ElevenLabs Scribe...");
  uint32_t t0 = millis();
  String transcript = transcribeWithElevenLabs();
  Serial.printf("[STT] Finished in %.1f s\n", (millis() - t0) / 1000.0f);

  // ── 3. Update served JSON ─────────────────────────────────
  if (transcript.length() > 0) {
    lastTranscript     = transcript;
    transcriptIndex++;
    transcriptTimestamp = millis();
    Serial.printf("[TRANSCRIPT #%u] %s\n", transcriptIndex, transcript.c_str());
    digitalWrite(LED_PIN, HIGH); delay(200); digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("[STT] Empty result — will retry next cycle");
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_PIN, HIGH); delay(150);
      digitalWrite(LED_PIN, LOW);  delay(150);
    }
  }

  httpServer.handleClient();
  // loop immediately restarts → record next 15-second window
}