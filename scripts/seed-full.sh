#!/usr/bin/env bash
#
# SnehaVrinda Kala - FULLY AUTOMATED seed script.
# Run:  bash scripts/seed-full.sh

set -euo pipefail

ADMIN_EMAIL="${ADMIN_EMAIL:-sneha@sainath.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-snehalovessainath143}"

DB_HOST="localhost"
DB_PORT="5432"
DB_USER="medusa"
DB_PASS="medusa"
DB_NAME="medusa"

export PGPASSWORD="$DB_PASS"

echo "Seeding SnehaVrinda Kala (fully automated)..."
echo ""

run_sql() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

echo "1/5 Creating INR region..."
REGION_ID=$(run_sql "
  INSERT INTO region (id, name, currency_code, tax_code, payment_providers, fulfillment_providers, created_at, updated_at)
  VALUES (gen_random_uuid(), 'India', 'inr', NULL, '["razorpay"]'::jsonb, '["shiprocket", "manual"]'::jsonb, now(), now())
  ON CONFLICT (currency_code) DO UPDATE
    SET name = EXCLUDED.name, updated_at = now()
  RETURNING id
")
echo "   Region INR: $REGION_ID"

echo ""
echo "2/5 Creating sales channel..."
CHANNEL_ID=$(run_sql "
  INSERT INTO sales_channel (id, name, description, is_active, created_at, updated_at)
  VALUES (gen_random_uuid(), 'SnehaVrinda Kala', 'Primary India sales channel', true, now(), now())
  RETURNING id
")
echo "   Sales channel: $CHANNEL_ID"

echo ""
echo "3/5 Linking region to sales channel..."
run_sql "
  INSERT INTO sales_channel_region (sales_channel_id, region_id, created_at, updated_at)
  VALUES ('$CHANNEL_ID', '$REGION_ID', now(), now())
  ON CONFLICT DO NOTHING
" > /dev/null
echo "   Linked region to sales channel"

echo ""
echo "4/5 Creating publishable API key..."
PUBLISHABLE_KEY=$(run_sql "
  INSERT INTO api_key (id, token, type, is_active, created_at, updated_at, sales_channel_id)
  VALUES (gen_random_uuid(), 'pk_test_snehavrinda_auto', 'publishable', true, now(), now(), '$CHANNEL_ID')
  RETURNING token
")
echo "   Publishable key: $PUBLISHABLE_KEY"

echo ""
echo "5/5 Creating admin customer account..."
PASSWORD_HASH=$(node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 10))")
run_sql "
  INSERT INTO customer (id, email, password_hash, created_at, updated_at)
  VALUES (gen_random_uuid(), '$ADMIN_EMAIL', '$PASSWORD_HASH', now(), now())
  ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash, updated_at = now()
  RETURNING id
" > /dev/null
echo "   Customer: $ADMIN_EMAIL"

echo ""
echo "============================================================"
echo "SEED COMPLETE"
echo "============================================================"
echo "Region ID:       $REGION_ID"
echo "Sales Channel:   $CHANNEL_ID"
echo "Publishable Key: $PUBLISHABLE_KEY"
echo "Admin Email:     $ADMIN_EMAIL"
echo "Admin Password:  $ADMIN_PASSWORD"
echo "============================================================"
echo ""
echo "STEP 1: Add to .env:"
echo ""
echo "  echo 'MEDUSA_PUBLISHABLE_KEY=$PUBLISHABLE_KEY' >> .env"
echo "  echo 'MEDUSA_REGION_ID=$REGION_ID' >> .env"
echo "  echo 'ADMIN_EMAILS=$ADMIN_EMAIL' >> .env"
echo "  echo 'ADMIN_PASSWORD=$ADMIN_PASSWORD' >> .env"
echo ""
echo "STEP 2: Restart storefront:"
echo ""
echo "  docker compose up -d --build storefront"
echo ""
echo "STEP 3: Login at:"
echo "  http://localhost:3000/admin/login"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
