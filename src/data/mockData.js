// Mock data store for ZSM CRM

export const ROLES = {
  ADMIN: 'Admin',
  HR: 'HR',
  SALES: 'Sales Agent',
  BACKEND: 'Backend User',
  ACCOUNTS: 'Accounts',
  SUPPORT: 'Support',
  QUALITY: 'Quality',
  TRAINEE: 'Trainee',
  GRAPHICS_MANAGER: 'Graphics Manager',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_GRAPHIC_DESIGNER: 'Junior Graphic Designer',
  VIDEO_EDITOR: 'Video Editor',
  MOTION_GRAPHIC_DESIGNER: 'Motion Graphic Designer',
};

export const DEPARTMENTS = ['Sales', 'Backend', 'HR', 'Accounts', 'Support', 'Quality', 'Management', 'Graphics'];

export const DEPARTMENT_ROLES = {
  Sales: [ROLES.SALES, ROLES.TRAINEE],
  Backend: [ROLES.BACKEND, ROLES.TRAINEE],
  HR: [ROLES.HR],
  Accounts: [ROLES.ACCOUNTS],
  Support: [ROLES.SUPPORT],
  Quality: [ROLES.QUALITY],
  Management: [ROLES.ADMIN, ROLES.HR, ROLES.ACCOUNTS],
  Graphics: [
    ROLES.GRAPHICS_MANAGER,
    ROLES.GRAPHIC_DESIGNER,
    ROLES.JUNIOR_GRAPHIC_DESIGNER,
    ROLES.VIDEO_EDITOR,
    ROLES.MOTION_GRAPHIC_DESIGNER,
  ],
};

export const PROPOSAL_TYPES = [
  'GMB Plan', 'SEO Plan', 'Web Design Plan', 'SEM Plan', 'Google Ads Plan',
  'Graphic Design Plan', 'Website Management Plan', 'Logo Design Plan',
  'Visiting Card Design Plan', 'Review Scanner', 'GMB Support Plan', 'E-commerce Plan',
];

export const LEAD_STATUSES = ['New Lead', 'Follow-Up', 'Pending', 'Closed (Won)', 'Closed (Lost)', 'Expired'];

export const BUSINESS_CATEGORIES = [
  'Air Conditioning', 'Aircon Installation', 'Asbestos Removal', 'Bathroom', 'Blinds & Curtains',
  'Bricklayers', 'Builders', 'Building Certifiers', 'Building Inspectors', 'Cabinet Makers',
  'Carpenters', 'Carpet Repair', 'Carports & Garages', 'Cleaners', 'Cladding',
  'Concrete Resurfacing', 'Concreters', 'Deck Builders', 'Demolition', 'Dishwasher Repair',
  'Door Installers', 'Draftsmen', 'Electricians', 'Fence Builders', 'Fencing Contractors',
  'Floor Sanding', 'Fly Screens', 'Flyscreen Repair', 'Furniture Removalists', 'Garden Clean Up',
  'Garden Landscapers', 'Gardeners', 'Gas Fitters', 'Glass Glaziers', 'Gutter Cleaning',
  'Gutter Installation', 'Gutter Repair', 'Handymen', 'Home Renovators', 'House Painters',
  'IKEA Kitchens', 'Insulation', 'Lawn Mowing', 'New Carpet', 'New Doors',
  'Oven Repair', 'Patio Builders', 'Pergola Builders', 'Pest Control', 'Plasterers',
  'Plumbers', 'Pool Fence Installers', 'Pool Resurfacing', 'Pavers', 'Removalists',
  'Renderers', 'Renovation Builders', 'Restumping', 'Retaining Walls', 'Roof Repairs',
  'Roofing', 'Rubbish Removal', 'Shower Screens', 'Skylights', 'Structural Engineers',
  'Surveyors', 'Synthetic Grass', 'Timber Fencing', 'Tiling', 'Tree Arborists',
  'Upholstery Repair', 'Verandah Builders', 'Waterproofing', 'Window Installation', 'Window Repairs',
  'Others',
];

// ─────────────────────────────────────────────────────────────────────────────
// ALL DATA ARRAYS ARE INTENTIONALLY EMPTY
// Real data lives exclusively in InsForge cloud DB:
//   users    → InsForge: users table (UUID primary keys)
//   leads    → InsForge: crm_leads table (UUID agent IDs, no FK)
//   sales    → InsForge: sales table
//   invoices → InsForge: invoices table
//
// Do NOT add mock/demo data here. All records are created through the CRM UI
// and persist in InsForge. Local mock data caused duplicate user/lead issues.
// ─────────────────────────────────────────────────────────────────────────────

export const users         = [];
export const leads         = [];
export const sales         = [];
export const invoices      = [];
export const projects      = [];
export const attendance    = [];
export const leaveRequests = [];
export const messages      = [];
export const auditLogs     = [];
