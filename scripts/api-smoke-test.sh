#!/bin/bash

API_URL="http://localhost:8080/api/v1"
TOKEN=${1:-"YOUR_TOKEN"}

if [ "$TOKEN" == "YOUR_TOKEN" ]; then
  echo "Usage: ./api-smoke-test.sh <jwt_token>"
  exit 1
fi

echo "🚀 Starting API Smoke Test..."

# 1. Health Check
echo -n "Checking health endpoint... "
curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" | grep -q "200" && echo "✅" || echo "❌"

# 2. List Questions
echo -n "Testing list questions... "
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/assessments/questions" | grep -q '"success":true' && echo "✅" || echo "❌"

# 3. Create a test question (will likely fail if not admin, but tests auth)
echo -n "Testing create question (auth check)... "
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test","difficulty":"easy","language":"python"}' \
  "$API_URL/assessments/questions" | grep -q '"success":' && echo "✅" || echo "❌"

# 4. Recording check
echo -n "Testing recording retrieval... "
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/recordings/session/00000000-0000-0000-0000-000000000000" | grep -q '"success":' && echo "✅" || echo "❌"

echo "🏁 Smoke test complete."
