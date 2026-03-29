#include <WiFi.h>
#include <driver/i2s.h>

// ==================== CONFIG ====================
const char* ssid       = "NETWORKNAME";
const char* password   = "PASSWORD";
const char* serverIP   = "YOUR_LAPTOP_IP";  // e.g., "172.20.10.2"
const uint16_t serverPort = 5001;

// ==================== I2S PINS (INMP441) ====================
#define I2S_SCK  14   // Serial Clock
#define I2S_WS   15   // Word Select (LR Clock)
#define I2S_SD   32   // Serial Data

// ==================== I2S CONFIG ====================
#define SAMPLE_RATE     16000
#define I2S_PORT        I2S_NUM_0
#define DMA_BUF_COUNT   8
#define DMA_BUF_LEN     1024

WiFiClient client;
int32_t rawSamples[DMA_BUF_LEN];

void initI2S() {
  i2s_config_t i2s_config = {
    .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate          = SAMPLE_RATE,
    .bits_per_sample      = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format       = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count        = DMA_BUF_COUNT,
    .dma_buf_len          = DMA_BUF_LEN,
    .use_apll             = false,
    .tx_desc_auto_clear   = false,
    .fixed_mclk           = 0
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num   = I2S_SCK,
    .ws_io_num    = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num  = I2S_SD
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("I2S driver install failed: %d\n", err);
    ESP.restart();
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("I2S set pin failed: %d\n", err);
    ESP.restart();
  }

  Serial.println("I2S initialized");
}

bool connectToServer() {
  Serial.printf("Connecting to %s:%d...\n", serverIP, serverPort);
  if (client.connect(serverIP, serverPort)) {
    Serial.println("Connected to server");
    return true;
  }
  Serial.println("Connection failed");
  return false;
}

void setup() {
  Serial.begin(115200);
  Serial.println("Starting audio stream...");

  initI2S();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  while (!connectToServer()) {
    delay(2000);
  }
}

void loop() {
  if (!client.connected()) {
    Serial.println("Disconnected from server, reconnecting...");
    client.stop();
    while (!connectToServer()) {
      delay(2000);
    }
  }

  size_t bytesRead = 0;
  esp_err_t err = i2s_read(I2S_PORT, rawSamples, sizeof(rawSamples), &bytesRead, portMAX_DELAY);

  if (err != ESP_OK || bytesRead == 0) return;

  // Convert 32-bit I2S samples to 16-bit PCM
  int samplesRead = bytesRead / 4;
  int16_t pcmBuffer[DMA_BUF_LEN];

  for (int i = 0; i < samplesRead; i++) {
    pcmBuffer[i] = (int16_t)(rawSamples[i] >> 16);
  }

  size_t pcmBytes = samplesRead * sizeof(int16_t);
  size_t written = client.write((uint8_t*)pcmBuffer, pcmBytes);

  if (written == 0) {
    Serial.println("Write failed");
  }
}
