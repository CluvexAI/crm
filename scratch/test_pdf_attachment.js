const http = require('http');

// A valid, minimal 1-page PDF file in base64 format
const VALID_BASE64_PDF = "JVBERi0xLjQKJdPr6gogMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCgogID4+CmVuZG9iagoyIDAgb2JqCiAgPDwgL1R5cGUgL1BhZ2VzCiAgICAgL0NvdW50IDEKICAgICAvS2lkcyBbIDMgMCBSIF0KICA+PgplbmRvYmoKMyAwIG9iagogIDw8IC9UeXBlIC9QYWdlCiAgICAgL1BhcmVudCAyIDAgUgogICAgIC9NZWRpYUJveCBbIDAgMCA1OTUuMjggODQxLjg5IF0KICAgICAvQ29udGVudHMgNCAwIFIKICAgICAvUmVzb3VyY2VzIDUgMCBSCgogID4+CmVuZG9iago0IDAgb2JqCiAgPDwgL0xlbmd0aCA4OSA+PgpzdHJlYW0KcSAxIDAgMCAxIDUwIDc1MCBjbSBCVCAvRjEgMjQgVGYgKFRlc3QgUERGIGZvcGF0Y2gpIFRkIEVUIFEKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCiAgPDwgL0ZvbnQKICAgICAgPDwgL0YxIDYgMCBSID4+CiAgPj4KZW5kb2JqCjYgMCBvYmoKICA8PCAvVHlwZSAvRm9udAogICAgIC9TdWJ0eXBlIC9UeXBlMQogICAgIC9CYXNlRm9udCAvSGVsdmV0aWNhCiAgPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDc5IDAwMDAwIG4gCjAwMDAwMDAxNDQgMDAwMDAgbCAKMDAwMDAwMDI5NiAwMDAwMCBuIAowMDAwMDAwNDM3IDAwMDAwIG4gCjAwMDAwMDA0OTggMDAwMDAgbCAKdHJhaWxlcgogIDw8IC9TaXplIDcKICAgICAvUm9vdCAxIDAgUgoKICA+PgpzdGFydHhyZWYKNTcwCiUlRU9GCg==";

const postData = JSON.stringify({
  config: {
    user: 'ehtesham.nasim@zsmeservices.com',
    pass: 'Admin#2026@zsm',
    name: 'ZSM Team'
  },
  mailOptions: {
    to: 'tanmoy.mondal@zsmeservices.com',
    subject: 'Uncorrupted Invoice PDF Attachment Test',
    html: '<h3>Hello!</h3><p>Please find attached your uncorrupted test PDF invoice.</p>',
    text: 'Hello! Please find attached your uncorrupted test PDF invoice.',
    attachments: [
      {
        filename: 'Invoice_Test_Clean.pdf',
        content: VALID_BASE64_PDF
      }
    ]
  },
  userId: 'test-admin-id'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/mail/send',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
