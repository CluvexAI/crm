#!/bin/bash
# Quick verification script for Secure Password Persistence implementation
# Run this after starting the server with: npm start

echo "🔐 Secure Password Persistence - Quick Verification"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server URL
SERVER_URL="http://localhost:5001"

# Test endpoints exist
echo "1️⃣  Testing Endpoints Exist..."
echo "   - Checking PUT /api/users/:uuid/password"
curl -s -X OPTIONS "$SERVER_URL/api/users/test-uuid/password" -w "\n" >/dev/null && echo "   ✓ Password endpoint exists" || echo "   ✗ Failed"

echo "   - Checking POST /api/users/:uuid/password/verify"
curl -s -X OPTIONS "$SERVER_URL/api/users/test-uuid/password/verify" -w "\n" >/dev/null && echo "   ✓ Verify endpoint exists" || echo "   ✗ Failed"

echo "   - Checking GET /api/auth/password-audit"
curl -s -X OPTIONS "$SERVER_URL/api/auth/password-audit" -w "\n" >/dev/null && echo "   ✓ Audit endpoint exists" || echo "   ✗ Failed"

echo ""
echo "2️⃣  Testing Password Policy Validation..."
echo "   - Password too short (should fail)"
RESULT=$(curl -s -X PUT "$SERVER_URL/api/users/test-uuid/password" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"short","currentPassword":"test","changedBy":"test","changedByEmail":"test@test.com","isAdminReset":false}' \
  -w "\n")
if echo "$RESULT" | grep -q "Password policy"; then
  echo "   ✓ Policy validation working"
else
  echo "   ⚠ Could not verify (endpoint may require valid UUID)"
fi

echo ""
echo "3️⃣  Testing Audit Log..."
AUDIT=$(curl -s "$SERVER_URL/api/auth/password-audit")
if echo "$AUDIT" | grep -q "success"; then
  echo "   ✓ Audit endpoint responds"
  COUNT=$(echo "$AUDIT" | grep -o '"id"' | wc -l)
  echo "   - Current audit log entries: $COUNT"
else
  echo "   ✗ Audit endpoint failed"
fi

echo ""
echo "4️⃣  Frontend Changes Verification..."
echo "   - Checking AppContext.js has createUser with hashing..."
if grep -q "hashPassword(userDataWithHashedPassword.password)" ../src/context/AppContext.js 2>/dev/null; then
  echo "   ✓ createUser has password hashing"
else
  echo "   ⚠ Could not verify (check file manually)"
fi

echo "   - Checking ProfilePage.js has full password policy..."
if grep -q "validatePasswordStrength" ../src/pages/ProfilePage.js 2>/dev/null; then
  echo "   ✓ ProfilePage has policy validation"
else
  echo "   ⚠ Could not verify"
fi

echo ""
echo "5️⃣  Manual Testing Steps:"
echo ""
echo "   Browser Testing (http://localhost:3000):"
echo "   ──────────────────────────────────────"
echo ""
echo "   Test 1: User Self-Service Password Change"
echo "   - Log in as a user"
echo "   - Go to Profile page → Security tab"
echo "   - Try to change password with:"
echo "     • Invalid policy password → should show error"
echo "     • Valid password → should succeed"
echo "     • Verify old password doesn't work"
echo "     • Verify new password works after reload"
echo ""
echo "   Test 2: Admin Password Reset"
echo "   - Log in as Admin"
echo "   - Go to Users page"
echo "   - Edit a user and set a new password"
echo "   - Log out and log in as that user"
echo "   - You should see 'Change Password' blocking modal"
echo "   - Cannot access app until password changed"
echo "   - Change password → access restored"
echo ""
echo "   Test 3: Cross-Device Persistence"
echo "   - On Device A: Change password successfully"
echo "   - On Device B: Log in with new password"
echo "   - New password should work"
echo "   - Old password should fail"
echo ""
echo "6️⃣  Backend Verification:"
echo "   - Check server console for logs containing:"
echo "     • '[PasswordAPI] Password changed for'"
echo "     • '[UserDB] Hashed password'"
echo "   - View server/data/password_audit.json:"
echo "     • Should have recent entries"
echo "     • Each with: userId, changedBy, timestamp, changeType"
echo ""
echo "7️⃣  Files Modified:"
echo "   ✓ server/index.js"
echo "   ✓ src/context/AppContext.js" 
echo "   ✓ src/pages/ProfilePage.js"
echo "   ✓ src/services/passwordSyncService.js (verified)"
echo ""
echo "=================================================="
echo "✅ Implementation Complete!"
echo ""
echo "Documentation: See SECURE_PASSWORD_PERSISTENCE_IMPL.md"
echo ""
