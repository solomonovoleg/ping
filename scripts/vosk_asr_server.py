#!/usr/bin/env python3
import base64
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from subprocess import run
from wave import open as wave_open

from vosk import KaldiRecognizer, Model

HOST = os.environ.get("VOSK_ASR_HOST", "127.0.0.1")
PORT = int(os.environ.get("VOSK_ASR_PORT", "8099"))
MODEL_DIR = os.environ.get("VOSK_MODEL_DIR", "/opt/ping-moot/vosk-model-small-ru")
API_KEY = os.environ.get("CALL_TRANSCRIPTS_ASR_API_KEY", "").strip()

if not os.path.isdir(MODEL_DIR):
    raise SystemExit(f"Vosk model not found: {MODEL_DIR}")

MODEL = Model(MODEL_DIR)


def decode_to_wav(raw_audio: bytes, suffix: str) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as src:
        src.write(raw_audio)
        src_path = src.name
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as dst:
        dst_path = dst.name
    try:
        result = run(
            ["ffmpeg", "-y", "-i", src_path, "-ac", "1", "-ar", "16000", dst_path],
            capture_output=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode("utf-8", "ignore")[:400] or "ffmpeg failed")
        with open(dst_path, "rb") as f:
            return f.read()
    finally:
        for path in (src_path, dst_path):
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass


def transcribe_wav(wav_bytes: bytes, language: str) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        path = f.name
    try:
        with wave_open(path, "rb") as wf:
            rec = KaldiRecognizer(MODEL, wf.getframerate())
            rec.SetWords(True)
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                rec.AcceptWaveform(data)
            final_raw = json.loads(rec.FinalResult() or "{}")
            text = str(final_raw.get("text", "")).strip()
            if not text:
                return {"text": "", "confidence": 0, "language": language}
            confs = [float(w.get("conf", 0.0)) for w in final_raw.get("result", []) if isinstance(w, dict)]
            confidence = round((sum(confs) / len(confs)) * 100) if confs else 82
            return {"text": text, "confidence": confidence, "language": language}
    finally:
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self) -> None:
        if self.path != "/transcribe":
            self._json(404, {"message": "Not found"})
            return
        if API_KEY:
            auth = self.headers.get("Authorization", "")
            if auth != f"Bearer {API_KEY}":
                self._json(401, {"message": "Unauthorized"})
                return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            audio_b64 = str(data.get("audioBase64", "")).strip()
            if not audio_b64:
                self._json(400, {"message": "audioBase64 required"})
                return
            mime = str(data.get("mimeType", "audio/webm")).strip()
            language = str(data.get("language", "ru-RU")).strip() or "ru-RU"
            raw_audio = base64.b64decode(audio_b64)
            suffix = ".webm" if "webm" in mime else ".bin"
            wav = decode_to_wav(raw_audio, suffix)
            self._json(200, transcribe_wav(wav, language))
        except Exception as e:
            self._json(500, {"message": str(e)[:500]})


if __name__ == "__main__":
    server = HTTPServer((HOST, PORT), Handler)
    print(f"[vosk-asr] listening on http://{HOST}:{PORT}/transcribe using model {MODEL_DIR}")
    server.serve_forever()
