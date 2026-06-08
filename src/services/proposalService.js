export const SERVICES = [
  { id: 'webdesign', name: 'Web Design & Development', basePrice: 15000, description: 'Professional website design and development' },
  { id: 'seo', name: 'SEO Services', basePrice: 8000, description: 'Search engine optimization' },
  { id: 'socialmedia', name: 'Social Media Marketing', basePrice: 12000, description: 'Social media management and marketing' },
  { id: 'content', name: 'Content Marketing', basePrice: 10000, description: 'Content creation and marketing' },
  { id: 'ppc', name: 'PPC Advertising', basePrice: 15000, description: 'Pay-per-click campaign management' },
  { id: 'emailmarketing', name: 'Email Marketing', basePrice: 6000, description: 'Email campaign management' },
  { id: 'branding', name: 'Branding & Logo Design', basePrice: 20000, description: 'Brand identity and logo design' },
  { id: 'ecommerce', name: 'E-commerce Solutions', basePrice: 25000, description: 'Online store development' },
  { id: 'appdev', name: 'Mobile App Development', basePrice: 35000, description: 'iOS and Android app development' },
  { id: 'maintenance', name: 'Website Maintenance', basePrice: 3000, description: 'Monthly maintenance and updates' },
  { id: 'video', name: 'Video Production', basePrice: 18000, description: 'Video creation and editing' },
  { id: 'consulting', name: 'Digital Consulting', basePrice: 5000, description: 'Digital strategy consultation' },
  { id: 'gmb', name: 'GMB Plan', basePrice: 5000, description: 'Google My Business Optimization Plan' },
  { id: 'gmbsupport', name: 'GMB Support Plan', basePrice: 3000, description: 'Google My Business Support Plan' },
  { id: 'sem', name: 'SEM Plan', basePrice: 10000, description: 'Search Engine Marketing Plan' },
  { id: 'googleads', name: 'Google Ads Plan', basePrice: 12000, description: 'Google Ads Management Plan' },
  { id: 'visitingcard', name: 'Visiting Card Design Plan', basePrice: 1500, description: 'Professional Visiting Card Design' },
  { id: 'reviewscanner', name: 'Review Scanner', basePrice: 4500, description: 'Business Review Scanner & Analytics' },
];

export const MERGE_TAGS = [
  { tag: '{{client_name}}', description: 'Client Name' },
  { tag: '{{business_name}}', description: 'Business Name' },
  { tag: '{{agent_name}}', description: 'Agent Name' },
  { tag: '{{company_name}}', description: 'Company Name' },
  { tag: '{{proposal_title}}', description: 'Proposal Title' },
  { tag: '{{proposal_total}}', description: 'Proposal Total' },
  { tag: '{{valid_until}}', description: 'Valid Until Date' },
];

export const EMAIL_TEMPLATES = [
  {
    id: 'new_proposal',
    name: 'New Proposal',
    subject: 'Your Proposal from {{company_name}} - {{proposal_title}}',
    body: `Dear {{client_name}},

Thank you for considering {{company_name}} for your business needs. Please find attached our proposal for {{proposal_title}}.

We have carefully analyzed your requirements and prepared a comprehensive solution tailored to your needs. The proposal includes all the details about the services we discussed.

Please review the attached document and feel free to reach out if you have any questions or would like to discuss further.

We look forward to the opportunity to work with you.
`
  },
  {
    id: 'follow_up',
    name: 'Follow Up',
    subject: 'Following up on your proposal - {{company_name}}',
    body: `Dear {{client_name}},

I hope this email finds you well. I wanted to follow up on the proposal we sent regarding {{proposal_title}}.

Have you had a chance to review it? Please let me know if you have any questions or need any additional information.

We are happy to schedule a call at your convenience to discuss the proposal in detail.

Looking forward to hearing from you.
`
  },
  {
    id: 'revision',
    name: 'Proposal Revision',
    subject: 'Revised Proposal from {{company_name}}',
    body: `Dear {{client_name}},

Thank you for your feedback. Based on your comments, we have revised the proposal for {{proposal_title}}.

Please find the updated document attached. The key changes include:
- Updated pricing based on your requirements
- Adjusted timeline to better suit your needs
- Additional services you requested

Let us know if you would like to discuss any of these changes.
`
  },
  {
    id: 'custom',
    name: 'Custom',
    subject: 'Your Proposal from {{company_name}}',
    body: ''
  }
];

