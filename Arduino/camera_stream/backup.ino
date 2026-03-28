/*
 * Second Mind — ESP32-S3 MJPEG Camera Stream
 *
 * Streams MJPEG video over WiFi for the laptop pipeline to consume.
 * Endpoints:
 *   /stream  — continuous MJPEG stream
 *   /frame   — single JPEG snapshot
 *   /status  — JSON health check
 */

#include <WiFi.h>
#include <WebServer.h>
#include <esp_camera.h>

// ========================
// WiFi Config — UPDATE THESE
// ========================
const char* ssid     = "Stev";
const char* password = "Sismyname";

// ========================
// Camera Pins (AI Thinker)
// ========================
// Freenove ESP32-S3 WROOM CAM pinout
#define PWDN_GPIO    -1
#define RESET_GPIO   -1
#define XCLK_GPIO     15
#define SIOD_GPIO      4
#define SIOC_GPIO      5

#define Y9_GPIO       16
#define Y8_GPIO       17
#define Y7_GPIO       18
#define Y6_GPIO       12
#define Y5_GPIO       10
#define Y4_GPIO        8
#define Y3_GPIO        9
#define Y2_GPIO       11
#define VSYNC_GPIO     6
#define HREF_GPIO      7
#define PCLK_GPIO     13

// ========================
// Stream Settings
// ========================
#define FRAME_SIZE    FRAMESIZE_VGA   // 640x480 — good balance of quality and speed
#define JPEG_QUALITY  12              // 0-63, lower = better quality
#define XCLK_FREQ     20000000       // 20MHz camera clock

const char* STREAM_BOUNDARY = "secondmindframe";
const char* STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=secondmindframe";

WebServer server(80);

unsigned long frames_served = 0;
unsigned long stream_start_time = 0;

// ========================
// Camera Init
// ========================
bool init_camera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO;
  config.pin_d1       = Y3_GPIO;
  config.pin_d2       = Y4_GPIO;
  config.pin_d3       = Y5_GPIO;
  config.pin_d4       = Y6_GPIO;
  config.pin_d5       = Y7_GPIO;
  config.pin_d6       = Y8_GPIO;
  config.pin_d7       = Y9_GPIO;
  config.pin_xclk     = XCLK_GPIO;
  config.pin_pclk     = PCLK_GPIO;
  config.pin_vsync    = VSYNC_GPIO;
  config.pin_href     = HREF_GPIO;
  config.pin_sccb_sda = SIOD_GPIO;
  config.pin_sccb_scl = SIOC_GPIO;
  config.pin_pwdn     = PWDN_GPIO;
  config.pin_reset    = RESET_GPIO;
  config.xclk_freq_hz = XCLK_FREQ;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode    = CAMERA_GRAB_LATEST;  // always grab newest frame
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = JPEG_QUALITY;
  config.fb_count     = 2;  // double buffer for smooth streaming

  // Use PSRAM if available for higher resolution
  if (psramFound()) {
    config.frame_size = FRAME_SIZE;
    config.fb_count   = 2;
    Serial.println("PSRAM found, using double buffer");
  } else {
    config.frame_size   = FRAMESIZE_QVGA;  // fallback to 320x240
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
    Serial.println("No PSRAM, falling back to QVGA");
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return false;
  }

  // Tune sensor settings for indoor/wearable use
  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);    // slight brightness boost
    s->set_contrast(s, 1);      // slight contrast boost
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);      // auto white balance on
    s->set_awb_gain(s, 1);
    s->set_wb_mode(s, 0);       // auto WB mode
    s->set_exposure_ctrl(s, 1); // auto exposure on
    s->set_aec2(s, 1);          // auto exposure DSP
    s->set_gain_ctrl(s, 1);     // auto gain on
    s->set_agc_gain(s, 0);
    s->set_gainceiling(s, (gainceiling_t)6);
    s->set_bpc(s, 1);           // black pixel correction
    s->set_wpc(s, 1);           // white pixel correction
    s->set_hmirror(s, 0);
    s->set_vflip(s, 0);
  }

  Serial.println("Camera initialized");
  return true;
}

