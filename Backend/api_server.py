from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from query_agent import QueryAgent
from memory_logger import MemoryLogger
from video_capture import VideoCapture
from audio_capture import AudioCapture
from transcriber import Transcriber
from voice_output import VoiceOutput
from config import ELEVENLABS_VOICE_ID

app = Flask(__name__)
CORS(app)

# These get set by main.py before the server starts
query_agent: QueryAgent = None
memory_logger: MemoryLogger = None
video_capture: VideoCapture = None
audio_capture: AudioCapture = None
transcriber: Transcriber = None
voice_output: VoiceOutput = None


def init_app(qa, ml, vc, ac, tr, vo):
    global query_agent, memory_logger, video_capture, audio_capture, transcriber, voice_output
    query_agent = qa
    memory_logger = ml
    video_capture = vc
    audio_capture = ac
    transcriber = tr
    voice_output = vo


@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"error": "No audio provided"}), 400
    text = transcriber.transcribe_bytes(audio.read(), audio.filename or "audio.webm")
    return jsonify({"text": text})


@app.route("/clone-voice", methods=["POST"])
def clone_voice():
    import requests as req_lib
    from config import ELEVENLABS_API_KEY
    name = request.form.get("name", "My Voice")
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "No audio files provided"}), 400
    multipart = [("files", (f.filename, f.read(), f.content_type or "audio/webm")) for f in files]
    try:
        resp = req_lib.post(
            "https://api.elevenlabs.io/v1/voices/add",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            data={"name": name, "description": "Cloned via Recall"},
            files=multipart,
        )
        data = resp.json()
        if not resp.ok:
            return jsonify({"error": data.get("detail", {}).get("message", "Clone failed")}), resp.status_code
        return jsonify({"voice_id": data["voice_id"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/set-voice", methods=["POST"])
def set_voice():
    import re, os
    data = request.get_json()
    voice_id = (data.get("voice_id") or "").strip()
    if not voice_id:
        return jsonify({"error": "No voice_id"}), 400
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.py")
    try:
        with open(config_path, "r") as f:
            content = f.read()
        content = re.sub(
            r'ELEVENLABS_VOICE_ID\s*=\s*"[^"]*"',
            f'ELEVENLABS_VOICE_ID = "{voice_id}"',
            content,
        )
        with open(config_path, "w") as f:
            f.write(content)
    except Exception as e:
        return jsonify({"error": f"Could not update config: {e}"}), 500
    if voice_output:
        voice_output.set_voice_id(voice_id)
    return jsonify({"success": True})


@app.route("/tts", methods=["POST"])
def tts():
    data = request.get_json()
    text = data.get("text", "")
    if not text:
        return jsonify({"error": "No text"}), 400
    try:
        audio_gen = voice_output.client.text_to_speech.convert(
            voice_id=getattr(voice_output, "_voice_id", ELEVENLABS_VOICE_ID),
            text=text,
            model_id="eleven_turbo_v2",
        )
        audio_bytes = b"".join(audio_gen)
        return Response(audio_bytes, mimetype="audio/mpeg")
    except Exception as e:
        print(f"[TTS] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/query", methods=["POST"])
def query():
    data = request.get_json()
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "No question provided"}), 400
    answer = query_agent.answer(question)
    return jsonify({"answer": answer})


@app.route("/memories", methods=["GET"])
def memories():
    recent = memory_logger.get_recent_memories()
    return jsonify({"memories": recent})


@app.route("/frame", methods=["GET"])
def frame():
    import cv2
    import numpy as np
    f = video_capture.get_latest_frame() if video_capture else None
    if f is None:
        return jsonify({"error": "No frame available"}), 503
    _, buf = cv2.imencode(".jpg", f)
    return Response(buf.tobytes(), mimetype="image/jpeg")


@app.route("/transcript", methods=["GET"])
def transcript():
    import urllib.request, json as _json, time as _time
    from config import ESP32_WROOM_TRANSCRIPT_URL
    try:
        with urllib.request.urlopen(ESP32_WROOM_TRANSCRIPT_URL, timeout=2) as resp:
            return jsonify(_json.loads(resp.read().decode()))
    except Exception:
        return jsonify({"text": "", "timestamp": _time.time()})


@app.route("/status", methods=["GET"])
def status():
    return jsonify({
        "camera_connected": video_capture.is_connected if video_capture else False,
        "mic_connected": audio_capture.is_connected if audio_capture else False,
        "memory_count": memory_logger.get_memory_count() if memory_logger else 0,
        "pipeline_active": True,
    })


def run_server(port=8000):
    app.run(host="0.0.0.0", port=port, threaded=True)
