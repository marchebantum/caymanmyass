#!/bin/bash

# Test script for article classification edge function
# Usage: ./test-classify-articles.sh [SUPABASE_URL] [SERVICE_ROLE_KEY]

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
  echo "Usage: ./test-classify-articles.sh <SUPABASE_URL> <SERVICE_ROLE_KEY>"
  echo "   OR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars"
  exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/classify_articles"

echo -e "${BLUE}Testing Article Classification Edge Function${NC}"
echo "URL: ${FUNCTION_URL}"
echo ""

# Check for unclassified articles first
echo -e "${YELLOW}Checking for unclassified articles...${NC}"
echo ""

# Test 1: Small batch (default settings)
echo -e "${GREEN}Test 1: Default classification (limit=50, batch_size=12)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
  
  # Show metrics
  processed=$(echo "$response" | jq -r '.processed')
  updated=$(echo "$response" | jq -r '.updated')
  skipped=$(echo "$response" | jq -r '.skipped')
  
  echo -e "${YELLOW}Metrics: Processed=$processed, Updated=$updated, Skipped=$skipped${NC}"
  
  if [ "$processed" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No unclassified articles found. Run ingestion first.${NC}"
  fi
else
  echo -e "${RED}✗ Test 1 failed${NC}"
  exit 1
fi
echo ""

# Test 2: Small limit
echo -e "${GREEN}Test 2: Small batch (limit=10, batch_size=5)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type": "application/json" \
  -d '{"limit": 10, "batch_size": 5}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
else
  echo -e "${RED}✗ Test 2 failed${NC}"
  exit 1
fi
echo ""

# Test 3: Large batch
echo -e "${GREEN}Test 3: Larger batch (limit=20, batch_size=16)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type": "application/json" \
  -d '{"limit": 20, "batch_size": 16}')

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
echo "1. Check classified articles:"
echo "   SELECT id, source, title, cayman_flag, confidence, signals"
echo "   FROM articles"
echo "   WHERE cayman_flag IS NOT NULL"
echo "   ORDER BY created_at DESC"
echo "   LIMIT 10;"
echo ""
echo "2. View Cayman-relevant articles:"
echo "   SELECT id, source, title, confidence, reasons"
echo "   FROM articles"
echo "   WHERE cayman_flag = true"
echo "   ORDER BY confidence DESC;"
echo ""
echo "3. Count by signal:"
echo "   SELECT"
echo "     COUNT(*) FILTER (WHERE (signals->>'fraud')::boolean) as fraud,"
echo "     COUNT(*) FILTER (WHERE (signals->>'financial_decline')::boolean) as financial_decline,"
echo "     COUNT(*) FILTER (WHERE (signals->>'enforcement')::boolean) as enforcement"
echo "   FROM articles"
echo "   WHERE cayman_flag = true;"
echo ""
echo -e "${YELLOW}Cost Note:${NC}"
echo "Each classification batch costs approximately:"
echo "- OpenAI GPT-4o-mini: ~\$0.001 per article"
echo "- Anthropic Claude: ~\$0.003 per article"

