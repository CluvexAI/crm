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

export const calculateProposalTotal = (items, discount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const discountAmount = (subtotal * discount) / 100;
  const afterDiscount = subtotal - discountAmount;
  const tax = (afterDiscount * 18) / 100;
  const total = afterDiscount + tax;
  return {
    subtotal,
    discountAmount,
    afterDiscount,
    tax,
    total
  };
};

export const generateProposalHTML = (proposal, items, totals) => {
  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 12px; border: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${item.basePrice.toLocaleString()}</td>
      <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${item.total.toLocaleString()}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .total-row { font-weight: bold; background: #f8f9fa; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${proposal.title}</h1>
      <p>Valid Until: ${proposal.validUntil}</p>
    </div>
    <div class="content">
      <h3>Service Details</h3>
      <table>
        <thead>
          <tr style="background: #34495e; color: white;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Service</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Qty</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Price</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
          <tr class="total-row">
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right;">Subtotal</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${totals.subtotal.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right;">Discount (${proposal.discount || 0}%)</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">-₹${totals.discountAmount.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right;">Tax (18%)</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${totals.tax.toLocaleString()}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" style="padding: 12px; border: 1px solid #ddd; text-align: right;">Total</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">₹${totals.total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      ${proposal.notes ? `<h4>Notes:</h4><p>${proposal.notes}</p>` : ''}
    </div>
    <div class="footer">
      <p>This proposal is valid until ${proposal.validUntil}</p>
      <p>ZSM Services | info@zsmservices.com</p>
    </div>
  </div>
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
Discount (${proposal.discount || 0}%): -₹${totals.discountAmount.toLocaleString()}
Tax (18%): ₹${totals.tax.toLocaleString()}
TOTAL: ₹${totals.total.toLocaleString()}

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
  const response = await fetch('/api/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });
  if (!response.ok) {
    throw new Error('Failed to send proposal email');
  }
  return response.json();
};
