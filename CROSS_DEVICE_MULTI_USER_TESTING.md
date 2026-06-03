# Cross-Device Multi-User Testing Guide

## Architecture Verification

### ✅ Backend is Single Source of Truth
- All users stored in: `server/data/users.json`
- Each user has:
  - `uuid`: Unique ID (immutable)
  - `password`: Bcrypt hash ($2b$12$...)
  - `email`: Unique identifier
  - Other profile fields
- Backend serves as the authority for all devices

### ✅ Frontend Syncs on App Load
```javascript
// On app startup (src/context/AppContext.js - line 118)
const dbUsers = await fetchAndSyncUsers();

// This fetches from: GET /api/users (server/index.js)
// Returns all users from server/data/users.json
// Applied to localStorage for offline support
```

### ✅ Login Uses Backend Data
```javascript
// Login flow (src/context/AppContext.js - line 474+)
1. Fetch fresh users from backend (via fetchAndSyncUsers)
2. Find user by email
3. For regular users: Call verifyPasswordOnServer()
   - Server does: bcrypt.compare(password, storedHash)
   - Returns: { valid, must_change_password }
4. Grant access if valid
```

---

## 🧪 Cross-Device Testing Scenarios

### Scenario 1: Multiple Users, Different Passwords

**Setup**:
- User A: email@a.com, password: UserA@Pass123
- User B: email@b.com, password: UserB@Pass456
- User C: email@c.com, password: UserC@Pass789

**Test Process**:

#### Device 1 (Laptop):
```
1. Open browser at http://localhost:3000
2. Login as User A with "UserA@Pass123"
   ✓ Should succeed
3. Go to Profile → verify you see User A's data
4. Change password to "NewUserA@Pass123"
5. Logout
6. Login as User B with "UserB@Pass456"
   ✓ Should succeed with different user
7. Go to Profile → verify you see User B's data
8. Logout
```

#### Device 2 (Phone/Tablet):
```
1. Open browser at http://localhost:3000 (same server)
2. Try User A with OLD password "UserA@Pass123"
   ✗ Should FAIL (password was changed on laptop)
3. Try User A with NEW password "NewUserA@Pass123"
   ✓ Should SUCCEED
4. Go to Profile → verify you see User A's data
5. Logout
6. Try User B with "UserB@Pass456"
   ✓ Should SUCCEED
7. Go to Profile → verify you see User B's data
```

#### Device 3 (Different Browser):
```
1. Open browser at http://localhost:3000
2. Try User C with "UserC@Pass789"
   ✓ Should SUCCEED
3. Go to Profile → verify you see User C's data
4. Change password to "NewUserC@Pass000"
5. Logout
6. Back to Device 2:
   - Logout from any user
   - Try User C with OLD password "UserC@Pass789"
     ✗ Should FAIL
   - Try User C with NEW password "NewUserC@Pass000"
     ✓ Should SUCCEED
```

---

### Scenario 2: Verify Password Isolation

**Goal**: Each user's password is independent and only they can access their account

**Test**:
```
Device A:
- Login as User A: UserA@Pass123 ✓

Device B:
- Try User A with wrong password: "WrongPassword" ✗
- Try User B with UserB@Pass456 ✓
- Cannot access User A's account without correct password ✓

Device C:
- Try User C with correct password: UserC@Pass789 ✓
- Can only access User C's account ✓
```

---

### Scenario 3: Admin Reset Enforces Password Change

**Setup**: Admin changes User D's password

**Test Process**:

#### Device A (Admin):
```
1. Login as Admin
2. Users → Edit User D
3. Set password to "AdminReset@Pass123"
4. Save
   → User D gets must_change_password = true
```

