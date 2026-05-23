import { getAllUsers } from './userDatabase';
import { getAllSales } from './salesDatabase';
import { getAllLeads } from './leadDatabase';
import { getAllInvoices } from './invoiceService';
import { ROLES, DEPARTMENT_ROLES } from '../data/mockData';

const graphicsRoles = DEPARTMENT_ROLES['Graphics'] || [];

// Simulated API: GET /assignable-users (Backend + Graphics)
export const getActiveBackendUsers = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const allUsers = getAllUsers();
      const activeBackendUsers = allUsers.filter(u => 
        (u.role === ROLES.BACKEND || graphicsRoles.includes(u.role)) && 
        u.status !== 'Inactive' && 
        u.status !== 'Deleted'
      );
      
      const response = activeBackendUsers.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        department: u.department || 'Development',
        status: u.status || 'active'
      }));
      
      resolve(response);
    }, 400); // simulate network latency
  });
};

// Simulated API: GET /project-client-details/:invoiceId
export const getProjectClientDetails = async (invoiceId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const allInvoices = getAllInvoices();
      const invoice = allInvoices.find(i => i.id === invoiceId);
      
      if (!invoice) {
        return reject(new Error('Invoice not found'));
      }

      const allSales = getAllSales();
      const allLeads = getAllLeads();

      const sale = allSales.find(s => s.id === invoice.saleId);
      const lead = allLeads.find(l => l.id === sale?.leadId) || allLeads.find(l => l.id === invoice.leadId);

      // Merge and return complete client details with requested priority: Lead > Invoice > Sale
      const clientDetails = {
        // Flattened fields for direct component rendering (Lead > Invoice > Sale)
        businessName: lead?.businessName || invoice.client?.businessName || sale?.businessName || 'N/A',
        clientName: lead?.contactName || lead?.name || invoice.client?.contactName || sale?.contactName || sale?.leadName || 'N/A',
        email: lead?.email || invoice.client?.email || sale?.email || 'N/A',
        phone: lead?.ownerPhone || lead?.phone || invoice.client?.phone || sale?.ownerPhone || sale?.phone || 'N/A',
        country: lead?.country || invoice.client?.country || sale?.country || 'N/A',
        address: lead?.address || invoice.client?.addressLine1 || sale?.addressLine1 || 'N/A',
        state: lead?.state || invoice.client?.state || sale?.state || 'N/A',

        // Legacy structures for backwards compatibility
        client: {
          name: lead?.contactName || lead?.name || invoice.client?.contactName || sale?.contactName || sale?.leadName || 'N/A',
          phone: lead?.ownerPhone || lead?.phone || invoice.client?.phone || sale?.ownerPhone || sale?.phone || 'N/A',
          email: lead?.email || invoice.client?.email || sale?.email || 'N/A',
        },
        company: {
          businessName: lead?.businessName || invoice.client?.businessName || sale?.businessName || 'N/A',
          address: lead?.address || invoice.client?.addressLine1 || sale?.addressLine1 || 'N/A',
          country: lead?.country || invoice.client?.country || sale?.country || 'N/A',
          state: lead?.state || invoice.client?.state || sale?.state || 'N/A',
        },
        leadSource: lead?.source || sale?.source || 'Direct',
        invoiceNumber: invoice.invoiceNumber || invoice.id,
        saleId: sale?.id || invoice.saleId || null,
        projectValue: invoice.totalAmount || invoice.amountSummary?.grandTotal || sale?.amount || 0,
        assignedSalesAgent: lead?.assignedTo || invoice.createdBy || sale?.createdBy || null,
        saleDetails: sale || null,
        leadDetails: lead || null,
        invoiceDetails: invoice
      };

      resolve(clientDetails);
    }, 500); // simulate network latency
  });
};
