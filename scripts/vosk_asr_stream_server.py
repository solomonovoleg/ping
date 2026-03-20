#!/usr/bin/env python3
import asyncio
import base64
import json
import os

from vosk import KaldiRecognizer, Model
from websockets.asyncio.server import serve

HOST = os.environ.get("VOSK_ASR_STREAM_HOST", "127.0.0.1")
PORT = int(os.environ.get("VOSK_ASR_STREAM_PORT", "8100"))
MODEL_DIR = os.environ.get("VOSK_MODEL_DIR", "/opt/ping-moot/vosk-model-small-ru")
API_KEY = os.environ.get("CALL_TRANSCRIPTS_ASR_API_KEY", "").strip()

if not os.path.isdir(MODEL_DIR):
    raise SystemExit(f"Vosk model not found: {MODEL_DIR}")

MODEL = Model(MODEL_DIR)


def ws_ok(path: str, auth: str | None) -> bool:
    if path != "/stream":
        return False
    if not API_KEY:
        return True
    return auth == f"Bearer {API_KEY}"


async def handler(ws):
    if not ws_ok(getattr(ws.request, "path", ""), ws.request.headers.get("Authorization")):
        await ws.close(code=4401, reason="Unauthorized")
        return

    recognizer = KaldiRecognizer(MODEL, 16000)
    recognizer.SetWords(True)

    async for raw in ws:
        try:
            payload = json.loads(raw)
            msg_type = str(payload.get("type", ""))
            if msg_type == "config":
                continue
            if msg_type == "audio":
                audio_b64 = str(payload.get("audioBase64", "")).strip()
                if not audio_b64:
                    continue
                chunk = base64.b64decode(audio_b64)
                is_final = recognizer.AcceptWaveform(chunk)
                if is_final:
                    final_raw = json.loads(recognizer.Result() or "{}")
                    text = str(final_raw.get("text", "")).strip()
                    if text:
                        confs = [float(w.get("conf", 0.0)) for w in final_raw.get("result", []) if isinstance(w, dict)]
                        confidence = round((sum(confs) / len(confs)) * 100) if confs else 82
                        await ws.send(json.dumps({"type": "final", "text": text, "confidence": confidence}))
                else:
                    partial_raw = json.loads(recognizer.PartialResult() or "{}")
                    text = str(partial_raw.get("partial", "")).strip()
                    if text:
                        await ws.send(json.dumps({"type": "partial", "text": text, "confidence": 0}))
                continue
            if msg_type == "eof":
                final_raw = json.loads(recognizer.FinalResult() or "{}")
                text = str(final_raw.get("text", "")).strip()
                if text:
                    confs = [float(w.get("conf", 0.0)) for w in final_raw.get("result", []) if isinstance(w, dict)]
                    confidence = round((sum(confs) / len(confs)) * 100) if confs else 82
                    await ws.send(json.dumps({"type": "final", "text": text, "confidence": confidence}))
                await ws.close()
                return
        except Exception as e:
            await ws.send(json.dumps({"type": "error", "message": str(e)[:400]}))


async def main():
    async with serve(handler, HOST, PORT, max_size=2**22):
        print(f"[vosk-asr-stream] listening on ws://{HOST}:{PORT}/stream using model {MODEL_DIR}")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
