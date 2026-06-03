# Password Persistence - Quick Reference Card

## 🚀 Quick Start After Implementation

### Start Server
```bash
npm start
# Server runs on http://localhost:5001
# App runs on http://localhost:3000
```

### Test Password Change (User)
1. Login as any user
2. Profile → Security → Change Password
3. Enter weak password → Error ✓
4. Enter strong password (min 8, upper, lower, num, special) → Success ✓
5. Logout → Try old password → Fail ✓
6. Try new password → Success ✓

### Test Admin Reset
1. Login as Admin
2. Users → Edit user → Set password
3. Save → User gets must_change_password = true
4. That user logs in → Blocking modal ✓
5. Can't access app until password changed ✓

### Test Persistence
1. Change password on laptop
2. Log in on phone with new password → Works ✓
3. Old password doesn't work anywhere ✓

---

## 📋 New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users/:uuid/password` | PUT | Change password (user or admin) |
| `/api/users/:uuid/password/verify` | POST | Verify password (login) |
| `/api/auth/password-audit` | GET | View password change log |

---

## 🔐 Password Policy

✅ **Required** (all must pass):
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

❌ **Rejected** (any fail = error):
- Less than 8 characters
- Only lowercase
- No numbers
- No special characters
- Same as current password

---

## 📊 Files Modified

```
✅ server/index.js
   • POST /api/users - Hashes passwords
   • PUT /api/users/:uuid - Hashes passwords
   • PUT /api/users/:uuid/password - NEW
   • POST /api/users/:uuid/password/verify - NEW
   • GET /api/auth/password-audit - NEW

✅ src/context/AppContext.js
   • createUser() - Now hashes passwords (async)

✅ src/pages/ProfilePage.js
   • handlePassChange() - Full policy validation
   • Imports validatePasswordStrength

✅ (Already working correctly)
   • src/services/passwordSyncService.js
   • src/components/ChangePassword.js
   • src/App.js
   • src/pages/UsersPage.js
```

---

## 🔍 Verification Commands

### Check Server
```bash
# Test password endpoint
curl -X PUT http://localhost:5001/api/users/test/password

# View audit log
curl http://localhost:5001/api/auth/password-audit | jq

# Check users.json for bcrypt hashes
cat server/data/users.json | jq '.[0].password'
# Should show: $2b$12$... (60 chars, starts with $2b$)
```

### Check Audit Log
```bash
# View password changes
cat server/data/password_audit.json | jq

# Count entries
cat server/data/password_audit.json | jq 'length'
```

---

## ⚠️ Troubleshooting

### Issue: "Current password is incorrect"
**Cause**: Entered wrong current password
**Fix**: Verify current password is correct

### Issue: "Password policy violation"
**Cause**: Password doesn't meet requirements
**Fix**: Use 8+ chars with upper, lower, number, special char

### Issue: User can't login after password change
**Cause**: Password didn't sync to backend
**Fix**: Check server console for errors, verify users.json updated

### Issue: Admin reset doesn't show blocking modal
**Cause**: must_change_password not set
**Fix**: Check users.json - should have `"must_change_password": true`

### Issue: Old password still works after change
**Cause**: Backend didn't hash correctly
**Fix**: Check users.json password field - should start with `$2b$`

---

## 📝 User Experience

### User Self-Service
```
1. User: "I want to change my password"
2. User goes to Profile → Security
3. User: Enters current password (verified immediately)
4. User: Enters new password (validated client-side)
5. System: Sends to backend with current password
6. Backend: Verifies current password (bcrypt.compare)
7. Backend: Validates policy
8. Backend: Hashes new password
9. Backend: Updates users.json
10. Backend: Logs to password_audit.json
11. System: Returns success with hash
12. User: Sees "✅ Password changed successfully"
13. User: Logs out and back in
14. Backend: Recognizes new hash
15. User: Logged in ✓
```

### Admin Password Reset
```
1. Admin: "User forgot password, need to reset"
2. Admin goes to Users → Edit user
3. Admin: Sets new password
4. Admin: Saves
5. System: Calls changePasswordOnServer with isAdminReset=true
6. Backend: Skips current password verification
7. Backend: Hashes new password
8. Backend: Sets must_change_password = true ⚠️ FORCES CHANGE
9. Backend: Logs to password_audit.json
10. Backend: Returns success
11. Admin: Sees "✅ Employee updated successfully"
12. User: Logs in with new temporary password
13. System: Blocking modal appears
14. User: Cannot access app
15. User: Enters current (temporary) and new password
16. System: Updates password, clears must_change_password
17. User: Access granted ✓
```

---

## 🎯 Success Indicators

### Should See
✅ Passwords hashed in users.json (starts with $2b$)
✅ Entries in password_audit.json after each change
✅ [PasswordAPI] logs in server console
✅ Blocking modal when user has must_change_password=true
✅ Password changes work across reloads
✅ Password changes work across devices

### Should NOT See
❌ Plaintext passwords in users.json
❌ "Fire-and-forget" sync messages
❌ Plaintext passwords in localStorage
❌ Users bypassing password change modal

---

## 📞 Key Functions

### Frontend
```javascript
// Change password on backend
import { changePasswordOnServer } from '../services/passwordSyncService';
await changePasswordOnServer(uuid, newPassword, changedBy, email, isAdminReset, currentPassword);

// Validate password locally
import { validatePasswordStrength } from '../services/passwordService';
const validation = validatePasswordStrength(password);
if (!validation.isValid) {
  console.log(validation.errors);
}

// Hash password (client-side backup)
import { hashPassword } from '../services/passwordService';
const hash = await hashPassword(password);
```

### Backend
```javascript
// Hash password (server)
const hash = await bcrypt.hash(password, 12);

// Verify password (server)
const isValid = await bcrypt.compare(plaintext, hash);

// Check policy (server)
const errors = validatePasswordPolicy(password);
```

---

## 🔐 Security Notes

- All passwords hashed with bcrypt (12 rounds)
- Passwords never stored in plaintext anywhere
- Backend is authority for password verification
- Audit trail of all changes with IP and user info
- Admin bypass exists but marked for deprecation
- OTP reset flow also integrated with audit logging
- Tombstone protection prevents changes on deleted users

---

**Last Updated**: June 1, 2026  
**Status**: ✅ Ready for Testing
