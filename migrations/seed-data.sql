-- Seed data for users (Graphics Department)
INSERT INTO users (id, employee_id, name, email, phone, role, department, designation, date_of_joining, salary, shift, blood_group, status, password) VALUES
(7, 'EMP-007', 'Neha Verma', 'neha@zsm.com', '9678901234', 'Graphics Manager', 'Graphics', 'Graphics Manager', '2023-06-01', 65000, '9:00 AM - 6:00 PM', 'B+', 'Active', '$2b$10$placeholder_hashed_password_neha');

-- Seed data for leads
INSERT INTO leads (contact_name, business_name, owner_phone, alt_phone, website, country, address, county, email, business_category, status, created_by, assigned_to, follow_up_result, city, company_type, remarks, created_at, last_follow_up, proposal_type) VALUES
('Rohan Mehta', 'Mehta Textiles', '+917890123456', '+917890123457', 'www.mehtatextiles.com', 'India', '12 Trade Center, Mumbai', 'Maharashtra', 'rohan@mehtatextiles.com', 'Builders', 'Follow-Up', 2, 2, 'Interested in Web Design', 'Mumbai', 'Private Ltd', '[{"text": "Initial contact made", "timestamp": "2026-04-15T10:30:00Z", "by": "Rahul Sharma"}]'::jsonb, '2026-04-15T09:00:00Z', '2026-04-18T14:00:00Z', 'Web Design Plan'),
('Anjali Krishnan', 'AK Restaurants', '+918901234567', NULL, '', 'India', '56 Food Street, Bangalore', 'Karnataka', 'anjali@akrestaurants.com', 'Cleaners', 'New Lead', 2, 2, '', 'Bangalore', 'Proprietorship', '[{"text": "First call made", "timestamp": "2026-04-19T11:00:00Z", "by": "Rahul Sharma"}]'::jsonb, '2026-04-19T10:00:00Z', '2026-04-19T11:00:00Z', 'GMB Plan'),
('Deepak Kumar', 'DK Healthcare', '+919012345678', '+919012345679', 'www.dkhealthcare.com', 'India', '789 Medical Lane, Delhi', 'Delhi', 'deepak@dkhealthcare.com', 'Plumbers', 'Closed (Won)', 5, 5, 'Closed', 'Delhi', 'Private Ltd', '[{"text": "Deal closed for SEO Plan", "timestamp": "2026-04-10T16:00:00Z", "by": "Sneha Gupta"}]'::jsonb, '2026-04-01T09:00:00Z', '2026-04-10T16:00:00Z', 'SEO Plan'),
('Fatima Sheikh', 'Sheikh Boutique', '+918123456789', NULL, '', 'India', '34 Fashion St, Hyderabad', 'Telangana', 'fatima@sheikhboutique.com', 'Blinds & Curtains', 'Pending', 2, 2, 'Thinking', 'Hyderabad', 'Proprietorship', '[{"text": "Sent proposal, awaiting decision", "timestamp": "2026-04-17T13:00:00Z", "by": "Rahul Sharma"}]'::jsonb, '2026-04-12T09:00:00Z', '2026-04-17T13:00:00Z', 'GMB Plan'),
('Prakash Iyer', 'Iyer Law Associates', '+919234567891', NULL, 'www.iyerlaw.com', 'India', '100 Court Road, Chennai', 'Tamil Nadu', 'prakash@iyerlaw.com', 'Fencing Contractors', 'Follow-Up', 5, 5, 'Interested', 'Chennai', 'Partnership', '[{"text": "Very interested", "timestamp": "2026-04-20T10:00:00Z", "by": "Sneha Gupta"}]'::jsonb, '2026-04-16T09:00:00Z', '2026-04-20T10:00:00Z', 'SEO Plan');

-- Seed data for sales
INSERT INTO sales (lead_id, lead_name, business_name, closed_by, closed_by_name, proposal_type, amount, sale_status, payment_status, invoice_status, invoice_id, created_at, installments, paid_installments, installment_plan) VALUES
(3, 'Deepak Kumar', 'DK Healthcare', 5, 'Sneha Gupta', 'SEO Plan', 25000, 'Closed', 'Full Payment', 'Generated', 'INV-2026-001', '2026-04-10T16:00:00Z', 1, 1, '[]'::jsonb),
(1, 'Rohan Mehta', 'Mehta Textiles', 2, 'Rahul Sharma', 'Web Design Plan', 35000, 'Pending', 'Installments', 'Generated', 'INV-2026-002', '2026-04-18T14:00:00Z', 3, 1, '[{"installment_number": 1, "amount": 11666.67, "due_date": "2026-04-18", "status": "paid"}, {"installment_number": 2, "amount": 11666.67, "due_date": "2026-05-18", "status": "pending"}, {"installment_number": 3, "amount": 11666.66, "due_date": "2026-06-17", "status": "pending"}]'::jsonb);

