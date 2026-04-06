#!/usr/bin/env bash
# На VPS: добавить /pingok-micro-standalone/ → 127.0.0.1:PORT (по умолчанию 5591).
set -e
CFG=/etc/nginx/sites-enabled/pingdepo.ru
PORT="${1:-5591}"
if [ ! -f "$CFG" ]; then echo "Нет $CFG"; exit 1; fi
if grep -q 'pingok-micro-standalone' "$CFG" 2>/dev/null; then echo "Уже есть pingok-micro-standalone"; exit 0; fi
cp -a "$CFG" "${CFG}.bak.pingok.$$"
python3 - "$CFG" "$PORT" <<'PY'
import sys
path, port = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
needle = "    location / {"
insert = f"""    location /pingok-micro-standalone/ {{
        proxy_pass http://127.0.0.1:{port}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

"""
if "pingok-micro-standalone" in text:
    raise SystemExit(0)
if needle not in text:
    raise SystemExit("pattern not found: " + repr(needle))
open(path, "w", encoding="utf-8").write(text.replace(needle, insert + needle, 1))
PY
nginx -t
systemctl reload nginx
echo "OK: /pingok-micro-standalone/ → 127.0.0.1:${PORT}"
