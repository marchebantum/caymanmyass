#!/bin/bash

# Test script for entity extraction edge function
# Usage: ./test-extract-entities.sh [SUPABASE_URL] [SERVICE_ROLE_KEY]

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
  echo "Usage: ./test-extract-entities.sh <SUPABASE_URL> <SERVICE_ROLE_KEY>"
  echo "   OR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars"
  exit 1
fi

FUNCTION_URL="${SUPABASE_URL}/functions/v1/extract_entities"

echo -e "${BLUE}Testing Entity Extraction Edge Function${NC}"
echo "URL: ${FUNCTION_URL}"
echo ""

# Check for classified articles first
echo -e "${YELLOW}Checking for classified articles...${NC}"
echo ""

# Test 1: Default extraction (limit=100)
echo -e "${GREEN}Test 1: Default entity extraction (limit=100)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 1 passed${NC}"
  
  # Show metrics
  processed=$(echo "$response" | jq -r '.processed')
  linked=$(echo "$response" | jq -r '.linked')
  
  echo -e "${YELLOW}Metrics: Processed=$processed, Linked=$linked entities${NC}"
  
  if [ "$processed" -eq 0 ]; then
    echo -e "${YELLOW}⚠ No articles needing extraction. Run classification first.${NC}"
  fi
else
  echo -e "${RED}✗ Test 1 failed${NC}"
  exit 1
fi
echo ""

# Test 2: Small batch
echo -e "${GREEN}Test 2: Small batch (limit=10)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type": "application/json" \
  -d '{"limit": 10}')

echo "$response" | jq .

if echo "$response" | jq -e '.success == true' > /dev/null; then
  echo -e "${GREEN}✓ Test 2 passed${NC}"
else
  echo -e "${RED}✗ Test 2 failed${NC}"
  exit 1
fi
echo ""

# Test 3: Large batch
echo -e "${GREEN}Test 3: Larger batch (limit=50)${NC}"
response=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type": "application/json" \
  -d '{"limit": 50}')

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
echo "1. Check extracted entities:"
echo "   SELECT id, name, type, canonical_name"
echo "   FROM entities"
echo "   ORDER BY created_at DESC"
echo "   LIMIT 20;"
echo ""
echo "2. View article-entity links:"
echo "   SELECT "
echo "     a.id,"
echo "     a.title,"
echo "     e.name,"
echo "     e.type,"
echo "     ae.role"
echo "   FROM article_entities ae"
echo "   JOIN articles a ON ae.article_id = a.id"
echo "   JOIN entities e ON ae.entity_id = e.id"
echo "   ORDER BY a.created_at DESC"
echo "   LIMIT 20;"
echo ""
echo "3. Count entities by type:"
echo "   SELECT type, COUNT(*) "
echo "   FROM entities "
echo "   GROUP BY type "
echo "   ORDER BY COUNT(*) DESC;"
echo ""
echo "4. Top entities by article count:"
echo "   SELECT "
echo "     e.name,"
echo "     e.type,"
echo "     COUNT(ae.article_id) as article_count"
echo "   FROM entities e"
echo "   LEFT JOIN article_entities ae ON e.id = ae.entity_id"
echo "   GROUP BY e.id, e.name, e.type"
echo "   ORDER BY article_count DESC"
echo "   LIMIT 20;"

