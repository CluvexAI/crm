#!/bin/bash
# Cross-Device Multi-User Access Verification
# Tests that CRM is accessible from all devices with different user passwords

echo "🌐 Cross-Device Multi-User Access Verification"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER_URL="http://localhost:5001"
APP_URL="http://localhost:3000"

echo "📋 Quick Verification Steps"
echo ""

# 1. Check server is running
echo "${BLUE}1️⃣  Checking Server Status...${NC}"
if curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
    HEALTH=$(curl -s "$SERVER_URL/health")
    echo "   Health status: $(echo $HEALTH | grep -o '"status":"[^"]*"')"
else
    echo -e "${RED}✗ Server not responding${NC}"
    echo "   Start with: npm start"
    exit 1
fi

echo ""
echo "${BLUE}2️⃣  Checking Users in Backend...${NC}"
USERS=$(curl -s "$SERVER_URL/api/users")
if echo "$USERS" | grep -q "success"; then
    COUNT=$(echo "$USERS" | grep -o '"uuid"' | wc -l)
    echo -e "${GREEN}✓ Backend has $COUNT users${NC}"
else
    echo -e "${YELLOW}⚠ Could not fetch users${NC}"
fi

echo ""
echo "${BLUE}3️⃣  Verifying Password Hashing...${NC}"
# Check first user's password format
PASSWORD=$(echo "$USERS" | grep -o '\$2b\$[^"]*' | head -1)
if [ -n "$PASSWORD" ]; then
    echo -e "${GREEN}✓ Passwords are hashed (bcrypt)${NC}"
    echo "   Sample hash: ${PASSWORD:0:20}... (${#PASSWORD} chars)"
else
    echo -e "${YELLOW}⚠ Could not verify password format${NC}"
fi

echo ""
echo "${BLUE}4️⃣  Checking Audit Log...${NC}"
if [ -f "server/data/password_audit.json" ]; then
    AUDIT_COUNT=$(grep -o '"id"' server/data/password_audit.json 2>/dev/null | wc -l)
    if [ "$AUDIT_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Audit log has $AUDIT_COUNT entries${NC}"
    else
        echo -e "${YELLOW}⚠ Audit log exists but is empty${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Audit log file not found${NC}"
fi

echo ""
echo "${BLUE}5️⃣  Verifying API Endpoints...${NC}"

# Check password endpoints
endpoints=(
    "POST /api/users/:uuid/password/verify"
    "PUT /api/users/:uuid/password"
    "GET /api/auth/password-audit"
)

for endpoint in "${endpoints[@]}"; do
    echo -e "   ${YELLOW}Testing: $endpoint${NC}"
    # We can't fully test without valid UUID, but we can check if endpoint responds
    METHOD=$(echo $endpoint | cut -d' ' -f1)
    PATH=$(echo $endpoint | cut -d' ' -f2)
    
    # Just check that endpoint is reachable (will return error but not 404)
    if curl -s -X $METHOD "$SERVER_URL$PATH" 2>/dev/null | grep -q "success\|message\|error"; then
        echo -e "   ✓ Endpoint accessible"
    else
        echo -e "   ⚠ Could not verify"
    fi
done

echo ""
echo "${BLUE}6️⃣  Manual Testing Steps...${NC}"
echo ""
echo "Follow these steps to test cross-device access:"
echo ""
echo "▶ Device 1 (Laptop/Main Browser):"
echo "  1. Open $APP_URL"
echo "  2. Login as User 1 with their password"
echo "  3. Go to Profile → Change Password"
echo "  4. Change to new password"
echo "  5. Logout"
echo ""
echo "▶ Device 2 (Phone/Different Browser/Incognito):"
echo "  1. Open $APP_URL"
echo "  2. Try User 1 with OLD password → Should FAIL ✗"
echo "  3. Try User 1 with NEW password → Should SUCCEED ✓"
echo "  4. Try User 2 with their password → Should SUCCEED ✓"
echo "  5. Verify you see User 2's data (different from Device 1)"
echo ""
echo "▶ Device 1 (Back to Main):"
echo "  1. Try User 1 with NEW password → Should SUCCEED ✓"
echo "  2. Verify password change persisted"
echo ""

echo ""
echo "${BLUE}7️⃣  Backend File Checks...${NC}"
echo ""
echo "Run these commands to verify backend state:"
echo ""
echo -e "${YELLOW}Check user passwords are hashed:${NC}"
echo "  cat server/data/users.json | jq '.[] | {email, password: .password[0:20]} | first'"
echo ""
echo -e "${YELLOW}Check audit log entries:${NC}"
echo "  cat server/data/password_audit.json | jq '.[] | {userId, changeType, timestamp}' | head -5"
echo ""
echo -e "${YELLOW}Count total users:${NC}"
echo "  cat server/data/users.json | jq 'length'"
echo ""

echo ""
echo "=============================================="
echo "${GREEN}✅ Setup Verification Complete${NC}"
echo ""
echo "Next: Test on multiple devices using the steps above"
echo "Docs: See CROSS_DEVICE_MULTI_USER_TESTING.md for detailed scenarios"
echo ""
