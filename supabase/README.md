# Migrating from MongoDB to Supabase

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. In **Settings → API**: copy **Project URL** and **service_role** key (not the anon key).

## 2. Run the schema

1. In Supabase Dashboard open **SQL Editor**.
2. Paste and run the contents of `schema.sql` in this folder.
3. This creates tables: `tenants`, `users`, `members`, `payment_history`, `subgroups`, `contribution_types`, `contributions`, `expenditures`, `receipts`, `reminders`, `activity_logs`.

## 3. Backend environment

In `backend/.env` set:

```env
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-existing-jwt-secret
```

Remove or leave `MONGODB_URI` unused when `USE_SUPABASE=true`.

## 4. Data migration (existing MongoDB data)

- **Tenants & users:** Insert into `tenants` and `users` (use UUIDs for ids; map MongoDB `_id` to a new UUID if you need stable references).
- **Per-tenant data:** For each tenant, set `tenant_id` to that tenant’s UUID and insert rows into `members`, `payment_history`, `subgroups`, `contribution_types`, `contributions`, `expenditures`, `receipts`, `reminders`, `activity_logs`.
- **Passwords:** Keep using the same `password_hash` (bcrypt) in the `users` table.

## 5. Implemented with Supabase

- **Config:** `config/supabase.js`, `db/helpers.js`, `db/masterDb.js`, `db/tenantDb.js`
- **Auth:** Login uses Supabase users when `USE_SUPABASE=true`
- **Tenant context:** Middleware loads tenant from Supabase and sets `req.tenantId`
- **Tenant model:** `getTenantModel()` returns a Supabase-backed facade (findById, findOne, create, save)
- **Tenant-scoped models:** `getTenantModels(req)` returns Member, Subgroup, Receipt, etc. backed by Supabase with `tenant_id` filtering
- **Members:** CRUD and list with arrears; Member.create() and member.save() supported

## 6. Controllers still using Mongoose-only patterns

When running with Supabase, these may need updates:

- **Payments:** Recording a payment pushes to `member.paymentHistory` and updates member totals. Supabase uses `payment_history` table and `addPaymentToMember()` in `db/tenantDb.js`; member totals (totalPaid, monthsCovered, lastPaymentDate, arrears) must be updated in the same flow.
- **Contributions, receipts, expenditures, reminders, reports, tenant setup/approval, system:** May use Mongoose-specific APIs (aggregate, populate, etc.). Adapt to use the Supabase tenant models (find, findById, create, update, delete) and manual joins or extra queries where populate was used.

## 7. Switching back to MongoDB

Set `USE_SUPABASE=false` (or omit it) and ensure `MONGODB_URI` (and optionally `MASTER_DB_NAME`) are set. The app will use MongoDB and the existing Mongoose code path.
