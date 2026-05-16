const fs = require('fs');

try {
  let emailPage = fs.readFileSync('src/pages/EmailPage.js', 'utf8');

  if (!emailPage.includes('EmailComposer')) {
    emailPage = emailPage.replace(
      /import \{ useApp \} from '\.\.\/context\/AppContext';/,
      `import { useApp } from '../context/AppContext';\nimport EmailComposer from '../components/EmailComposer';`
    );

    // Replace composeMode render with EmailComposer
    emailPage = emailPage.replace(
      /if \(composeMode\) \{[\s\S]*?return \([\s\S]*?Compose Email[\s\S]*?<\/div>\n    \);\n  \}/,
      `if (composeMode) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease', height: '80vh' }}>
        <EmailComposer 
          currentUser={currentUser}
          onClose={() => setComposeMode(false)}
          onSend={async (emailData) => {
            if (!isConfigured) {
              window.alert('Please configure your email in Profile → Email Settings first.');
              setActivePage('profile');
              return;
            }
            try {
              // The backend API currently accepts sendEmail(to, subject, body).
              // We will pass the fully rendered HTML body which includes the rich text formatting.
              await sendEmail(emailData.to, emailData.subject, emailData.body);
              setComposeMode(false);
              setActiveTab('sent');
              window.alert('✅ Email sent successfully!');
            } catch (error) {
              window.alert('Failed to send email: ' + error.message);
              throw error; // Let composer handle sending state
            }
          }}
          onSaveDraft={(draftData) => {
             // Mock save to drafts using localStorage since the existing API doesn't have drafts yet
             const drafts = JSON.parse(localStorage.getItem('zsm_email_drafts') || '[]');
             drafts.push({ ...draftData, id: Date.now(), createdAt: new Date().toISOString() });
             localStorage.setItem('zsm_email_drafts', JSON.stringify(drafts));
             window.alert('💾 Draft saved successfully!');
             setComposeMode(false);
             setActiveTab('drafts');
          }}
        />
      </div>
    );
  }`
    );

    // Add 'drafts' to activeTab check
    emailPage = emailPage.replace(
      /const userEmails = allEmails.filter\(e => e.userId === currentUser\?\.id\);/,
      `const userEmails = allEmails.filter(e => e.userId === currentUser?.id);
  const drafts = JSON.parse(localStorage.getItem('zsm_email_drafts') || '[]');`
    );

    emailPage = emailPage.replace(
      /const unreadCount = inboxEmails.filter\(e => e.status === 'unread'\).length;/,
      `const unreadCount = inboxEmails.filter(e => e.status === 'unread').length;
  const draftCount = drafts.length;`
    );

    // Update tabs to include Drafts
    emailPage = emailPage.replace(
      /<button \n            className=\{\`btn \$\{activeTab === 'sent' \? 'btn-primary' : 'btn-ghost'\}\`} \n            onClick=\{\(\) => setActiveTab\('sent'\)\}\n          >\n            📤 Sent\n          <\/button>/,
      `<button 
            className={\`btn \${activeTab === 'sent' ? 'btn-primary' : 'btn-ghost'}\`} 
            onClick={() => setActiveTab('sent')}
          >
            📤 Sent
          </button>
          <button 
            className={\`btn \${activeTab === 'drafts' ? 'btn-primary' : 'btn-ghost'}\`} 
            onClick={() => setActiveTab('drafts')}
          >
            📄 Drafts {draftCount > 0 && <span className="badge badge-info">{draftCount}</span>}
          </button>`
    );

    // Update empty state handling for drafts
    emailPage = emailPage.replace(
      /\{\(activeTab === 'inbox' \? inboxEmails : sentEmails\)\.length === 0 \? \(/,
      `{(activeTab === 'inbox' ? inboxEmails : activeTab === 'sent' ? sentEmails : drafts).length === 0 ? (`
    );

    emailPage = emailPage.replace(
      /\{activeTab === 'inbox' \? 'No inbox emails' : 'No sent emails'\}/,
      `{activeTab === 'inbox' ? 'No inbox emails' : activeTab === 'sent' ? 'No sent emails' : 'No saved drafts'}`
    );

    emailPage = emailPage.replace(
      /\{activeTab === 'inbox' \n                  \? 'Click "Sync" to fetch emails or configure your email first.' \n                  : 'Emails you send will appear here.'\}/,
      `{activeTab === 'inbox' 
                  ? 'Click "Sync" to fetch emails or configure your email first.' 
                  : activeTab === 'sent' ? 'Emails you send will appear here.' : 'Your saved drafts will appear here.'}`
    );

    // Update map loop for drafts
    emailPage = emailPage.replace(
      /\{\(activeTab === 'inbox' \? inboxEmails : sentEmails\)\.map\(\(email, idx\) => \(/,
      `{(activeTab === 'inbox' ? inboxEmails : activeTab === 'sent' ? sentEmails : drafts).map((email, idx) => (`
    );

    emailPage = emailPage.replace(
      /\{activeTab === 'inbox' \? '📥 Inbox' : '📤 Sent Emails'\}/,
      `{activeTab === 'inbox' ? '📥 Inbox' : activeTab === 'sent' ? '📤 Sent Emails' : '📄 Drafts'}`
    );

    fs.writeFileSync('src/pages/EmailPage.js', emailPage);
    console.log("EmailPage updated successfully");
  }
} catch (e) {
  console.error(e);
}