-- Seed data for invoices
INSERT INTO invoices (id, sale_id, lead_name, amount, status, generated_date, due_date, items) VALUES
('INV-2026-001', 1, 'DK Healthcare', 25000, 'Paid', '2026-04-10', '2026-04-25', '[{"description": "SEO Plan - 3 Months", "amount": 25000}]'::jsonb),
('INV-2026-002', 2, 'Mehta Textiles', 35000, 'Pending', '2026-04-18', '2026-05-18', '[{"description": "Web Design Plan", "amount": 35000}]'::jsonb);

-- Seed data for projects
INSERT INTO projects (sale_id, project_name, client_name, assigned_to, assigned_to_name, status, start_date, wp_url, wp_username, wp_password, domain_registrar, domain_username, domain_password, cpanel_user, cpanel_pass, facebook_page, gmail_acc, reports) VALUES
(1, 'DK Healthcare - SEO', 'DK Healthcare', 4, 'Arjun Nair', 'In Progress', '2026-04-12', 'www.dkhealthcare.com/wp-admin', 'admin_dkh', 'encrypted', 'GoDaddy', 'dkh_domain', 'encrypted', 'dkh_cpanel', 'encrypted', 'fb.com/dkhealthcare', 'dkh@gmail.com', '[{"date": "2026-04-13", "timestamp": "2026-04-13T10:30:00Z", "summary": "Completed keyword research", "by": "Arjun Nair", "immutable": true}]'::jsonb),
(2, 'Mehta Textiles - Web Design', 'Mehta Textiles', 4, 'Arjun Nair', 'Planning', '2026-04-20', '', '', '', 'Namecheap', 'mehta_nc', 'encrypted', '', '', '', 'mehtabiz@gmail.com', '[]'::jsonb);

-- Seed data for attendance
INSERT INTO attendance (user_id, user_name, date, login_time, logout_time, breaks, meetings, status) VALUES
(2, 'Rahul Sharma', '2026-04-20', '09:02:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(3, 'Priya Patel', '2026-04-20', '09:10:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(4, 'Arjun Nair', '2026-04-20', '09:05:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(5, 'Sneha Gupta', '2026-04-20', '09:15:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(6, 'Vikram Singh', '2026-04-20', '09:08:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(7, 'Neha Verma', '2026-04-20', '09:00:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(8, 'Rohan Desai', '2026-04-20', '09:12:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(9, 'Kavya Sharma', '2026-04-20', '09:30:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(10, 'Arun Mehta', '2026-04-20', '09:15:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(11, 'Pooja Iyer', '2026-04-20', '09:20:00', NULL, '[]'::jsonb, '[]'::jsonb, 'Present'),
(2, 'Rahul Sharma', '2026-04-19', '09:00:00', '18:02:00', '[{"startTime": "2026-04-19T13:00:00Z", "endTime": "2026-04-19T13:30:00Z", "duration": 1800}]'::jsonb, '[{"startTime": "2026-04-19T15:00:00Z", "endTime": "2026-04-19T15:45:00Z", "duration": 2700, "title": "Client Call"}]'::jsonb, 'Present'),
(3, 'Priya Patel', '2026-04-19', '09:05:00', '17:55:00', '[]'::jsonb, '[]'::jsonb, 'Present');

-- Seed data for leave_requests
INSERT INTO leave_requests (user_id, user_name, type, date, reason, status, applied_on) VALUES
(2, 'Rahul Sharma', 'Full Day', '2026-04-25', 'Personal work', 'Pending', '2026-04-20'),
(5, 'Sneha Gupta', 'Half Day', '2026-04-22', 'Medical appointment', 'Approved', '2026-04-19');

-- Seed data for messages
INSERT INTO messages (from_id, to_id, from_name, to_name, message, timestamp, read) VALUES
(1, 2, 'Admin User', 'Rahul Sharma', 'Great work on the DK Healthcare deal!', '2026-04-20T09:30:00Z', true),
(2, 1, 'Rahul Sharma', 'Admin User', 'Thank you! Working on Mehta Textiles proposal now.', '2026-04-20T09:35:00Z', true),
(3, 2, 'Priya Patel', 'Rahul Sharma', 'Reminder: attendance review this Friday.', '2026-04-20T10:00:00Z', false);

-- Seed data for audit_logs
INSERT INTO audit_logs (action, user_name, timestamp, details) VALUES
('User Login', 'Admin User', '2026-04-20T08:55:00Z', 'Successful login'),
('Lead Created', 'Rahul Sharma', '2026-04-20T09:10:00Z', 'Lead: Anjali Krishnan (AK Restaurants)'),
('Sale Closed', 'Sneha Gupta', '2026-04-20T09:45:00Z', 'Sale #2 - Web Design Plan - ₹35,000'),
('Invoice Generated', 'Vikram Singh', '2026-04-20T10:00:00Z', 'INV-2026-002 for Mehta Textiles'),
('Project Assigned', 'Admin User', '2026-04-20T10:15:00Z', 'Project: Mehta Textiles assigned to Arjun Nair');