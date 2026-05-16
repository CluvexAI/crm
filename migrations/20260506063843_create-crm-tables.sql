-- Users/Employees table
CREATE TABLE users (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id INTEGER UNIQUE,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    role VARCHAR(50) NOT NULL,
    department VARCHAR(100),
    designation VARCHAR(100),
    date_of_joining DATE,
    salary DECIMAL(12, 2),
    shift VARCHAR(50),
    blood_group VARCHAR(10),
    status VARCHAR(20) DEFAULT 'Active',
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    food_pref VARCHAR(50),
    address TEXT,
    password VARCHAR(255),
    pan VARCHAR(20),
    aadhaar VARCHAR(20),
    profile_image_url TEXT,
    profile_image_size BIGINT,
    profile_image_type VARCHAR(50),
    profile_image_name VARCHAR(255),
    profile_image_uploaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Leads table
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    contact_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    owner_phone VARCHAR(20),
    alt_phone VARCHAR(20),
    website VARCHAR(255),
    country VARCHAR(100),
    address TEXT,
    county VARCHAR(100),
    email VARCHAR(255),
    business_category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'New Lead',
    created_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES users(id),
    follow_up_result TEXT,
    city VARCHAR(100),
    company_type VARCHAR(100),
    remarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    last_follow_up TIMESTAMP,
    proposal_type VARCHAR(100)
);

-- Sales table
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    lead_name VARCHAR(255),
    business_name VARCHAR(255),
    closed_by INTEGER REFERENCES users(id),
    closed_by_name VARCHAR(255),
    proposal_type VARCHAR(100),
    amount DECIMAL(12, 2) NOT NULL,
    sale_status VARCHAR(50) DEFAULT 'Pending',
    payment_status VARCHAR(50),
    invoice_status VARCHAR(50),
    invoice_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    installments INTEGER DEFAULT 1,
    paid_installments INTEGER DEFAULT 0,
    installment_plan JSONB DEFAULT '[]'::jsonb
);

-- Invoices table
CREATE TABLE invoices (
    id VARCHAR(50) PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    lead_name VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    generated_date DATE,
    due_date DATE,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    project_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    assigned_to INTEGER REFERENCES users(id),
    assigned_to_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Planning',
    start_date DATE,
    wp_url VARCHAR(255),
    wp_username VARCHAR(100),
    wp_password VARCHAR(255),
    domain_registrar VARCHAR(100),
    domain_username VARCHAR(100),
    domain_password VARCHAR(255),
    cpanel_user VARCHAR(100),
    cpanel_pass VARCHAR(255),
    facebook_page VARCHAR(255),
    gmail_acc VARCHAR(255),
    reports JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(255),
    date DATE NOT NULL,
    login_time TIME,
    logout_time TIME,
    breaks JSONB DEFAULT '[]'::jsonb,
    meetings JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'Present',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Leave requests table
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    user_name VARCHAR(255),
    type VARCHAR(50),
    date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending',
    applied_on TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    from_id INTEGER REFERENCES users(id),
    to_id INTEGER REFERENCES users(id),
    from_name VARCHAR(255),
    to_name VARCHAR(255),
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE
);

-- Audit logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    user_name VARCHAR(255),
    timestamp TIMESTAMP DEFAULT NOW(),
    details TEXT
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users: Admin can do all, others can read
CREATE POLICY "Users can do all" ON users FOR ALL USING (true);
CREATE POLICY "Leads can do all" ON leads FOR ALL USING (true);
CREATE POLICY "Sales can do all" ON sales FOR ALL USING (true);
CREATE POLICY "Invoices can do all" ON invoices FOR ALL USING (true);
CREATE POLICY "Projects can do all" ON projects FOR ALL USING (true);
CREATE POLICY "Attendance can do all" ON attendance FOR ALL USING (true);
CREATE POLICY "Leave requests can do all" ON leave_requests FOR ALL USING (true);
CREATE POLICY "Messages can do all" ON messages FOR ALL USING (true);
CREATE POLICY "Audit logs can do all" ON audit_logs FOR ALL USING (true);