# 📊 Database Setup Guide

This folder contains all the necessary files to create a complete database from scratch for the **Kormo Connect** job marketplace platform.

## 📁 Contents

```
database-setup/
├── 📄 README.md                          ← This file
├── 📄 database-schema.sql                ← Complete database schema (RUN THIS FIRST)
├── 📁 migrations/                        ← Database migration history (31 files)
│   ├── 1761913000_*.sql                 ← All schema changes and updates
│   └── ... (migration files)
└── 📁 cron_jobs/                        ← Automated background jobs (4 jobs)
    ├── job_1.json                       ← Password reset cleanup (2 AM daily)
    ├── job_2.json                       ← Task boost expiry (midnight)
    ├── job_3.json                       ← Worker subscription expiry (midnight)
    └── job_4.json                       ← Subscription status check (midnight)
```

## 🚀 Quick Setup (5 Minutes)

### Option 1: Single File Setup (Recommended)

**FASTEST WAY - Use `database-schema.sql`:**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire content of `database-schema.sql`
4. Paste and execute all SQL statements
5. **Done!** Database is ready.

### Option 2: Migration-Based Setup

**For developers who want to see the database evolution:**

1. Go to Supabase **SQL Editor**
2. Execute each migration file in chronological order:
   ```
   1761913000_fix_get_auth_emails_type.sql       (First)
   1761913012_add_cv_columns_to_profiles.sql     (Second)
   ...
   1765000000_create_feedback_system.sql         (Last)
   ```

## 📋 What's Created

### 🗄️ Database Tables (22+ tables)
- `worker_performance` - Track worker metrics
- `company_performance` - Track company metrics  
- `ratings` - Review and rating system
- `work_history` - Previous work records
- `disputes` - Dispute management
- `worker_availability` - Schedule management
- `skill_verifications` - Skill validation
- `certifications` - Professional certifications
- `contracts` - Work agreements
- `job_applications` - Application tracking
- And many more...

### 🔧 Database Functions
- Authentication functions
- Performance calculation functions
- Matching algorithms
- Analytics functions

### ⚡ Edge Functions (17 functions)
- `analyze-cv` - CV analysis with AI
- `analyze-suitability` - Job-worker matching
- `find-best-matches` - AI-powered matching
- `boost-task` - Task promotion system
- `signup-with-role` - User registration
- `request-password-reset` - Password recovery
- And more...

### ⏰ Automated Cron Jobs
- Daily cleanup tasks
- Subscription management
- Task boost handling
- Password token cleanup

## 🔧 Setup Requirements

### Prerequisites
1. **Supabase Account** - [Create here](https://supabase.com)
2. **New Supabase Project** - [Create project](https://supabase.com/dashboard)
3. **Project URL & API Keys** - From Supabase dashboard

### Environment Variables Needed
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
RESEND_API_KEY=your-resend-api-key
```

## 🎯 Complete Setup Process

### Step 1: Create Supabase Project
```bash
# 1. Go to https://supabase.com
# 2. Create new project
# 3. Get your project URL and keys
```

### Step 2: Set Up Database
```bash
# Method A: Quick (Recommended)
# Copy database-schema.sql content to Supabase SQL Editor and execute

# Method B: Migration-based
# Execute each file in supabase/migrations/ in order
```

### Step 3: Deploy Edge Functions
```bash
# Install Supabase CLI
npm install -g supabase

# Login and deploy
supabase login
supabase functions deploy --project-ref YOUR_PROJECT_ID
```

### Step 4: Set Up Cron Jobs
```bash
# In Supabase SQL Editor, enable pg_cron:
CREATE EXTENSION IF NOT EXISTS pg_cron;

# Then execute the SQL from each cron_jobs/job_*.json file
```

### Step 5: Configure Environment
```bash
# Set environment variables in Supabase:
# Go to Project Settings → Edge Functions → Environment Variables
SUPABASE_URL=your-project-url
GEMINI_API_KEY=your-gemini-key
RESEND_API_KEY=your-resend-key
```

## 🌍 Platform Features

Once set up, your database supports:

### 👥 User Management
- Worker and Company accounts
- Email verification
- Password reset
- Profile management
- Role-based access

### 🎯 Job Marketplace
- Task posting and browsing
- AI-powered matching
- CV analysis and scoring
- Application tracking
- Task boost/promotion system

### 💰 Payment & Subscriptions
- Mock payment processing
- Worker subscription tiers
- Payment preferences
- Transaction history

### ⭐ Reviews & Ratings
- Worker-to-company reviews
- Company-to-worker reviews
- Performance metrics
- Dispute resolution

### 📊 Analytics & Insights
- Platform metrics
- Performance tracking
- Market insights
- User analytics

## 🔒 Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Authentication-based access** policies
- **Secure API endpoints** with proper validation
- **Password reset tokens** with expiration
- **Rate limiting** protection

## 📞 Support

### Common Issues:

**1. "Extension pg_cron not found"**
```sql
-- Enable the extension first:
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**2. "Function does not exist"**
```sql
-- Make sure you've run all migration files in order
-- Or run database-schema.sql which includes all functions
```

**3. "Permission denied"**
```sql
-- Check that your user has proper roles:
-- Make sure you're using the service role key for admin operations
```

## ✅ Verification

After setup, verify everything works:

1. **Test authentication** - Create a test user
2. **Test edge functions** - Call a function from Postman/frontend
3. **Test cron jobs** - Check pg_cron.job_run_details table
4. **Test database access** - Query tables to ensure data flows

---

**🎉 Congratulations!** You now have a complete, production-ready job marketplace database with AI-powered matching, subscription management, and automated workflows.