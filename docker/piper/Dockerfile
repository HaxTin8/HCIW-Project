FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --no-cache-dir "piper-tts[http]"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PIPER_DATA_DIR=/data/voices
ENV PIPER_PORT=5000
ENV PIPER_VOICES=en_US-lessac-medium
ENV PIPER_DEFAULT_VOICE=en_US-lessac-medium

VOLUME ["/data/voices"]

EXPOSE 5000

ENTRYPOINT ["/entrypoint.sh"]
