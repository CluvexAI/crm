import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

async function inspect() {
  try {
    console.log("=== LEADS ===");
    const { data: leads, error: errLeads } = await insforge.database.from('leads').select('*');
    if (errLeads) console.error("Error leads:", errLeads);
    else console.log(`Leads count: ${leads?.length}, first record:`, leads?.[0]);

    console.log("\n=== SALES ===");
    const { data: sales, error: errSales } = await insforge.database.from('sales').select('*');
    if (errSales) console.error("Error sales:", errSales);
    else console.log(`Sales count: ${sales?.length}, first record:`, sales?.[0]);

    console.log("\n=== INVOICES ===");
    const { data: invoices, error: errInvoices } = await insforge.database.from('invoices').select('*');
    if (errInvoices) console.error("Error invoices:", errInvoices);
    else console.log(`Invoices count: ${invoices?.length}, first record:`, invoices?.[0]);

    console.log("\n=== CUSTOMERS ===");
    const { data: customers, error: errCustomers } = await insforge.database.from('customers').select('*');
    if (errCustomers) console.error("Error customers:", errCustomers);
    else console.log(`Customers count: ${customers?.length}, first record:`, customers?.[0]);

  } catch (err) {
    console.error("Crash:", err);
  }
}
inspect();
