const { ImapFlow } = require('imapflow');

const config = {
  host: 'mail.zsmeservices.com',
  port: 993,
  secure: true,
  auth: {
    user: 'admin@zsmeservices.com',
    pass: 'Admin#2026@zsm'
  },
  tls: { rejectUnauthorized: false }
};

async function listFolders() {
  const client = new ImapFlow(config);
  try {
    await client.connect();
    const folders = await client.list();
    console.log('Folders:', JSON.stringify(folders, null, 2));
    
    for (const folder of folders) {
        const status = await client.status(folder.path, {messages: true, unseen: true});
        console.log(`Folder ${folder.path}: ${status.messages} messages, ${status.unseen} unseen`);
    }

    await client.logout();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listFolders();
