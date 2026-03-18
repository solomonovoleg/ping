#!/usr/bin/env bash
# Создание отдельной БД для PING MOOT на VPS (не трогает другие проекты).
# Запуск: sudo -u postgres ./deploy/create-db.sh
# Или: psql -U postgres -f deploy/create-db.sql

set -e
DB_NAME="${DB_NAME:-ping_moot}"
DB_USER="${DB_USER:-ping_moot}"
DB_PASSWORD="${DB_PASSWORD:?Задай DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

echo "БД ${DB_NAME} и пользователь ${DB_USER} созданы."
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
