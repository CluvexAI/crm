const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'dns_records.json');

const initDB = async () => {
  try {
    await fs.access(dbPath);
  } catch (err) {
    await fs.writeFile(dbPath, JSON.stringify([]));
  }
};

const getRecords = async () => {
  await initDB();
  const data = await fs.readFile(dbPath, 'utf8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

const saveRecords = async (records) => {
  await fs.writeFile(dbPath, JSON.stringify(records, null, 2));
};

const getAllRecords = async () => {
  return await getRecords();
};

const createRecord = async (recordData) => {
  const records = await getRecords();
  const newRecord = {
    id: uuidv4(),
    admin_id: recordData.admin_id || 'admin',
    name: recordData.name,
    type: recordData.type,
    priority: recordData.priority || null,
    ttl: recordData.ttl || 3600,
    value: recordData.value,
    status: 'Pending',
    verified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  records.push(newRecord);
  await saveRecords(records);
  return newRecord;
};

const updateRecord = async (id, updateData) => {
  const records = await getRecords();
  const index = records.findIndex(r => r.id === id);
  if (index === -1) throw new Error('Record not found');

  records[index] = {
    ...records[index],
    ...updateData,
    updated_at: new Date().toISOString()
  };
  
  // If editing significant fields, maybe reset status to Pending
  if (updateData.name || updateData.value || updateData.type) {
    records[index].status = 'Pending';
    records[index].verified_at = null;
  }

  await saveRecords(records);
  return records[index];
};

const deleteRecord = async (id) => {
  let records = await getRecords();
  records = records.filter(r => r.id !== id);
  await saveRecords(records);
};

const updateRecordStatus = async (id, status) => {
  const records = await getRecords();
  const index = records.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  records[index].status = status;
  if (status === 'Verified') {
    records[index].verified_at = new Date().toISOString();
  }
  await saveRecords(records);
  return records[index];
};

module.exports = {
  getAllRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  updateRecordStatus
};
