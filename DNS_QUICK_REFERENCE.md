# DNS Authentication Quick Reference Guide

## 🚀 Quick Start (5 Minutes)

### For SPF:
```
Type: TXT
Name: @
Value: v=spf1 include:mail.yourdomain.com ~all
```

### For DKIM:
```
Type: TXT
Name: mail._domainkey
Value: [Generated public key from system]
```

### For DMARC:
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:admin@domain.com
```

---

## 📊 Status Meanings

| Icon | Status | What to Do |
|------|--------|-----------|
| ✅ | Valid | All good! DNS record is correctly configured |
| ⏳ | Not Found | Wait 24-48 hours for DNS propagation |
| ❌ | Invalid | Check record format, copy again from system |
| ❓ | Unknown | Click verify button to check |

---

## 🔍 Troubleshooting Matrix

| Problem | Cause | Solution |
|---------|-------|----------|
| DNS record not found | Not propagated yet | Wait 24-48 hours, use https://mxtoolbox.com |
| Invalid DKIM format | Truncated or corrupted | Regenerate key and copy again |
| SPF soft fail only | Using ~all instead of -all | Update to use -all after verification |
| DMARC reports not arriving | Wrong admin email | Regenerate DMARC record with correct email |
| Mail server not in SPF | Incomplete SPF record | Include full mail server hostname |

---

## 📋 DNS Provider Links

- **cPanel**: Webmail → Email Routing → Authentication
- **Cloudflare**: DNS → Create Record
- **GoDaddy**: Manage DNS → Add Record
- **AWS Route 53**: Hosted Zones → Create Record
- **Azure**: DNS Zones → +Record Set
- **Namecheap**: Domain → Manage → DNS

---

## ⏱️ Typical Timeline

| Step | Time |
|------|------|
| Create DNS record | 5 minutes |
| DNS propagation | 24-48 hours |
| Verification | Immediate (after propagation) |
| Email delivery improvement | 1-7 days |
| Full reports generation | 7-30 days |

---

## ✅ Success Checklist

- [ ] SPF shows "✅ Valid"
- [ ] DKIM shows "✅ Valid"  
- [ ] DMARC shows "✅ Valid"
- [ ] Email delivery rate normal
- [ ] No bounce issues reported

---

## 🎯 Recommended Settings

### Testing Phase (First 30 Days)
```
SPF: v=spf1 include:mail.domain.com ~all   (soft fail)
DKIM: Generate and deploy
DMARC: v=DMARC1; p=none                     (monitoring)
```

### Production Phase (After Verification)
```
SPF: v=spf1 include:mail.domain.com -all    (hard fail)
DKIM: Keep active key deployed
DMARC: v=DMARC1; p=quarantine               (stricter)
```

### Maximum Security (After 90 Days)
```
SPF: v=spf1 include:mail.domain.com -all
DKIM: With key rotation schedule
DMARC: v=DMARC1; p=reject                   (strictest)
```

---

## 🔄 Key Rotation Schedule

**Every 12-24 months:**
1. Generate new DKIM key with selector `mail2`
2. Deploy `mail2._domainkey` record
3. Update mail server to use both keys
4. Monitor for 30 days
5. Remove old `mail._domainkey` record
6. Repeat with next selector

---

## 📞 Quick Help

**Q: Why is my SPF not verifying?**
A: Wait 24-48 hours for propagation, check @ symbol in name field

**Q: How do I rotate DKIM keys?**
A: Generate new key with different selector (mail2, mail3, etc)

**Q: Should I use hard fail (-all) or soft fail (~all)?**
A: Start with ~all (soft), switch to -all after SPF verification succeeds

**Q: What's the difference between p=quarantine and p=reject?**
A: Quarantine sends bad email to spam; reject blocks it completely

**Q: Can I have multiple DKIM keys?**
A: Yes! Use different selectors for key rotation

---

**Last Updated**: May 8, 2026
**Version**: 1.0