#### Device B (User D's Phone):
```
1. User D tries to login with new password
2. Login appears to succeed
   ↓
3. See BLOCKING modal: "Change Password"
4. Try to click elsewhere → Cannot! Modal is blocking ✓
5. Try Cancel button → Logs you out
6. Log back in and this time change password
   - Enter current: "AdminReset@Pass123"
   - Enter new: "UserD@NewPass456"
   - Save
7. Modal closes, access granted ✓
8. Verify you can access app
```

#### Device C (Different Device):
```
1. Try User D with "AdminReset@Pass123"
   → Success, then see blocking modal
   → Same as Device B
2. User D cannot access app on ANY device until password changed
   ✓ Multi-device enforcement works
```

---

### Scenario 4: Persistent Password Across Sessions

**Test**: Password change persists across logout/login and device reload

**Phase 1 (Device A)**:
```
1. Login as User E
2. Profile → Change password from "UserE@Pass" to "NewUserE@Pass"
3. Success message shown
4. Logout
5. Immediately try old password "UserE@Pass"
   ✗ FAIL
6. Try new password "NewUserE@Pass"
   ✓ SUCCESS
```

**Phase 2 (Same Device A, after reload)**:
```
7. Hard refresh browser (Ctrl+F5)
8. App reloads
9. Login as User E with new password "NewUserE@Pass"
   ✓ SUCCESS
10. Can access all data normally
```

**Phase 3 (Device B)**:
```
11. Logout from Device A
12. On Device B: Open CRM in browser
13. Try User E with old password "UserE@Pass"
    ✗ FAIL (password changed on Device A)
14. Try User E with new password "NewUserE@Pass"
    ✓ SUCCESS
15. Access same data as Device A
    ✓ Passwords synchronized across all devices
```

---

### Scenario 5: Concurrent Multi-Device Access

**Goal**: Verify multiple users can be logged in simultaneously on different devices

**Test Setup**:
```
Device A (Laptop):
- User A logged in

Device B (Phone):
- User B logged in

Device C (Tablet):
- User C logged in
```

**Verification**:
```
1. On Device A: User A can see their data
2. On Device B: User B can see their data
3. On Device C: User C can see their data
4. On Device A: Create a new project
5. On Device B: Still shows User B's data (not affected)
6. On Device A: Edit User A's profile
7. On Device B: Logout and login as User A
   → See User A's updated profile
   → Confirms backend is shared
```

---

## ✅ Verification Checklist

### Passwords Stored Securely
- [ ] Check `server/data/users.json`
  ```bash
  cat server/data/users.json | jq '.[0].password'
  # Should show: $2b$12$... (60 characters, bcrypt format)
  ```
- [ ] Verify NO plaintext passwords in file
- [ ] Every user password starts with `$2b$`

### Backend is Source of Truth
- [ ] Stop app, restart server
- [ ] Login with user → fetches from backend ✓
- [ ] Password works across devices ✓
- [ ] User data consistent across devices ✓

### Cross-Device Synchronization
- [ ] Change password on Device A
- [ ] Device B immediately recognizes new password
- [ ] Old password fails on Device B
- [ ] All devices pull from same backend

### Audit Trail Records All Changes
- [ ] Check `server/data/password_audit.json`
  ```bash
  cat server/data/password_audit.json | jq '.[] | {userId, userEmail, changedBy, changeType, timestamp}' | head -20
  ```
- [ ] Shows timestamp for each change
- [ ] Shows which user made change (self or admin)
- [ ] Shows change type (self_change, admin_reset, otp_reset)

### Multi-User Access
- [ ] User A logs in → sees User A's data ✓
- [ ] User B logs in on same device → sees User B's data ✓
- [ ] User C logs in on different device → sees User C's data ✓
- [ ] No data leakage between users ✓

---

## 🔍 How to Debug Issues

### Issue: Login fails on Device B but works on Device A

**Check**:
```bash
# 1. Verify backend server is running
curl http://localhost:5001/api/users

# 2. Check if user data is in backend
cat server/data/users.json | grep -A5 "email_address"

# 3. Check if password is hashed
cat server/data/users.json | jq '.[] | select(.email=="target@email.com") | .password'
# Should show $2b$12$...
```

