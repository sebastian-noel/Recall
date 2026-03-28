from flask import Flask, request, jsonify
from flask_cors import CORS
from query_agent import QueryAgent
from memory_logger import MemoryLogger
from video_capture import VideoCapture
from audio_capture import AudioCapture

app = Flask(__name__)
CORS(app)

# These get set by main.py before the server starts
query_agent: QueryAgent = None
memory_logger: MemoryLogger = None
video_capture: VideoCapture = None
audio_capture: AudioCapture = None


def init_app(qa, ml, vc, ac):
    global query_agent, memory_logger, video_capture, audio_capture
    query_agent = qa
    memory_logger = ml
    video_capture = vc
    audio_capture = ac


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