export const replaceMergeTags = (text, values) => {
  if (!text) return '';
  return text.replace(/\{\{([\w_]+)\}\}/g, (match, key) => {
    return values[key] !== undefined && values[key] !== null ? values[key] : match;
  });
};

export const getSignature = (agentName, phone, email, company) => {
  return `
---

Best regards,
${agentName}
${company}
Phone: ${phone}
Email: ${email}
`;
};

export const calculateProposalTotal = (items = [], taxRate = 18, discountRate = 0) => {
  // Step 1: Line item totals (assuming items already have basePrice and quantity or total)
  const lineItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.basePrice || item.price || item.total) || 0;
    return {
      ...item,
      lineTotal: Math.round(qty * price * 100) / 100
    };
  });

  // Step 2: Subtotal
  const subtotal = Math.round(
    lineItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100
  ) / 100;

  // Step 3: Discount
  const discountPercent = parseFloat(discountRate) || 0;
  const discountAmount  = Math.round(subtotal * (discountPercent / 100) * 100) / 100;

  // Step 4: Taxable amount (after discount)
  const taxableAmount   = Math.round((subtotal - discountAmount) * 100) / 100;

  // Step 5: Tax on taxable amount
  const taxPercent      = parseFloat(taxRate) || 0;
  const taxAmount       = Math.round(taxableAmount * (taxPercent / 100) * 100) / 100;

  // Step 6: Grand Total
  const grandTotal      = Math.round((taxableAmount + taxAmount) * 100) / 100;

  return {
    lineItems,
    subtotal,
    discountPercent,
    discountAmount,
    taxableAmount, // equivalent to old 'afterDiscount'
    afterDiscount: taxableAmount, // backward compatibility
    taxPercent,
    taxAmount,     // equivalent to old 'tax'
    tax: taxAmount,           // backward compatibility
    grandTotal,    // equivalent to old 'total'
    total: grandTotal // backward compatibility
  };
};

