#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Shopify Integration Test Setup${NC}\n"

# 1. Check database connection
echo "1️⃣  Testing database connection..."
if psql -U postgres -d shopify_ai_support -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connected${NC}"
else
    echo -e "${RED}❌ Database not accessible${NC}"
    exit 1
fi

# 2. Check tables exist
echo ""
echo "2️⃣  Checking database tables..."
TABLES=$(psql -U postgres -d shopify_ai_support -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")
if [ "$TABLES" -ge 5 ]; then
    echo -e "${GREEN}✅ All tables created ($TABLES tables found)${NC}"
    psql -U postgres -d shopify_ai_support -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" | sed 's/^/   - /'
else
    echo -e "${RED}❌ Missing tables (found $TABLES, expected 5+)${NC}"
    exit 1
fi

# 3. Check .env file
echo ""
echo "3️⃣  Checking environment variables..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"

    # Check critical variables
    VARS=("SHOPIFY_API_KEY" "SHOPIFY_API_SECRET" "TOKEN_ENCRYPTION_KEY" "APP_URL" "GEMINI_API_KEY")
    for var in "${VARS[@]}"; do
        if grep -q "$var=" .env; then
            VALUE=$(grep "$var=" .env | cut -d'=' -f2)
            if [ ! -z "$VALUE" ]; then
                echo -e "${GREEN}   ✅ $var${NC}"
            else
                echo -e "${RED}   ❌ $var is empty${NC}"
            fi
        else
            echo -e "${RED}   ❌ $var missing${NC}"
        fi
    done
else
    echo -e "${RED}❌ .env file not found${NC}"
    exit 1
fi

# 4. Verify TOKEN_ENCRYPTION_KEY format
echo ""
echo "4️⃣  Validating TOKEN_ENCRYPTION_KEY format..."
KEY_LENGTH=$(grep "TOKEN_ENCRYPTION_KEY=" .env | cut -d'=' -f2 | wc -c)
if [ "$KEY_LENGTH" -eq 65 ]; then  # 64 hex + newline
    echo -e "${GREEN}✅ TOKEN_ENCRYPTION_KEY is 64 hex characters${NC}"
else
    echo -e "${YELLOW}⚠️  TOKEN_ENCRYPTION_KEY length: $((KEY_LENGTH-1)) chars (expected 64)${NC}"
fi

# 5. Check Node modules
echo ""
echo "5️⃣  Checking dependencies..."
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️  Running npm install...${NC}"
    npm install
fi

# 6. Verify main files exist
echo ""
echo "6️⃣  Checking essential files..."
FILES=("index.js" "src/routes/shopify.js" "src/routes/webhooks.js" "src/middleware/validateWebhookSignature.js" "src/utils/tokenEncryption.js")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✅ $file${NC}"
    else
        echo -e "${RED}   ❌ $file missing${NC}"
    fi
done

echo ""
echo -e "${GREEN}✅ Setup verification complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. npm start        # Start the backend"
echo "2. curl http://localhost:3000/health   # Test server"
echo "3. Follow TESTING_GUIDE.md for OAuth and webhook testing"
