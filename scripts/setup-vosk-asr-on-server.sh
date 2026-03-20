#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_DIR="${VOSK_INSTALL_DIR:-/opt/ping-moot-vosk}"
MODEL_DIR="${VOSK_MODEL_DIR:-/opt/ping-moot/vosk-model-small-ru}"
MODEL_URL="${VOSK_MODEL_URL:-https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip}"
PORT="${VOSK_ASR_PORT:-8099}"
STREAM_PORT="${VOSK_ASR_STREAM_PORT:-8100}"

echo "=== setup Vosk ASR ==="
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip ffmpeg unzip curl

mkdir -p "$INSTALL_DIR"
python3 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install vosk websockets

mkdir -p "$(dirname "$MODEL_DIR")"
if [ ! -d "$MODEL_DIR" ]; then
  TMP_ZIP="/tmp/vosk-model-small-ru.zip"
  TMP_DIR="/tmp/vosk-model-small-ru-unpack"
  rm -rf "$TMP_DIR"
  mkdir -p "$TMP_DIR"
  curl -L "$MODEL_URL" -o "$TMP_ZIP"
  unzip -q "$TMP_ZIP" -d "$TMP_DIR"
  FOUND_DIR="$(find "$TMP_DIR" -maxdepth 1 -type d | grep 'vosk-model' | head -n 1)"
  if [ -z "$FOUND_DIR" ]; then
    echo "Не удалось распаковать модель Vosk"
    exit 1
  fi
  mv "$FOUND_DIR" "$MODEL_DIR"
  rm -f "$TMP_ZIP"
  rm -rf "$TMP_DIR"
fi

mkdir -p /etc/systemd/system
cat >/etc/systemd/system/ping-moot-vosk.service <<EOF
[Unit]
Description=PING MOOT Vosk ASR
After=network.target

[Service]
WorkingDirectory=$ROOT_DIR
Environment=VOSK_ASR_HOST=127.0.0.1
Environment=VOSK_ASR_PORT=$PORT
Environment=VOSK_MODEL_DIR=$MODEL_DIR
Environment=CALL_TRANSCRIPTS_ASR_API_KEY=${CALL_TRANSCRIPTS_ASR_API_KEY:-}
ExecStart=$INSTALL_DIR/.venv/bin/python $ROOT_DIR/scripts/vosk_asr_server.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/ping-moot-vosk-stream.service <<EOF
[Unit]
Description=PING MOOT Vosk ASR Stream
After=network.target

[Service]
WorkingDirectory=$ROOT_DIR
Environment=VOSK_ASR_STREAM_HOST=127.0.0.1
Environment=VOSK_ASR_STREAM_PORT=$STREAM_PORT
Environment=VOSK_MODEL_DIR=$MODEL_DIR
Environment=CALL_TRANSCRIPTS_ASR_API_KEY=${CALL_TRANSCRIPTS_ASR_API_KEY:-}
ExecStart=$INSTALL_DIR/.venv/bin/python $ROOT_DIR/scripts/vosk_asr_stream_server.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ping-moot-vosk
systemctl restart ping-moot-vosk
systemctl --no-pager --full status ping-moot-vosk || true
systemctl enable ping-moot-vosk-stream
systemctl restart ping-moot-vosk-stream
systemctl --no-pager --full status ping-moot-vosk-stream || true

echo ""
echo "Vosk ASR поднят на http://127.0.0.1:$PORT/transcribe"
echo "Vosk ASR stream поднят на ws://127.0.0.1:$STREAM_PORT/stream"
echo "Проверь: journalctl -u ping-moot-vosk -n 50 --no-pager"
