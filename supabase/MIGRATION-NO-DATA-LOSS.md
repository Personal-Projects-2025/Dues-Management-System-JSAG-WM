# Migrate to Supabase Without Data Loss

You can move to Supabase **without losing any MongoDB data**. MongoDB stays untouched until you are fully happy with Supabase. Follow these steps in order.

---

## Phase 1: Keep Using MongoDB (now)

- **Do nothing to your current app.** Keep `USE_SUPABASE=false` (or unset) in `.env`.
- All data stays in MongoDB. No Supabase account is required yet.
- When you’re ready to try Supabase, continue to Phase 2.

---

## Phase 2: Create Supabase (when ready)

1. **Create a Supabase account**
   - Go to [supabase.com](https://supabase.com) and sign up (free tier is enough).

2. **Create a new project**
   - Dashboard → **New project**
   - Pick organization, name, database password, region.
   - Wait until the project is ready.

3. **Run the schema in Supabase**
   - In the Supabase dashboard, open **SQL Editor**.
   - Open `backend/supabase/schema.sql` from this repo.
   - Copy its full contents into the editor and **Run**.
   - This creates all tables (tenants, users, members, etc.). No data is imported yet.

4. **Get your Supabase keys**
   - In the dashboard: **Settings** → **API**.
   - Copy:
     - **Project URL** (e.g. `https://xxxx.supabase.co`)
     - **service_role** key (under “Project API keys”) — not the `anon` key.

5. **Add keys to `.env` (still use MongoDB)**
   - In `backend/.env` add:
     ```env
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     ```
   - **Leave `USE_SUPABASE=false`** (or do not set it). The app keeps using MongoDB.

---

## Phase 3: Copy data (MongoDB → Supabase)

This step **only copies** data. It does **not** delete or change anything in MongoDB.

1. **Ensure**
   - MongoDB is running and `.env` has `MONGODB_URI` (and `MASTER_DB_NAME` if you use it).
   - Supabase project exists, schema has been run, and `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in `.env`.

2. **Run the migration script** (from the `backend` folder):
   ```bash
   cd backend
   node scripts/migrateMongoToSupabase.js
   ```
   - The script reads from MongoDB and inserts into Supabase.
   - It creates new UUIDs in Supabase; it does not modify or delete MongoDB data.

3. **Check the result**
   - In Supabase: **Table Editor** — confirm `tenants`, `users`, and tenant tables have rows.
   - Compare counts with your MongoDB collections if you want.

---

## Phase 4: Switch the app to Supabase

1. **Switch env**
   - In `backend/.env` set:
     ```env
     USE_SUPABASE=true
     ```
   - Restart the backend.

2. **Test the app**
   - Log in, open tenants, members, payments, etc.
   - If something is wrong, set `USE_SUPABASE=false` again and restart — you’re back on MongoDB with all data still there.

3. **Optional: keep MongoDB as backup**
   - Leave MongoDB running and untouched for a while.
   - When you’re confident, you can stop using MongoDB (e.g. stop the server, archive the DB). Data in Supabase is already a full copy.

---

## Summary

| Step | What happens | Data loss? |
|------|----------------|------------|
| Phase 1 | Keep using MongoDB | No |
| Phase 2 | Create Supabase, run schema, add keys | No (MongoDB unchanged) |
| Phase 3 | Run `migrateMongoToSupabase.js` | No (only copies; MongoDB unchanged) |
| Phase 4 | Set `USE_SUPABASE=true` and use app | No (Supabase has a full copy) |

**If you don’t have a Supabase account yet:** stay on Phase 1. Create the account and project when you’re ready, then do Phases 2–4. Your MongoDB data is not touched until you run the migration script, and the script only **adds** data to Supabase; it does not delete from MongoDB.
