#!/bin/bash

# Test script for NewsAPI ingestion edge function
# Usage: ./test-ingest-newsapi.sh [SUPABASE_URL] [SERVICE_ROLE_KEY]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get credentials from args or env
SUPABASE_URL=${1:-$SUPABASE_URL}
SERVICE_ROLE_KEY=${2:-$SUPABASE_SERVICE_ROLE_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: Missing credentials${NC}"
  echo "Usage: ./test-ingest-newsapi.sh <SUPABASE_URL> <SERVICE_ROLE_KEY>"
  echo "   OR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars"
  exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/ingest_newsapi"

echo -e "${BLUE}Testing NewsAPI Ingestion Edge Function${NC}"
echo "URL: ${FUNCTION_URL}"
echo ""

# Test 1: Default (24h lookback, 50 articles)
echo -e "${GREEN}Test 1: Default ingestion (24h lookback, pageSize=50)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
  
  # Show metrics
  fetched=$(echo "$response" | jq -r '.fetched')
  stored=$(echo "$response" | jq -r '.stored')
  skipped=$(echo "$response" | jq -r '.skipped')
  filtered=$(echo "$response" | jq -r '.filtered')
  
  echo -e "${YELLOW}Metrics: Fetched=$fetched, Stored=$stored, Skipped=$skipped, Filtered=$filtered${NC}"
else
  echo -e "${RED}✗ Test 1 failed${NC}"
  exit 1
fi
echo ""

# Test 2: Custom pageSize (25 articles)
echo -e "${GREEN}Test 2: Custom pageSize (25 articles)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"pageSize": 25}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
  
  page_size=$(echo "$response" | jq -r '.page_size')
  if [ "$page_size" -eq 25 ]; then
    echo -e "${GREEN}✓ PageSize correctly set to 25${NC}"
  else
    echo -e "${YELLOW}⚠ PageSize mismatch: expected 25, got $page_size${NC}"
  fi
else
  echo -e "${RED}✗ Test 2 failed${NC}"
  exit 1
fi
echo ""

# Test 3: Custom query (hedge funds)
echo -e "${GREEN}Test 3: Custom query filter (hedge funds)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"q": "hedge fund", "pageSize": 20}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 3 passed${NC}"
else
  echo -e "${RED}✗ Test 3 failed${NC}"
  exit 1
fi
echo ""

# Test 4: Custom time range (48 hours)
echo -e "${GREEN}Test 4: Custom time range (48 hours)${NC}"
two_days_ago=$(date -u -v-2d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "2 days ago" +"%Y-%m-%dT%H:%M:%SZ")
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"since\": \"${two_days_ago}\", \"pageSize\": 30}")

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 4 passed${NC}"
  
  total_results=$(echo "$response" | jq -r '.total_results')
  echo -e "${YELLOW}Total available results from NewsAPI: $total_results${NC}"
else
  echo -e "${RED}✗ Test 4 failed${NC}"
  exit 1
fi
echo ""

echo -e "${GREEN}=== All tests passed! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Check ingest_runs table:"
echo "   SELECT * FROM ingest_runs WHERE source = 'newsapi' ORDER BY started_at DESC LIMIT 5;"
echo ""
echo "2. Compare article counts:"
echo "   SELECT "
echo "     CASE "
echo "       WHEN meta->>'gdelt_domain' IS NOT NULL THEN 'gdelt'"
echo "       WHEN meta->>'newsapi_source_id' IS NOT NULL THEN 'newsapi'"
echo "     END as source,"
echo "     COUNT(*) "
echo "   FROM articles "
echo "   GROUP BY source;"
echo ""
echo "3. View recent NewsAPI articles:"
echo "   SELECT id, source, title, published_at "
echo "   FROM articles "
echo "   WHERE meta->>'newsapi_source_id' IS NOT NULL "
echo "   ORDER BY created_at DESC "
echo "   LIMIT 10;"
echo ""
echo -e "${YELLOW}Rate Limit Warning:${NC}"
echo "You just made 4 API requests to NewsAPI."
echo "Free tier limit: 100 requests/day"
echo "Remaining: ~96 requests"

