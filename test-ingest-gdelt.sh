#!/bin/bash

# Test script for GDELT ingestion edge function
# Usage: ./test-ingest-gdelt.sh [SUPABASE_URL] [SERVICE_ROLE_KEY]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get credentials from args or env
SUPABASE_URL=${1:-$SUPABASE_URL}
SERVICE_ROLE_KEY=${2:-$SUPABASE_SERVICE_ROLE_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: Missing credentials${NC}"
  echo "Usage: ./test-ingest-gdelt.sh <SUPABASE_URL> <SERVICE_ROLE_KEY>"
  echo "   OR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars"
  exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/ingest_gdelt"

echo -e "${BLUE}Testing GDELT Ingestion Edge Function${NC}"
echo "URL: ${FUNCTION_URL}"
echo ""

# Test 1: Default (24h lookback)
echo -e "${GREEN}Test 1: Default ingestion (24h lookback)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
else
  echo -e "${RED}✗ Test 1 failed${NC}"
  exit 1
fi
echo ""

# Test 2: Custom time range (7 days)
echo -e "${GREEN}Test 2: Custom time range (7 days)${NC}"
seven_days_ago=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "7 days ago" +"%Y-%m-%dT%H:%M:%SZ")
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"since\": \"${seven_days_ago}\"}")

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
else
  echo -e "${RED}✗ Test 2 failed${NC}"
  exit 1
fi
echo ""

# Test 3: Custom query
echo -e "${GREEN}Test 3: Custom query filter${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"q": "hedge fund"}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 3 passed${NC}"
else
  echo -e "${RED}✗ Test 3 failed${NC}"
  exit 1
fi
echo ""

echo -e "${GREEN}=== All tests passed! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Check ingest_runs table:"
echo "   SELECT * FROM ingest_runs WHERE source = 'gdelt' ORDER BY started_at DESC LIMIT 5;"
echo ""
echo "2. Check stored articles:"
echo "   SELECT COUNT(*) FROM articles;"
echo ""
echo "3. View recent articles:"
echo "   SELECT id, source, title, published_at FROM articles ORDER BY created_at DESC LIMIT 10;"

