#!/bin/sh
set -eu

DATA_DIR="${PIPER_DATA_DIR:-/data/voices}"
PORT="${PIPER_PORT:-5000}"
VOICES_RAW="${PIPER_VOICES:-en_US-lessac-medium}"
DEFAULT_VOICE="${PIPER_DEFAULT_VOICE:-en_US-lessac-medium}"

mkdir -p "$DATA_DIR"

OLD_IFS="$IFS"
IFS=','
set -- $VOICES_RAW
IFS="$OLD_IFS"

for voice in "$@"; do
  trimmed="$(echo "$voice" | xargs)"
  if [ -n "$trimmed" ]; then
    echo "[Piper] Downloading voice: $trimmed"
    python3 -m piper.download_voices --data-dir "$DATA_DIR" "$trimmed"
  fi
done

echo "[Piper] Starting HTTP server on port $PORT with default voice $DEFAULT_VOICE"
exec python3 -m piper.http_server \
  --host 0.0.0.0 \
  --port "$PORT" \
  --data-dir "$DATA_DIR" \
  -m "$DEFAULT_VOICE"
