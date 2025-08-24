#!/bin/bash

# Test script for local development
# Run with: bash test-local.sh

API_URL="http://localhost:8787"
TEST_DOMAIN="test.local"  # This should match your MAIL_DOMAIN in wrangler.toml
TEST_EMAIL="testuser@${TEST_DOMAIN}"
TEST_PASSWORD="testpass123"

echo "🧪 Testing Duckmail Cloudflare Provider"
echo "======================================="

# Test 1: Get domains
echo -e "\n1. Testing GET /domains..."
curl -s "${API_URL}/domains" | jq .

# Test 2: Create account
echo -e "\n2. Testing POST /accounts..."
ACCOUNT_RESPONSE=$(curl -s -X POST "${API_URL}/accounts" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"${TEST_EMAIL}\", \"password\": \"${TEST_PASSWORD}\"}")
echo "$ACCOUNT_RESPONSE" | jq .

# Test 3: Get token
echo -e "\n3. Testing POST /token..."
TOKEN_RESPONSE=$(curl -s -X POST "${API_URL}/token" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"${TEST_EMAIL}\", \"password\": \"${TEST_PASSWORD}\"}")
echo "$TOKEN_RESPONSE" | jq .

# Extract token
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r .token)

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo -e "\n✅ Token obtained successfully"
  
  # Test 4: Get account info
  echo -e "\n4. Testing GET /me..."
  curl -s "${API_URL}/me" \
    -H "Authorization: Bearer ${TOKEN}" | jq .
  
  # Test 5: Get messages
  echo -e "\n5. Testing GET /messages..."
  curl -s "${API_URL}/messages" \
    -H "Authorization: Bearer ${TOKEN}" | jq .
  
  echo -e "\n✅ All tests completed!"
else
  echo -e "\n❌ Failed to obtain token"
fi 