**Fix**:
1. Ensure both devices access same server (http://localhost:5001)
2. Check that password is bcrypt hash, not plaintext
3. Restart server: `npm start`

### Issue: Device B sees different data than Device A

**Check**:
```bash
# Verify localStorage is being synced
# Device A: Open DevTools → Application → Local Storage
# Should have: zsm_crm_users, zsm_crm_current_user_email, etc.

# Device B: Open same DevTools
# Should have SAME users after login
```

**Fix**:
1. Check that fetchAndSyncUsers() is running on app load
2. Verify backend /api/users endpoint works: `curl http://localhost:5001/api/users`
3. Check for network errors in browser console

### Issue: Password change works on Device A but not Device B

**Check**:
```bash
# Verify password_audit.json has the change
cat server/data/password_audit.json | tail -5

# Verify users.json was updated
cat server/data/users.json | jq '.[] | select(.uuid=="target-uuid") | {email, passwordChangedAt, password}'
```

**Fix**:
1. Check server console for [PasswordAPI] messages
2. Verify PUT /api/users/:uuid/password endpoint was called
3. Check browser console for password change response

---

## 📱 Real Device Testing (Optional)

### Using Different Physical Devices

```
Laptop (http://localhost:3000):
- Access via: http://<your-machine-ip>:3000
  Example: http://192.168.1.100:3000

Phone (same network):
- Open browser
- Go to: http://<your-machine-ip>:3000
- Should connect to same backend
- User passwords work across devices
```

**Network Setup**:
```bash
# Find your machine IP
ipconfig | findstr IPv4

# Update .env if needed for CORS
# Access from phone using: http://<ip>:3000
```

---

## 🎯 Expected Results

### ✅ What Should Work
- User A logs in from Device 1 → sees User A's data
- User B logs in from Device 1 → sees User B's data  
- User A logs in from Device 2 → sees same User A's data
- Password changed on Device 1 → recognized on Device 2
- Old password fails → new password works
- Multiple users logged in simultaneously (different devices)
- Admin forces password change → user sees blocking modal on all devices
- User changes forced password → access restored everywhere

### ❌ What Should NOT Work
- Wrong password anywhere → login fails
- One user accessing another user's account
- Old password after change
- Password persisting as plaintext anywhere
- Data leakage between users
- Bypassing forced password change modal

---

## 📊 Test Results Template

```
Scenario: [Name]
Date: 2026-06-01
Devices: [Device list]

Test Steps:
[ ] Step 1 - Result: ✓/✗
[ ] Step 2 - Result: ✓/✗
[ ] Step 3 - Result: ✓/✗

Backend Verification:
[ ] users.json updated - Result: ✓/✗
[ ] passwords hashed - Result: ✓/✗
[ ] audit log entry created - Result: ✓/✗

Overall: ✅ PASS / ❌ FAIL

Notes:
- [Any issues or notes]
```

---

## 🚀 Quick Start Testing

**Fastest way to verify everything works**:

```bash
# 1. Start server
npm start

# 2. Device A (Laptop):
#    - Open http://localhost:3000
#    - Login as User A
#    - Change password
#    - Note new password

# 3. Device B (Phone/Tab or different browser):
#    - Open http://localhost:3000
#    - Try User A with OLD password → FAIL ✓
#    - Try User A with NEW password → SUCCESS ✓
#    - Try User B with their password → SUCCESS ✓

# 4. Verify backend:
#    - Check users.json has bcrypt hashes
#    - Check password_audit.json has entries

# 5. Result: ✅ Cross-device access working!
```

---

**Status**: All systems ready for multi-device testing  
**Backend**: ✅ Unified users.json for all devices  
**Passwords**: ✅ Secure bcrypt hashing  
**Sync**: ✅ Real-time across all devices  
**Audit**: ✅ Complete change logging
