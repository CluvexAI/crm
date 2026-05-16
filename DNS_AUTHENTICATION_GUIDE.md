# DNS Authentication Setup Guide (SPF, DKIM, DMARC)

## Overview

The DNS Authentication Setup feature in the ZSM CRM admin panel allows administrators to configure and verify email deliverability records (SPF, DKIM, DMARC) for their domain. These DNS records are essential for authenticating email from your mail server and improving email delivery rates.

## 📌 Key Features

### SPF (Sender Policy Framework)
- **Purpose**: Prevents email spoofing by authorizing mail servers that can send emails from your domain
- **Status Tracking**: Live verification and status monitoring
- **Auto-generation**: Automatically configured for your domain

### DKIM (DomainKeys Identified Mail)
- **Purpose**: Digitally signs emails so recipients can verify they came from your domain
- **Key Management**: Generate and manage RSA key pairs
- **Selector Support**: Multiple DKIM selectors for key rotation
- **Auto-generation**: Creates 2048-bit RSA key pairs

### DMARC (Domain-based Message Authentication, Reporting and Conformance)
- **Purpose**: Policy framework for SPF and DKIM enforcement
- **Policy Options**: none, quarantine, or reject
- **Reporting**: Aggregate reports sent to admin email
- **Live Verification**: Confirms policy configuration

---

## 🚀 Getting Started

### Step 1: Access DNS Authentication Setup

1. Go to **Admin Panel** → **Email Configuration**
2. Click the **"SPF, DKIM & DMARC"** tab
3. Select your domain or enter a custom domain name

### Step 2: Configure SPF Record

#### 📧 SPF Configuration

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Name** | @ or domain root (e.g., `example.com`) |
| **TTL** | 3600 (1 hour) |
| **Value** | `v=spf1 include:mail.yourdomain.com ~all` |

**Steps to Add SPF:**

1. Click **Copy SPF Record** button
2. Log into your domain hosting provider (cPanel, Cloudflare, GoDaddy, Route 53, etc.)
3. Go to **DNS Management** → **Add New Record**
4. Create a **TXT record** with:
   - Name: `@` (or leave blank)
   - Value: Paste the copied SPF record
   - TTL: 3600
5. Save the record
6. Return to ZSM CRM and click **Verify SPF** (wait 5-10 minutes for DNS propagation)

**Common Soft Fail vs Hard Fail:**
- `~all` = Soft fail (recommended for testing)
- `-all` = Hard fail (use after verification is successful)

---

### Step 3: Configure DKIM Record

#### 🔐 DKIM Configuration

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Selector** | mail (or custom) |
| **Name** | `mail._domainkey.example.com` |
| **TTL** | 3600 |

**Steps to Add DKIM:**

1. Click **⚙️ Generate Key** button
   - System generates a 2048-bit RSA key pair
   - Public key is displayed (used in DNS)
   - Private key is stored securely on server

2. Click **Copy DKIM Record** button

3. In your DNS provider, create a **TXT record** with:
   - Name: `mail._domainkey` (or `{selector}._domainkey`)
   - Value: Paste the public key from the system
   - TTL: 3600

4. Save the record

5. Return to ZSM CRM and click **Verify DKIM**

**DKIM Key Rotation:**
- You can generate new keys with different selectors (e.g., `mail2`, `mail3`)
- Keep old keys active during transition period
- Delete old keys after verification of new ones

---

### Step 4: Configure DMARC Record

#### 🚫 DMARC Configuration

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Name** | `_dmarc` |
| **TTL** | 3600 |
| **Policy** | Select from dropdown: None, Quarantine, or Reject |

**DMARC Policy Options:**

- **p=none** (Testing/Monitoring)
  - No enforcement
  - Receivers send reports
  - Use during initial setup
  
- **p=quarantine** (Recommended)
  - Suspicious emails sent to spam folder
  - More lenient than reject
  - Good balance for production
  
- **p=reject** (Strict)
  - Suspicious emails rejected
  - Only use after SPF/DKIM fully verified
  - Can cause delivery issues if misconfigured

**Steps to Add DMARC:**

1. Select your **DMARC Policy** from dropdown (starts with "quarantine")

2. Click **Copy DMARC Record** button
   - A prompt appears asking for admin email for reports
   - Enter the email address where DMARC reports should be sent

3. In your DNS provider, create a **TXT record** with:
   - Name: `_dmarc`
   - Value: Paste the copied DMARC record
   - TTL: 3600

4. Save the record

5. Return to ZSM CRM and click **Verify DMARC**

**Example DMARC Record:**
```
v=DMARC1; p=quarantine; rua=mailto:admin@example.com; fo=1
```

---

## 🔍 Verification and Troubleshooting

### Status Indicators

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ **Valid** | Record is correctly configured and verified | Monitoring continues |
| ⏳ **Not Found** | DNS record not found yet | Wait 24-48 hours, try again |
| ❌ **Invalid** | Record found but format is wrong | Review and correct record |
| ❓ **Unknown** | Not yet verified | Click Verify button |

### Verification Process

When you click a **Verify** button:

1. System queries public DNS servers
2. Looks for your DNS record
3. Validates record format and content
4. Returns detailed status and issues
5. Logs verification attempt in audit log

### Common Issues and Solutions

#### SPF Record Not Found

**Issue**: "No SPF record found for domain"

**Solutions:**
1. Wait 24-48 hours for DNS propagation
2. Check that you're using the correct domain name
3. Verify the TXT record was created (not CNAME, A, or MX)
4. Check your DNS provider's interface for any pending changes
5. Use external DNS checker: https://mxtoolbox.com/spf.aspx

#### DKIM Record Invalid

**Issue**: "DKIM record found but format is invalid"

**Solutions:**
1. Ensure you copied the **entire** DKIM record from the system
2. Don't add extra quotes or line breaks
3. Some DNS providers limit TXT record length; use a DNS record splitter if needed
4. Verify the selector matches (e.g., `mail._domainkey`, not `_domainkey`)
5. Check that the record starts with `v=DKIM1`

#### DMARC Policy Too Permissive

**Issue**: "DMARC policy is set to 'none' - not recommended"

**Solutions:**
1. Start with `p=none` for 30-60 days to monitor
2. Monitor DMARC reports at your email admin address
3. Verify SPF and DKIM are working
4. Change policy to `p=quarantine` when ready
5. Later move to `p=reject` for maximum security

---

## 🛠️ Advanced Configuration

### Multiple DKIM Selectors

For key rotation without downtime:

1. Generate first key with selector: `mail`
2. Deploy `mail._domainkey` record
3. Generate second key with selector: `mail2`
4. Deploy `mail2._domainkey` record
5. Configure mail server to use both keys
6. After 30 days, retire old key

### DMARC Aggregate Reports

Configure where reports should go:

```
v=DMARC1; p=quarantine; rua=mailto:reports@example.com; ruf=mailto:forensics@example.com; fo=1
```

- **rua**: Aggregate reports (summary)
- **ruf**: Forensic reports (detailed)
- **fo**: Report format options

### SPF Modifiers

Customize SPF behavior:

```
v=spf1 ip4:192.0.2.0 include:mail.example.com -all
```

- **~all**: Soft fail (accepted, tagged as suspicious)
- **-all**: Hard fail (rejected)
- **include**: Include another domain's SPF
- **ip4/ip6**: Authorize specific IPs

---

## 📊 Monitoring and Maintenance

### Regular Verification

- **Weekly**: Click Verify buttons to check record status
- **Monthly**: Review verification logs in the Monitoring tab
- **Quarterly**: Check DMARC aggregate reports for delivery issues

### Log Monitoring

View verification history in:
- **Admin Panel** → **Email Configuration** → **Monitoring** tab
- Shows all verification attempts, results, and timestamps

### Performance Impact

- Verification is non-blocking (happens in background)
- DNS queries cache for 1 hour
- No impact on email sending during verification

---

## 🔐 Security Considerations

### Private Key Protection

- Private DKIM keys are stored encrypted
- Accessible only to application
- Never shared in DNS records

### Key Rotation

- Rotate DKIM keys every 12-24 months
- Use multiple selectors during transition
- Archive old keys for audit purposes

### DMARC Policy Escalation

- Start with `p=none` (monitoring)
- Move to `p=quarantine` (testing)
- Escalate to `p=reject` only when confident

---

## 📞 Support and Resources

### Internal Documentation
- See [zsmcrm.md](../zsmcrm.md) for CRM setup guide
- Check [README.md](../README.md) for installation

### External Tools for Verification

- **SPF Checker**: https://mxtoolbox.com/spf.aspx
- **DKIM Checker**: https://www.dkimvalidator.com/
- **DMARC Checker**: https://mxtoolbox.com/dmarc.aspx
- **All-in-one**: https://www.mail-tester.com/

### Common DNS Providers

- **cPanel**: WHM → Email Deliverability
- **Cloudflare**: DNS → Add Record
- **GoDaddy**: DNS Management → Add Record
- **AWS Route 53**: Hosted Zones → Create Record
- **Azure**: DNS Zones → +Record Set
- **Namecheap**: Domain → DNS

---

## ✅ Verification Checklist

After setting up all three DNS records, verify:

- [ ] SPF record created and verified (shows "✅ Valid")
- [ ] DKIM key generated and record created (shows "✅ Valid")
- [ ] DMARC policy set and record created (shows "✅ Valid")
- [ ] Email delivery rate normal (check monitoring tab)
- [ ] No bounce or spam issues (monitor logs)
- [ ] DMARC reports arriving at admin email
- [ ] Team can send emails from domain without issues

---

## 🚀 Next Steps After DNS Setup

1. **Monitor Email Delivery**: Track bounce rates and spam complaints
2. **Review DMARC Reports**: Analyze authentication failures
3. **Optimize SPF**: Add only necessary mail servers
4. **Schedule Key Rotation**: Plan DKIM rotation every 12 months
5. **Implement DANE**: Optional additional security layer

---

*Last Updated: May 8, 2026*
*DNS Authentication Setup v1.0*
