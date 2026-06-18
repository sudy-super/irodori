#!/usr/bin/env bash
# Cloudflare 側のリソース (D1 + R2) を作成し、worker/wrangler.toml の
# `database_id` を発行された値で自動置換するためのヘルパー。
#
# 前提:
#   - `npx wrangler login` を済ませていること
#   - Node.js + npm が PATH に通っていること
#
# 使い方 (リポジトリのルートで実行):
#   ./scripts/setup-cloudflare.sh
#
# 同じ名前の D1 / R2 が既に存在する場合はそのまま再利用しスキーマだけ流し直します。

set -euo pipefail

DB_NAME="${DB_NAME:-irodori}"
BUCKET_NAME="${BUCKET_NAME:-irodori-images}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER_TOML="${ROOT_DIR}/worker/wrangler.toml"
WRANGLER_TOML_EXAMPLE="${ROOT_DIR}/worker/wrangler.example.toml"

# wrangler.toml が無ければ example からコピーして初期化
if [ ! -f "${WRANGLER_TOML}" ]; then
  if [ ! -f "${WRANGLER_TOML_EXAMPLE}" ]; then
    echo "ERROR: ${WRANGLER_TOML_EXAMPLE} が見つかりません" >&2
    exit 1
  fi
  echo "[0/4] worker/wrangler.toml が無いので example からコピーします"
  cp "${WRANGLER_TOML_EXAMPLE}" "${WRANGLER_TOML}"
fi

cd "${ROOT_DIR}/worker"

echo "[1/4] D1 database '${DB_NAME}' を作成 (既存なら再利用)"
CREATE_OUTPUT=$(npx wrangler d1 create "${DB_NAME}" 2>&1 || true)

if echo "${CREATE_OUTPUT}" | grep -q "already exists"; then
  echo "  -> 既に存在するため info から ID を取得します"
  INFO_OUTPUT=$(npx wrangler d1 info "${DB_NAME}" 2>&1)
  DB_ID=$(echo "${INFO_OUTPUT}" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
else
  DB_ID=$(echo "${CREATE_OUTPUT}" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
fi

if [ -z "${DB_ID}" ]; then
  echo "ERROR: D1 database_id を取得できませんでした" >&2
  echo "${CREATE_OUTPUT}" >&2
  exit 1
fi
echo "  database_id = ${DB_ID}"

echo "[2/4] R2 bucket '${BUCKET_NAME}' を作成 (既存なら再利用)"
npx wrangler r2 bucket create "${BUCKET_NAME}" 2>&1 | sed 's/^/  /' || true

echo "[3/4] worker/wrangler.toml の database_id を書き換え"
# REPLACE_WITH_YOUR_D1_DATABASE_ID を発行された ID で置換 (BSD/GNU sed 両対応)
TMP="${WRANGLER_TOML}.tmp.$$"
awk -v id="${DB_ID}" '
  /database_id[[:space:]]*=/ { sub(/"[^"]*"/, "\"" id "\""); print; next }
  { print }
' "${WRANGLER_TOML}" > "${TMP}"
mv "${TMP}" "${WRANGLER_TOML}"

echo "[4/4] 本番 D1 にスキーマ適用 (schema.sql)"
npx wrangler d1 execute "${DB_NAME}" --remote --file=./schema.sql 2>&1 | sed 's/^/  /'

echo
echo "✅ セットアップ完了"
echo "   次は: npm run deploy"
