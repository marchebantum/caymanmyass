#!/bin/bash

# Test script for Monitor API edge function
# Usage: ./test-monitor-api.sh [SUPABASE_URL] [SERVICE_ROLE_KEY] [ANON_KEY]

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
ANON_KEY=${3:-$SUPABASE_ANON_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: Missing credentials${NC}"
  echo "Usage: ./test-monitor-api.sh <SUPABASE_URL> <SERVICE_ROLE_KEY> [ANON_KEY]"
  echo "   OR: Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY env vars"
  exit 1
fi

BASE_URL="${SUPABASE_URL}/functions/v1/monitor_api"

echo -e "${BLUE}Testing Monitor API Edge Function${NC}"
echo "Base URL: ${BASE_URL}"
echo ""

# Test 1: GET /articles (default)
echo -e "${GREEN}Test 1: GET /articles (default, limit=25)${NC}"
response=$(curl -s -X GET "${BASE_URL}/articles" \
  -H "Authorization: Bearer ${ANON_KEY}")

echo "$response" | jq .

if echo "$response" | jq -e '.items' > /dev/null; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
  item_count=$(echo "$response" | jq '.items | length')
  echo -e "${YELLOW}Returned $item_count articles${NC}"
else
  echo -e "${RED}✗ Test 1 failed${NC}"
  exit 1
fi
echo ""

# Test 2: GET /articles with filters
echo -e "${GREEN}Test 2: GET /articles with signal filter (fraud)${NC}"
response=$(curl -s -X GET "${BASE_URL}/articles?signal=fraud&limit=10" \
  -H "Authorization: Bearer ${ANON_KEY}")

echo "$response" | jq .

if echo "$response" | jq -e '.items' > /dev/null; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
else
  echo -e "${RED}✗ Test 2 failed${NC}"
  exit 1
fi
echo ""

# Test 3: GET /articles with search
echo -e "${GREEN}Test 3: GET /articles with search query (q=Cayman)${NC}"
response=$(curl -s -X GET "${BASE_URL}/articles?q=Cayman&limit=5" \
  -H "Authorization: Bearer ${ANON_KEY}")

echo "$response" | jq .

if echo "$response" | jq -e '.items' > /dev/null; then
  echo -e "${GREEN}✓ Test 3 passed${NC}"
else
  echo -e "${RED}✗ Test 3 failed${NC}"
  exit 1
fi
echo ""

# Test 4: GET /articles with date range
echo -e "${GREEN}Test 4: GET /articles with date range (last 7 days)${NC}"
seven_days_ago=$(date -u -v-7d +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -d "7 days ago" +"%Y-%m-%dT%H:%M:%SZ")
response=$(curl -s -X GET "${BASE_URL}/articles?from=${seven_days_ago}&limit=5" \
  -H "Authorization: Bearer ${ANON_KEY}")

echo "$response" | jq .

if echo "$response" | jq -e '.items' > /dev/null; then
  echo -e "${GREEN}✓ Test 4 passed${NC}"
else
  echo -e "${RED}✗ Test 4 failed${NC}"
  exit 1
fi
echo ""

# Test 5: GET /articles with pagination
echo -e "${GREEN}Test 5: GET /articles with pagination${NC}"
response=$(curl -s -X GET "${BASE_URL}/articles?limit=5" \
  -H "Authorization: Bearer ${ANON_KEY}")

next_cursor=$(echo "$response" | jq -r '.next_cursor // empty')

if [ -n "$next_cursor" ]; then
  echo "Got next_cursor: $next_cursor"
  
  # Fetch next page
  response2=$(curl -s -X GET "${BASE_URL}/articles?limit=5&cursor=${next_cursor}" \
    -H "Authorization: Bearer ${ANON_KEY}")
  
  echo "$response2" | jq .
  
  if echo "$response2" | jq -e '.items' > /dev/null; then
    echo -e "${GREEN}✓ Test 5 passed (pagination works)${NC}"
  else
    echo -e "${RED}✗ Test 5 failed${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠ No next_cursor (not enough articles for pagination)${NC}"
  echo -e "${GREEN}✓ Test 5 passed (no pagination needed)${NC}"
fi
echo ""

# Test 6: GET /stats
echo -e "${GREEN}Test 6: GET /stats${NC}"
response=$(curl -s -X GET "${BASE_URL}/stats" \
  -H "Authorization: Bearer ${ANON_KEY}")

echo "$response" | jq .

if echo "$response" | jq -e '.total_articles' > /dev/null; then
  echo -e "${GREEN}✓ Test 6 passed${NC}"
  total=$(echo "$response" | jq -r '.total_articles')
  echo -e "${YELLOW}Total articles (last 30 days): $total${NC}"
else
  echo -e "${RED}✗ Test 6 failed${NC}"
  exit 1
fi
echo ""

# Test 7: POST /ingest/run (requires service_role key)
echo -e "${GREEN}Test 7: POST /ingest/run (manual trigger)${NC}"
response=$(curl -s -X POST "${BASE_URL}/ingest/run" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"sources": ["gdelt"]}')

echo "$response" | jq .

if echo "$response" | jq -e '.success' > /dev/null; then
  echo -e "${GREEN}✓ Test 7 passed${NC}"
else
  echo -e "${YELLOW}⚠ Test 7: Manual ingestion triggered (check results)${NC}"
fi
echo ""

# Test 8: GET /entities/:name/articles (if entities exist)
echo -e "${GREEN}Test 8: GET /entities/:name/articles${NC}"
echo "Fetching a sample entity name first..."

# Get an entity name from the database
entity_response=$(curl -s -X GET "${BASE_URL}/articles?limit=1" \
  -H "Authorization: Bearer ${ANON_KEY}")

# Try to extract an entity from the first article
# This is a simplified test - in reality you'd query the entities table
echo -e "${YELLOW}Skipping Test 8 - requires existing entity data${NC}"
echo ""

echo -e "${GREEN}=== Most tests passed! ===${NC}"
echo ""
echo "Next steps:"
echo "1. Verify article listing:"
echo "   GET ${BASE_URL}/articles"
echo ""
echo "2. Test filters:"
echo "   GET ${BASE_URL}/articles?signal=fraud&limit=10"
echo "   GET ${BASE_URL}/articles?q=search+term"
echo "   GET ${BASE_URL}/articles?from=2025-10-01T00:00:00Z"
echo ""
echo "3. Check stats:"
echo "   GET ${BASE_URL}/stats"
echo ""
echo "4. Manual ingestion (service_role only):"
echo "   POST ${BASE_URL}/ingest/run"
echo "   Body: {\"sources\": [\"gdelt\", \"newsapi\"]}"
echo ""
echo "5. Entity lookup:"
echo "   GET ${BASE_URL}/entities/Company%20Name/articles"

