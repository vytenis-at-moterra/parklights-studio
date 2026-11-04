#!/bin/sh
# Parklights Studija -> Cloudflare. Paleisti: ./deploy.sh
set -e
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
npx --yes wrangler@4 deploy
