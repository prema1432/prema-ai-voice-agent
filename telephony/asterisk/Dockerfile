# Asterisk 20 LTS configured for ARI + PJSIP trunks.
# See telephony/README.md for trunk setup and security notes.
FROM debian:12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        asterisk asterisk-modules ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY configs/ /etc/asterisk/

EXPOSE 5060/udp 5060/tcp 8088/tcp 10000-20000/udp

CMD ["asterisk", "-f", "-U", "asterisk"]
