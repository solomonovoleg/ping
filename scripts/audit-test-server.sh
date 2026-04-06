#!/usr/bin/env bash
# Аудит тестового контура на VPS после deploy:test.
# Читает deploy.env затем deploy.test.env (как deploy.sh), SSH: PM2, health, ключи .env, БД.
set -e
cd "$(dirname "$0")/.."
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy.test.env}"
DEPLOY_MERGE_WITH="${DEPLOY_MERGE_WITH:-deploy.env}"
load_deploy_env_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    line="${line#export }"
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
  done < "$f"
}
if [ ! -f "$DEPLOY_ENV_FILE" ]; then
  echo "Нет $DEPLOY_ENV_FILE"
  exit 1
fi
if [ -f "$DEPLOY_MERGE_WITH" ]; then
  load_deploy_env_file "$DEPLOY_MERGE_WITH"
fi
load_deploy_env_file "$DEPLOY_ENV_FILE"

export SSHPASS="${VPS_PASSWORD:-}"
REMOTE="${VPS_USER:-root}@${VPS_HOST:?VPS_HOST}"
REMOTE_DIR="${VPS_PATH:-/var/www/ping-moot-test}"

run_ssh() {
  if [ -n "${SSHPASS:-}" ] && command -v sshpass >/dev/null 2>&1; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new -T "$@"
  else
    ssh -o StrictHostKeyChecking=accept-new -T "$@"
  fi
}

echo "=== Аудит теста: $REMOTE_DIR на $REMOTE ==="

run_ssh "$REMOTE" "REMOTE_DIR='$REMOTE_DIR' bash -s" <<'AUDIT'
set -e
cd "$REMOTE_DIR" || { echo "Нет каталога $REMOTE_DIR"; exit 1; }
echo "--- PM2 (имена с test / pingok-micro-test) ---"
pm2 jlist 2>/dev/null | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const names=j.map(p=>p.name).filter(n=>/test|pingok-micro-test|parser-test|edge-test|feed-worker/i.test(n));
console.log(names.length?names.sort().join('\n'):'(нет совпадений по фильтру)');
" 2>/dev/null || pm2 list

echo "--- Чтение портов из .env ---"
get() { grep -E "^${1}=" .env 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^\"//;s/\"$//'; }
MAIN=$(get PORT); [ -z "$MAIN" ] && MAIN=5550
EDGE=$(get EDGE_PORT); [ -z "$EDGE" ] && EDGE=5592
PINGOK=$(get PINGOK_MICRO_PORT); [ -z "$PINGOK" ] && PINGOK=5591
PARSER=$(get PARSER_PORT); [ -z "$PARSER" ] && PARSER=5593
echo "PORT=$MAIN PINGOK_MICRO_PORT=$PINGOK EDGE_PORT=$EDGE PARSER_PORT=$PARSER"

echo "--- HTTP (localhost) ---"
code() { curl -sS -o /tmp/audit_body.$$ -w "%{http_code}" --max-time 5 "$1" || echo "err"; }
H1=$(code "http://127.0.0.1:${MAIN}/api/edge/health") || true
echo "platform /api/edge/health -> $H1"
H2=$(code "http://127.0.0.1:${EDGE}/v1/health") || true
echo "edge /v1/health -> $H2"
H3=$(code "http://127.0.0.1:${PARSER}/v1/health") || true
echo "parser /v1/health -> $H3"
H4=$(code "http://127.0.0.1:${PINGOK}/health") || true
echo "pingok /health -> $H4"
rm -f /tmp/audit_body.$$

echo "--- Ключи .env (имена, без значений) — критичные для микросервисов ---"
for k in DATABASE_URL EDGE_DATABASE_URL EDGE_UPSTREAM_URL EDGE_SERVICE_SECRET EDGE_PM2_ENABLED \
  PARSER_UPSTREAM_URL PARSER_PLATFORM_URL PARSER_SERVICE_SECRET PARSER_PM2_ENABLED \
  PINGOK_MICRO_PORT PINGOK_MICRO_PM2_ENABLED PINGOK_MICRO_CORS_ORIGIN \
  FEED_WORKER_PM2_ENABLED SESSION_SECURE SESSION_COOKIE_DOMAIN SESSION_MAX_AGE_DAYS \
  CORS_ALLOWED_ORIGINS CSRF_ALLOWED_ORIGINS PING_INVITE_APP_URL PLATFORM_PORT; do
  if grep -qE "^${k}=" .env 2>/dev/null; then
    echo "  OK $k"
  else
    echo "  MISS $k"
  fi
done

echo "--- PostgreSQL: таблицы public (платформа) ---"
DBURL=$(get DATABASE_URL)
if [ -n "$DBURL" ] && command -v psql >/dev/null 2>&1; then
  C=$(psql "$DBURL" -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo "?")
  echo "  public tables count: $C"
  psql "$DBURL" -tAc "select column_name from information_schema.columns where table_schema='public' and table_name='posts' and column_name='edge_display_audience'" 2>/dev/null | grep -q . && echo "  OK posts.edge_display_audience" || echo "  MISS posts.edge_display_audience"
else
  echo "  (psql или DATABASE_URL недоступны)"
fi

echo "--- PostgreSQL: EDGE ---"
EDB=$(get EDGE_DATABASE_URL)
if [ -n "$EDB" ] && command -v psql >/dev/null 2>&1; then
  EC=$(psql "$EDB" -tAc "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo "?")
  echo "  edge public tables count: $EC"
  psql "$EDB" -tAc "select 1 from information_schema.columns where table_schema='public' and table_name='edge_participants' and column_name='money_tracking_started_at'" 2>/dev/null | grep -q 1 && echo "  OK edge_participants.money_tracking_started_at (0006)" || echo "  MISS edge money column (EDGE/migrations/0006)"
else
  echo "  (EDGE_DATABASE_URL или psql недоступны)"
fi

echo "--- Готово ---"
AUDIT

echo "=== Локально: списки миграций (репо) ==="
echo -n "platform (строки в scripts/run-migrations.cjs): "
grep -cE '^\s*"scripts/migrate-' scripts/run-migrations.cjs || echo 0
echo -n "EDGE *.sql: "
ls -1 EDGE/migrations/*.sql 2>/dev/null | wc -l | tr -d ' '
echo -n "PARSER *.sql: "
ls -1 PARSER/migrations/*.sql 2>/dev/null | wc -l | tr -d ' '
