import insforge from './insforgeClient';

const db = insforge.database;

export const api = {
  users: {
    getAll: async () => {
      const { data, error } = await db.from('users').select('*');
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await db.from('users').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (user) => {
      const { data, error } = await db.insert('users', [user]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('users', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id) => {
      const { error } = await db.delete('users').eq('id', id);
      if (error) throw error;
    }
  },

  leads: {
    getAll: async () => {
      const { data, error } = await db.from('leads').select('*');
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await db.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (lead) => {
      const { data, error } = await db.insert('leads', [lead]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('leads', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id) => {
      const { error } = await db.delete('leads').eq('id', id);
      if (error) throw error;
    }
  },

  sales: {
    getAll: async () => {
      const { data, error } = await db.from('sales').select('*');
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await db.from('sales').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (sale) => {
      const { data, error } = await db.insert('sales', [sale]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('sales', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id) => {
      const { error } = await db.delete('sales').eq('id', id);
      if (error) throw error;
    }
  },

  invoices: {
    getAll: async () => {
      const { data, error } = await db.from('invoices').select('*');
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await db.from('invoices').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (invoice) => {
      const { data, error } = await db.insert('invoices', [invoice]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('invoices', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id) => {
      const { error } = await db.delete('invoices').eq('id', id);
      if (error) throw error;
    }
  },

  projects: {
    getAll: async () => {
      const { data, error } = await db.from('projects').select('*');
      if (error) throw error;
      return data;
    },
    getById: async (id) => {
      const { data, error } = await db.from('projects').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (project) => {
      const { data, error } = await db.insert('projects', [project]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('projects', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    },
    delete: async (id) => {
      const { error } = await db.delete('projects').eq('id', id);
      if (error) throw error;
    }
  },

  attendance: {
    getAll: async () => {
      const { data, error } = await db.from('attendance').select('*');
      if (error) throw error;
      return data;
    },
    getByDate: async (date) => {
      const { data, error } = await db.from('attendance').select('*').eq('date', date);
      if (error) throw error;
      return data;
    },
    create: async (record) => {
      const { data, error } = await db.insert('attendance', [record]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('attendance', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    }
  },

  leaveRequests: {
    getAll: async () => {
      const { data, error } = await db.from('leave_requests').select('*');
      if (error) throw error;
      return data;
    },
    create: async (request) => {
      const { data, error } = await db.insert('leave_requests', [request]).select();
      if (error) throw error;
      return data[0];
    },
    update: async (id, updates) => {
      const { data, error } = await db.update('leave_requests', updates).eq('id', id).select();
      if (error) throw error;
      return data[0];
    }
  },

  messages: {
    getAll: async () => {
      const { data, error } = await db.from('messages').select('*');
      if (error) throw error;
      return data;
    },
    getConversation: async (userId1, userId2) => {
      const { data, error } = await db.from('messages')
        .select('*')
        .or(`from_id.eq.${userId1},to_id.eq.${userId1}`)
        .or(`from_id.eq.${userId2},to_id.eq.${userId2}`);
      if (error) throw error;
      return data;
    },
    create: async (message) => {
      const { data, error } = await db.insert('messages', [message]).select();
      if (error) throw error;
      return data[0];
    },
    markAsRead: async (id) => {
      const { data, error } = await db.update('messages', { read: true }).eq('id', id).select();
      if (error) throw error;
      return data[0];
    }
  },

  auditLogs: {
    getAll: async () => {
      const { data, error } = await db.from('audit_logs').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return data;
    },
    create: async (log) => {
      const { data, error } = await db.insert('audit_logs', [log]).select();
      if (error) throw error;
      return data[0];
    }
  }
};

export default api;