export const generateProposalHTML = (proposal, items, totals) => {
  const itemsHTML = items.map((item, index) => `
    <tr style="background-color:${index % 2 === 0 ? '#f9fbff' : '#ffffff'};">
      <td style="padding:10px 12px; border:1px solid #dce8f5;">
        ${item.name}
      </td>
      <td style="padding:10px 12px; text-align:center; border:1px solid #dce8f5;">
        ${item.quantity}
      </td>
      <td style="padding:10px 12px; text-align:right; border:1px solid #dce8f5;">
        ₹${item.basePrice.toLocaleString('en-IN')}
      </td>
      <td style="padding:10px 12px; text-align:right; border:1px solid #dce8f5;">
        ₹${item.total.toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Proposal</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, sans-serif; color:#333333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding: 40px 0;">
    <tr>
      <td align="center">
        <!-- Email Card -->
        <table width="620" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- ── HEADER ── -->
          <tr>
            <td style="background-color:#1a73e8; padding:32px 40px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">
                ${proposal.companyName || 'ZSM Services'}
              </h1>
              <p style="margin:6px 0 0; color:#d0e8ff; font-size:13px;">
                ${proposal.senderEmail || 'info@zsmservices.com'}
              </p>
            </td>
          </tr>
          <!-- ── PROPOSAL TITLE BANNER ── -->
          <tr>
            <td style="background-color:#f0f7ff; padding:20px 40px; border-bottom:1px solid #dce8f5;">
              <h2 style="margin:0; font-size:18px; color:#1a73e8;">
                ${proposal.title}
              </h2>
              <p style="margin:6px 0 0; font-size:13px; color:#666;">
                Prepared for: <strong style="color:#333;">${proposal.clientName || 'Valued Customer'}</strong> &nbsp;|&nbsp; Company: <strong style="color:#333;">${proposal.businessName || 'N/A'}</strong>
              </p>
              <p style="margin:4px 0 0; font-size:13px; color:#e65c00;">
                Valid Until: <strong>${proposal.validUntil}</strong>
              </p>
            </td>
          </tr>
          <!-- ── BODY ── -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px; font-size:15px; color:#333;">
                Dear <strong>${proposal.clientName || 'Valued Customer'}</strong>,
              </p>
              <p style="margin:0 0 24px; font-size:14px; color:#555; line-height:1.6;">
                Thank you for considering <strong>${proposal.companyName || 'ZSM Services'}</strong> for your business needs. Please find below our proposal for <strong>${proposal.title}</strong>.
              </p>
              <!-- ── SERVICE DETAILS TABLE ── -->
              <p style="margin:0 0 10px; font-size:15px; font-weight:700; color:#1a73e8; border-bottom:2px solid #1a73e8; padding-bottom:6px;">
                Service Details
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:14px; margin-bottom:20px;">
                <thead>
                  <tr style="background-color:#1a73e8; color:#ffffff;">
                    <th style="padding:10px 12px; text-align:left; border:1px solid #1565c0;">Service</th>
                    <th style="padding:10px 12px; text-align:center; border:1px solid #1565c0; width:60px;">Qty</th>
                    <th style="padding:10px 12px; text-align:right; border:1px solid #1565c0; width:90px;">Price</th>
                    <th style="padding:10px 12px; text-align:right; border:1px solid #1565c0; width:90px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
                <tfoot>
                  <tr style="background-color:#f4f6f8;">
                    <td colspan="3" style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; font-weight:600; color:#555;">Subtotal</td>
                    <td style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; font-weight:600;">₹${totals.subtotal.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style="background-color:#fff8f0;">
                    <td colspan="3" style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; color:#e65c00;">Discount (${totals.discountPercent}%)</td>
                    <td style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; color:#e65c00;">-₹${totals.discountAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style="background-color:#f4f6f8;">
                    <td colspan="3" style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; color:#555;">Tax (${totals.taxPercent}%)</td>
                    <td style="padding:9px 12px; text-align:right; border:1px solid #dce8f5; color:#555;">₹${totals.taxAmount.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr style="background-color:#1a73e8; color:#ffffff;">
                    <td colspan="3" style="padding:12px; text-align:right; font-size:15px; font-weight:700; border:1px solid #1565c0;">Total</td>
                    <td style="padding:12px; text-align:right; font-size:15px; font-weight:700; border:1px solid #1565c0;">₹${totals.grandTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
              <!-- END TABLE -->
              <p style="margin:0; font-size:13px; color:#888; font-style:italic;">
                This proposal is valid until <strong style="color:#e65c00;">${proposal.validUntil}</strong>. Please reach out for any questions.
              </p>
              ${proposal.notes ? `<p style="margin:10px 0 0; font-size:14px; color:#333;"><strong>Notes:</strong><br/>${proposal.notes}</p>` : ''}
            </td>
          </tr>
          <!-- ── FOOTER ── -->
          <tr>
            <td style="background-color:#f0f7ff; padding:20px 40px; text-align:center; border-top:1px solid #dce8f5;">
              <p style="margin:0; font-size:13px; color:#555;">
                <strong>${proposal.senderName || 'Sales Agent'}</strong> &nbsp;|&nbsp; ${proposal.companyName || 'ZSM Services'}
              </p>
              <p style="margin:4px 0 0; font-size:12px; color:#888;">
                Phone: ${proposal.senderPhone || 'N/A'} &nbsp;|&nbsp; Email: ${proposal.senderEmail || 'info@zsmservices.com'}
              </p>
              <p style="margin:8px 0 0; font-size:11px; color:#aaa;">
                © 2026 ${proposal.companyName || 'ZSM Services'}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
        <!-- END CARD -->
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export const generateProposalText = (proposal, items, totals) => {
  const itemsText = items.map(item => 
    `- ${item.name} (Qty: ${item.quantity}) - ₹${item.total.toLocaleString()}`
  ).join('\n');

  return `
${proposal.title}
Valid Until: ${proposal.validUntil}

SERVICES:
${itemsText}

Subtotal: ₹${totals.subtotal.toLocaleString()}
Discount (${totals.discountPercent}%): -₹${totals.discountAmount.toLocaleString()}
Tax (${totals.taxPercent}%): ₹${totals.taxAmount.toLocaleString()}
TOTAL: ₹${totals.grandTotal.toLocaleString()}

${proposal.notes ? `Notes: ${proposal.notes}` : ''}

---
This proposal is valid until ${proposal.validUntil}
ZSM Services | info@zsmservices.com
  `.trim();
};

export const generateToken = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const sendProposalEmail = async (to, subject, html) => {
  const emailData = {
    to,
    subject,
    body: html,
    isHtml: true
  };
  const response = await fetch((process.env.REACT_APP_API_URL || '') + '/api/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });
  if (!response.ok) {
    throw new Error('Failed to send proposal email');
  }
  return response.json();
};
