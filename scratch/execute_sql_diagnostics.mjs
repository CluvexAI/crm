import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config();

const INSFORGE_URL = process.env.REACT_APP_INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.REACT_APP_INSFORGE_ANON_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

function formatTable(title, columns, rows) {
  console.log(`\n=== ${title} ===`);
  if (!rows || rows.length === 0) {
    console.log('(No rows returned)');
    return;
  }
  
  // Calculate column widths
  const widths = {};
  columns.forEach(col => {
    widths[col] = col.length;
  });
  
  rows.forEach(row => {
    columns.forEach(col => {
      const val = row[col] === null || row[col] === undefined ? 'NULL' : String(row[col]);
      widths[col] = Math.max(widths[col], val.length);
    });
  });

  // Print header
  const separator = '+' + columns.map(col => '-'.repeat(widths[col] + 2)).join('+') + '+';
  console.log(separator);
  console.log('| ' + columns.map(col => col.padEnd(widths[col])).join(' | ') + ' |');
  console.log(separator);
  
  // Print rows
  rows.forEach(row => {
    console.log('| ' + columns.map(col => {
      const val = row[col] === null || row[col] === undefined ? 'NULL' : String(row[col]);
      return val.padEnd(widths[col]);
    }).join(' | ') + ' |');
  });
  console.log(separator);
}

async function run() {
  try {
    const { data: leads } = await insforge.database.from('leads').select('*');
    const { data: users } = await insforge.database.from('users').select('*');
    const { data: sales } = await insforge.database.from('sales').select('*');

    // QUERY 1: Check total leads currently in database
    const total_leads = leads.length;
    const new_leads = leads.filter(l => l.status === 'New Lead' || l.status === 'new').length;
    const follow_up_leads = leads.filter(l => l.status === 'Follow-Up' || l.status === 'follow_up').length;
    const converted_leads = leads.filter(l => l.status === 'Closed (Won)' || l.status === 'converted').length;
    const closed_leads = leads.filter(l => l.status === 'Closed (Lost)' || l.status === 'closed').length;
    const soft_deleted_leads = leads.filter(l => l.deleted_at !== undefined && l.deleted_at !== null).length;
    
    const createdDates = leads.map(l => new Date(l.created_at)).filter(d => !isNaN(d));
    const oldest_lead = createdDates.length ? new Date(Math.min(...createdDates)).toISOString() : 'NULL';
    const newest_lead = createdDates.length ? new Date(Math.max(...createdDates)).toISOString() : 'NULL';

    formatTable('QUERY 1: Check total leads currently in database', 
      ['total_leads', 'new_leads', 'follow_up_leads', 'converted_leads', 'closed_leads', 'soft_deleted_leads', 'oldest_lead', 'newest_lead'],
      [{
        total_leads,
        new_leads,
        follow_up_leads,
        converted_leads,
        closed_leads,
        soft_deleted_leads,
        oldest_lead,
        newest_lead
      }]
    );

    // QUERY 2: Check leads per sales agent
    const agentRoles = ['sales_agent', 'sales', 'agent', 'Sales Agent'];
    const filteredUsers = users.filter(u => agentRoles.includes(u.role));
    
    const agentLeads = filteredUsers.map(u => {
      const uLeads = leads.filter(l => l.created_by === u.id || l.assigned_to === u.id);
      const leadDates = uLeads.map(l => new Date(l.created_at)).filter(d => !isNaN(d));
      
      return {
        agent_id: u.id,
        agent_name: u.name,
        agent_email: u.email,
        role: u.role,
        agent_status: u.status,
        total_leads: uLeads.length,
        last_lead_created: leadDates.length ? new Date(Math.max(...leadDates)).toISOString() : 'NULL',
        first_lead_created: leadDates.length ? new Date(Math.min(...leadDates)).toISOString() : 'NULL'
      };
    }).sort((a, b) => b.total_leads - a.total_leads);

    formatTable('QUERY 2: Check leads per sales agent',
      ['agent_id', 'agent_name', 'agent_email', 'role', 'agent_status', 'total_leads', 'last_lead_created', 'first_lead_created'],
      agentLeads
    );

    // QUERY 3: Check converted leads linked to sales
    const convertedLeadsList = leads.filter(l => l.status === 'Closed (Won)' || l.status === 'converted');
    const convertedDates = convertedLeadsList.map(l => new Date(l.last_follow_up || l.created_at)).filter(d => !isNaN(d));
    const first_conversion = convertedDates.length ? new Date(Math.min(...convertedDates)).toISOString() : 'NULL';
    const last_conversion = convertedDates.length ? new Date(Math.max(...convertedDates)).toISOString() : 'NULL';

    formatTable('QUERY 3: Check converted leads linked to sales',
      ['total_conversions', 'first_conversion', 'last_conversion'],
      [{
        total_conversions: convertedLeadsList.length,
        first_conversion,
        last_conversion
      }]
    );

    // QUERY 4: Check if sales records exist for converted leads
    const missingSales = [];
    convertedLeadsList.forEach(l => {
      const match = sales.find(s => s.lead_id === l.id);
      if (!match) {
        missingSales.push({
          lead_id: l.id,
          lead_name: l.contact_name,
          status: l.status,
          converted_at: l.last_follow_up || l.created_at,
          sale_id: 'NULL',
          sale_created: 'NULL'
        });
      }
    });

    formatTable('QUERY 4: Check if sales records exist for converted leads',
      ['lead_id', 'lead_name', 'status', 'converted_at', 'sale_id', 'sale_created'],
      missingSales
    );

  } catch (err) {
    console.error(err);
  }
}

run();