// ========================
// MJPEG Stream Handler
// ========================
void handle_stream() {
  WiFiClient client = server.client();

  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: " + String(STREAM_CONTENT_TYPE));
  client.println("Access-Control-Allow-Origin: *");
  client.println("Connection: close");
  client.println();

  stream_start_time = millis();
  unsigned long local_frame_count = 0;

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Frame capture failed");
      continue;
    }

    client.printf("--%s\r\n", STREAM_BOUNDARY);
    client.println("Content-Type: image/jpeg");
    client.printf("Content-Length: %u\r\n", fb->len);
    client.println();

    // Send frame data in chunks to avoid WiFi buffer overflow
    size_t sent = 0;
    const size_t CHUNK = 4096;
    while (sent < fb->len) {
      size_t to_send = min(CHUNK, fb->len - sent);
      size_t written = client.write(fb->buf + sent, to_send);
      if (written == 0) {
        break;  // client disconnected
      }
      sent += written;
    }

    client.println();

    esp_camera_fb_return(fb);

    frames_served++;
    local_frame_count++;

    // Log FPS every 100 frames
    if (local_frame_count % 100 == 0) {
      float elapsed = (millis() - stream_start_time) / 1000.0;
      Serial.printf("Stream: %lu frames, %.1f FPS\n", local_frame_count, local_frame_count / elapsed);
    }
  }

  Serial.printf("Stream client disconnected after %lu frames\n", local_frame_count);
}

// ========================
// Single Frame Handler
// ========================
void handle_frame() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Camera capture failed");
    return;
  }

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  server.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);

  esp_camera_fb_return(fb);
  frames_served++;
}

// ========================
// Status Handler
// ========================
void handle_status() {
  String json = "{";
  json += "\"status\":\"running\",";
  json += "\"ssid\":\"" + String(ssid) + "\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"frames_served\":" + String(frames_served) + ",";
  json += "\"uptime_sec\":" + String(millis() / 1000) + ",";
  json += "\"psram\":" + String(psramFound() ? "true" : "false") + ",";
  json += "\"free_heap\":" + String(ESP.getFreeHeap());
  json += "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// ========================
// Root Handler
// ========================
void handle_root() {
  String html = "<!DOCTYPE html><html><head><title>Second Mind Camera</title></head><body>";
  html += "<h2>Second Mind Camera Stream</h2>";
  html += "<img src='/stream' style='max-width:100%;'><br><br>";
  html += "<a href='/frame'>Single Frame</a> | ";
  html += "<a href='/status'>Status JSON</a> | ";
  html += "<p>Stream URL: http://" + WiFi.localIP().toString() + "/stream</p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

// ========================
// Setup
// ========================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== Second Mind Camera ===");

  // Init camera
  if (!init_camera()) {
    Serial.println("FATAL: Camera init failed. Check wiring and pin config.");
    while (1) delay(1000);  // halt
  }

  // Connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // disable WiFi power saving for stable streaming
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 40) {  // 20 second timeout
      Serial.println("\nFATAL: WiFi connection failed. Check SSID and password.");
      while (1) delay(1000);
    }
  }
  Serial.println();
  Serial.println("WiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Register endpoints
  server.on("/", handle_root);
  server.on("/stream", HTTP_GET, handle_stream);
  server.on("/frame", HTTP_GET, handle_frame);
  server.on("/status", HTTP_GET, handle_status);

  server.begin();
  Serial.println("\nServer started. Endpoints:");
  Serial.printf("  http://%s/        — preview page\n", WiFi.localIP().toString().c_str());
  Serial.printf("  http://%s/stream  — MJPEG stream\n", WiFi.localIP().toString().c_str());
  Serial.printf("  http://%s/frame   — single JPEG\n", WiFi.localIP().toString().c_str());
  Serial.printf("  http://%s/status  — health check\n", WiFi.localIP().toString().c_str());
  Serial.println("\nReady for Second Mind pipeline.");
}

// ========================
// Loop
// ========================
void loop() {
  server.handleClient();
}
