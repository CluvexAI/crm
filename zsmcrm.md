Here is your PRD converted into a **clean, AI-agent-friendly `.md` format**, optimized for tools like Claude, Gemini, or any coding agent to parse and implement.

---

```md
# 📘 PRODUCT REQUIREMENT DOCUMENT (PRD)
## RBAC CRM for Internal Office Use

---

# 1. 📌 Product Overview

**Product Name:** Internal RBAC CRM  

**Purpose:**  
A centralized CRM to manage:
- Employees
- Leads
- Sales
- Backend Projects
- HR Operations
- Internal Communication  

With strict **Role-Based Access Control (RBAC)**.

---

# 2. 👥 Primary Users

- Admin
- Sales Agents / Web Consultants
- Backend Team
- HR Manager
- Accounts Team
- Support Team
- Quality Personnel
- Trainees / Employees

---

# 3. 🎨 UI/UX REQUIREMENTS

## Theme Colors
- Primary: `#0E5491`
- Secondary: `#50C1DF`
- Background: `#FFFFFF`

## Global Header (All Users)
- Current Date
- Current Day
- Real-Time Clock (HH:MM:SS)
- Logged-in Session Duration (Hours & Minutes)

---

# 4. 🔐 ROLE-BASED ACCESS CONTROL (RBAC)

## Core Rule
All modules, fields, and data are controlled via Admin-defined permissions.

## Roles
- Admin (Full Access)
- HR
- Sales Agent / Web Consultant
- Backend User
- Accounts
- Support
- Quality
- Trainee

## Permission Types
- Create
- Read
- Update
- Delete
- Assign / Transfer
- View Restricted Data

---

# 5. 👤 USER MANAGEMENT MODULE

## Admin Capabilities
- Create User
- Edit User
- Delete User
- Assign Role
- Assign Department
- Grant/Revoke Permissions
- Control Data Visibility

---

## User Profile Fields

### Basic Info
- Employee ID
- Name
- Email (Username)
- Phone Number
- WhatsApp Number
- Home Address

### Personal Info
- Father’s Name
- Mother’s Name
- Blood Group
- Food Preference (Veg / Non-Veg)
- Hobbies
- Photo Upload

### Professional Info
- Qualification (Multiple)
- Experience (Multiple)
- Designation
- Department
- Date of Joining
- Shift Timing
- Salary Offered

### Identification
- PAN
- Aadhaar Number
- Voter ID

### Emergency
- Emergency Contact Number

### Local Info
- Local Police Station
- Local Post Office

### Other
- Referred By

---

## Actions
- Save
- Edit
- Submit

---

## Authentication
- Username = Email
- Password (Changeable)
- Date of Joining (Required)

---

# 6. 🧑‍💼 HR MODULE

## Attendance Tracking
- Login Time / Date
- Logout Time / Date
- Break In / Out
- Meeting Time

## Leave Management
- Leave Application Form
- Half-Day Application

## Leave Rule
- Eligible after 12 months
- 1 Paid Leave (Tuesday–Thursday only)

---

# 7. 📞 LEAD MANAGEMENT MODULE

## Lead Fields
- Contact Person Name
- Business Name
- Owner Phone (Unique)
- Alternate Phone
- Website
- Country
- Address
- County
- Email
- Business Category

---

## Validation Logic
- Phone Number = Unique Key

IF phone exists:
- Check Last Follow-Up Date
  - < 30 days → BLOCK
  - ≥ 30 days → ALLOW

---

## Lead Visibility
- Only visible to creator
- Hidden from other agents

---

## Additional Fields
- Follow-up Result
- Target Area
- Company Type
- Call Transfer To
- Remarks (Multiple, Timestamped)

---

## Actions
- Save
- Edit
- View

---

# 8. 🔁 LEAD LIFECYCLE

- New Lead
- Follow-Up
- Pending
- Closed (Won)
- Closed (Lost)
- Expired (30 Days No Activity)

---

# 9. 💰 SALES MODULE

## Proposal Types
- GMB Plan
- SEO Plan
- Web Design Plan
- SEM Plan
- Google Ads Plan
- Graphic Design Plan
- Website Management Plan
- Logo Design Plan
- Visiting Card Design Plan
- Review Scanner
- GMB Support Plan
- E-commerce Plan

---

## Sales Fields
- Closed By
- Lead Status
- Sale Status (Closed / Pending)
- Payment Status:
  - Full Payment
  - Installments (1–12)
- Invoice Status:
  - Generated
  - Cancelled

---

## Payment Integration
- Stripe

---

# 10. 🧾 INVOICE MODULE

- Generate Invoice
- Link to Sale
- Track Payment

## Status
- Paid
- Pending
- Cancelled

---

# 11. 🔄 PROJECT HANDOVER MODULE

## Trigger
- Lead → Converted to Sale

## Flow
- Auto-create Project
- Assign Backend User

---

## Project Fields
- WordPress URL
- WP Username
- Domain Registrar
- Domain Username & Password
- CPanel Credentials
- Facebook Credentials
- YouTube Credentials
- Instagram Credentials
- Gmail Credentials

---

## Access Rule
- Only assigned Backend User can view

---

# 12. 🧑‍💻 BACKEND MODULE

## Features
- View Assigned Projects
- Daily Reporting

## Rule
- Reports are immutable (No Edit after Save)

---

# 13. 💬 INTERNAL CHAT

- One-to-One Chat
- Group Chat
- File Sharing (Images, Documents)

---

# 14. 📧 EMAIL INTEGRATION

- Access Email inside CRM
- Send Proposals
- Track Email History

---

# 15. 🔒 ACCESS CONTROL RULES

## Sales Agents
- View only their leads

## Backend Users
- View only assigned projects

## HR
- Full employee + attendance access

## Admin
- Full system control

---

# 16. 🔁 DATA FLOW

1. Admin creates user  
2. Sales creates lead  
3. Lead validated  
4. Follow-ups tracked  
5. Lead converted → Sale  
6. Invoice generated  
7. Payment processed  
8. Project created  
9. Assigned to backend  
10. Backend reports progress  
11. HR tracks attendance  

---

# 17. ⚙️ SYSTEM RULES

- Unique Phone Number (Lead)
- 30-Day Expiry Logic
- Immutable Reports
- RBAC Enforcement
- Mandatory Fields Validation

---

# 18. 📊 DASHBOARDS

## Admin
- Total Users
- Active Leads
- Revenue
- Performance

## Sales
- My Leads
- Follow-ups
- Conversions

## Backend
- Assigned Projects

## HR
- Attendance
- Leave Requests

---

# 19. 🔒 SECURITY

- Password Encryption
- Role-based API Access
- Audit Logs
- Encrypted Sensitive Data
- Masked Credentials in UI

---

# 20. 🚨 RISKS

Sensitive Data:
- Social Media Passwords
- Aadhaar / PAN

## Requirements
- Encrypt at Rest
- Log Access
- Mask in UI

---

# 21. 🚀 FUTURE ENHANCEMENTS

- Mobile App
- AI Lead Scoring
- Auto Follow-Up Reminders
- WhatsApp API Integration
- Performance Analytics

---

# ✅ SUMMARY

This system is a combined:

- CRM (Leads & Sales)
- HRMS (Employees & Attendance)
- PMS (Project Management)
- Communication System
- Billing System

---

# 📦 END OF DOCUMENT
```



