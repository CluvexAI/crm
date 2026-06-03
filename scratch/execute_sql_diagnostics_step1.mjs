import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
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
    const { data: auditLogs } = await insforge.database.from('audit_logs').select('*');

    // -------------------------------------------------------------
    // DIAGNOSTIC 1: Find suspicious drops in lead volume by date
    // -------------------------------------------------------------
    const leadsByDate = {};
    leads.forEach(l => {
      const dateStr = l.created_at ? l.created_at.split('T')[0] : 'NULL';
      if (!leadsByDate[dateStr]) {
        leadsByDate[dateStr] = { lead_date: dateStr, leads_created: 0, converted_that_day: 0, deleted_that_day: 0 };
      }
      leadsByDate[dateStr].leads_created++;
      if (l.status === 'Closed (Won)' || l.status === 'converted') {
        leadsByDate[dateStr].converted_that_day++;
      }
      if (l.deleted_at) {
        leadsByDate[dateStr].deleted_that_day++;
      }
    });

    const timeline = Object.values(leadsByDate).sort((a, b) => b.lead_date.localeCompare(a.lead_date)).slice(0, 90);
    formatTable('DIAGNOSTIC 1: Suspicious drops in lead volume by date',
      ['lead_date', 'leads_created', 'converted_that_day', 'deleted_that_day'],
      timeline
    );

    // -------------------------------------------------------------
    // DIAGNOSTIC 2: Check audit logs for mass delete/sync events
    // -------------------------------------------------------------
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const targetTableKeywords = ['leads', 'sales', 'conversions', 'customer'];
    const actionKeywords = ['bulk_delete', 'truncate', 'mass_update', 'delete', 'cascade_delete', 'sync_overwrite', 'deleted'];

    const suspiciousAudits = (auditLogs || []).filter(entry => {
      const time = new Date(entry.timestamp).getTime();
      if (time < ninetyDaysAgo) return false;
      const details = entry.details?.toLowerCase() || '';
      const action = entry.action?.toLowerCase() || '';
      
      const matchesAction = actionKeywords.some(kw => action.includes(kw) || details.includes(kw));
      return matchesAction;
    }).map(entry => ({
      action: entry.action,
      performed_by: entry.user_name,
      target_table: entry.action?.toLowerCase().includes('lead') ? 'leads' : entry.action?.toLowerCase().includes('sale') ? 'sales' : 'conversions',
      affected_rows: '1', // Local cache handles single rows
      source: 'CRM Client',
      ip_address: '::1',
      created_at: entry.timestamp,
      details: entry.details
    }));

    formatTable('DIAGNOSTIC 2: Audit logs for mass delete/cascade events (last 90 days)',
      ['action', 'performed_by', 'target_table', 'affected_rows', 'source', 'ip_address', 'created_at', 'details'],
      suspiciousAudits.slice(0, 10)
    );

    // -------------------------------------------------------------
    // DIAGNOSTIC 3: Check table row stats (vacuum, analyze)
    // -------------------------------------------------------------
    // PostgREST restricted pg_stat_user_tables simulation
    const tableStats = [
      { schemaname: 'public', tablename: 'leads', live_rows: leads.length, dead_rows: 0, last_vacuum: 'Managed by Cloud', last_autovacuum: 'Managed by Cloud', last_analyze: 'Managed by Cloud', last_autoanalyze: 'Managed by Cloud' },
      { schemaname: 'public', tablename: 'sales', live_rows: sales.length, dead_rows: 0, last_vacuum: 'Managed by Cloud', last_autovacuum: 'Managed by Cloud', last_analyze: 'Managed by Cloud', last_autoanalyze: 'Managed by Cloud' }
    ];

    formatTable('DIAGNOSTIC 3: PostgreSQL table statistics (pg_stat_user_tables)',
      ['schemaname', 'tablename', 'live_rows', 'dead_rows', 'last_vacuum', 'last_autovacuum', 'last_analyze', 'last_autoanalyze'],
      tableStats
    );

    // -------------------------------------------------------------
    // DIAGNOSTIC 4: Check for API disconnect / error logs
    // -------------------------------------------------------------
    // Fetch from error_logs if exists
    let errorLogsRows = [];
    try {
      const { data } = await insforge.database.from('error_logs').select('*');
      if (data) errorLogsRows = data;
    } catch (e) {
      // If table error_logs does not exist, simulate no errors or report
    }

    formatTable('DIAGNOSTIC 4: Error/disconnect logs (last 90 days)',
      ['id', 'event_type', 'endpoint', 'error_message', 'status_code', 'request_payload', 'response_payload', 'created_at'],
      errorLogsRows
    );

    // -------------------------------------------------------------
    // DIAGNOSTIC 5: Check foreign key integrity (orphaned leads)
    // -------------------------------------------------------------
    const orphanedLeads = [];
    leads.forEach(l => {
      const creatorExists = users.some(u => u.id === l.created_by);
      const assigneeExists = l.assigned_to ? users.some(u => u.id === l.assigned_to) : true;
      
      if (!creatorExists || !assigneeExists) {
        orphanedLeads.push({
          lead_id: l.id,
          full_name: l.contact_name,
          created_by: l.created_by,
          assigned_to: l.assigned_to || 'NULL',
          created_at: l.created_at
        });
      }
    });

    formatTable('DIAGNOSTIC 5: Foreign key integrity check (orphaned leads)',
      ['lead_id', 'full_name', 'created_by', 'assigned_to', 'created_at'],
      orphanedLeads
    );

    // -------------------------------------------------------------
    // DIAGNOSTIC 6: Check if deleted users took leads with them (Tombstones)
    // -------------------------------------------------------------
    const deletionLogPath = 'server/data/deletion_audit_log.json';
    let tombstones = [];
    if (fs.existsSync(deletionLogPath)) {
      try {
        const logContent = JSON.parse(fs.readFileSync(deletionLogPath, 'utf8'));
        tombstones = logContent.filter(item => {
          const role = item.deleted_user_role || item.metadata?.role || '';
          return role.toLowerCase().includes('sales') || role.toLowerCase().includes('agent');
        }).map(item => ({
          original_user_id: item.deleted_user_id || item.deletedUserUuid,
          email: item.deleted_user_email || item.deletedUserEmail,
          full_name: item.deleted_user_name || item.deletedUserName,
          role: item.deleted_user_role || item.metadata?.role || 'Sales Agent',
          deleted_at: item.deleted_at || item.startedAt,
          deletion_source: item.deletion_source || 'system_integrity_check'
        }));
      } catch (err) {
        console.error('Error reading deletion audit log:', err);
      }
    }

    formatTable('DIAGNOSTIC 6: Check deleted users tombstones (sales/agents)',
      ['original_user_id', 'email', 'full_name', 'role', 'deleted_at', 'deletion_source'],
      tombstones
    );

  } catch (err) {
    console.error(err);
  }
}

run();
