#!/bin/bash

echo "🤖 Web Content Agent Plugin - Demo"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STRAPI_URL=${STRAPI_URL:-"http://localhost:1337"}
API_BASE="$STRAPI_URL/api/web-content-agent"

echo -e "${BLUE}Testing Strapi Web Content Agent at: $STRAPI_URL${NC}"
echo ""

# Function to test API endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_BASE$endpoint")
    fi
    
    # Extract HTTP status code (last line)
    http_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✅ Success ($http_code)${NC}"
        echo "$body" | python3 -m json.tool 2>/dev/null | head -10
        if [ $? -ne 0 ]; then
            echo "$body" | head -5
        fi
    else
        echo -e "${RED}❌ Failed ($http_code)${NC}"
        echo "$body" | head -3
    fi
    echo ""
}

# Test 1: Plugin Configuration
test_endpoint "GET" "/ai/config" "" "Plugin Configuration"

# Test 2: Available Content Types
test_endpoint "GET" "/content-types" "" "Available Content Types"

# Test 3: Content Generation
content_prompt='{
    "prompt": "Write a short article about the benefits of renewable energy",
    "contentType": "article",
    "targetAudience": "general"
}'
test_endpoint "POST" "/ai/generate" "$content_prompt" "Content Generation from Prompt"

# Test 4: Content Analysis
analysis_content='{
    "content": "Renewable energy is good for the environment. It helps reduce carbon emissions.",
    "contentType": "article"
}'
test_endpoint "POST" "/ai/suggestions" "$analysis_content" "Content Analysis and Suggestions"

echo -e "${BLUE}📝 Demo Complete!${NC}"
echo ""
echo "Key Features Demonstrated:"
echo "✨ AI-powered content generation from natural language prompts"
echo "📊 Content analysis with quality scoring and improvement suggestions"
echo "🎯 SEO optimization recommendations and automated improvements"
echo "🔧 Plugin configuration and content type discovery"
echo ""
echo "Next Steps:"
echo "1. Set your OpenAI API key: export OPENAI_API_KEY='your-api-key'"
echo "2. Start Strapi: cd launchpad/strapi && yarn develop"
echo "3. Visit the admin panel: http://localhost:1337/admin"
echo "4. Look for 'Web Content Agent' in the sidebar"
echo ""
echo -e "${GREEN}🚀 Ready to use AI-powered content optimization!${NC}"