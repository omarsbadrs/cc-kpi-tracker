# Moving the CC KPI Tracker to another database or Vercel account

This guide covers two separate moves. You can do either one on its own:

- **Part A:** move the data to another database. This can be a new Supabase project, a Supabase project on another account, or any PostgreSQL server.
- **Part B:** move hosting to a Vercel project on another account.

If you do both, do Part A first, then Part B. That way the new Vercel project is configured once, against the new database.

> **Warning: production data.** The current database holds real employee scores and audit logs. Never run `prisma db seed`, `prisma db push --force-reset` or `prisma migrate reset` against it. Each section below says which database a command touches.

---

## How the app is wired

| Piece | What it is | Where it's set |
|---|---|---|
| Database | PostgreSQL 17, reached through Prisma | `DATABASE_URL`, `DIRECT_URL` |
| Schema | `prisma/schema.prisma`, applied with `prisma db push` (there's no migrations folder) | — |
| File uploads | Supabase Storage bucket `kpi-evidence`, used only by `/api/upload` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Sign-in | NextAuth v5 (email and password, checked against the `users` table) | `NEXTAUTH_URL`, `NEXTAUTH_SECRET` |
| Hosting | Vercel, Next.js preset. A push to `master` on GitHub deploys to production. | Vercel project settings |
| Source | GitHub `omarsbadrs/cc-kpi-tracker`, branch `master` | — |

**Environment variables the app reads.** There are 10, and all of them are needed in production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooled connection used at runtime (see A.2) |
| `DIRECT_URL` | Direct or session connection, used by Prisma CLI commands |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key. **Server-only.** |
| `NEXTAUTH_URL` | The site's public address, for example `https://cc-kpi-tracker.vercel.app` |
| `NEXTAUTH_SECRET` | A random secret: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_NAME` | `CC KPI Tracker` |
| `NEXT_PUBLIC_COMPANY_NAME` | `Elsewedy Electric` |
| `LOG_LEVEL` | `info` |

`AUTH_SECRET` is optional. The app falls back to `NEXTAUTH_SECRET`.

### Two traps that have already caused problems

1. **Hidden newlines in Vercel values.** Running `echo value | vercel env add …` (or pasting with a line break) saves a newline as part of the value. That breaks URLs and keys without any visible sign. Set values in the Vercel dashboard, or use `vercel env add NAME production --value "..." --force`. Never pipe a value in.
2. **Office networks block database ports.** Some networks block outbound TCP 5432 and 6543. If the Prisma commands time out with *"Can't reach database server"*, switch to another network (home Wi-Fi, a phone hotspot, or a VPN) before suspecting the database.

---

## Part A: Move to another database

### A.1 Create the new database

**Option 1: a new Supabase project (recommended).** Uploads keep working with no code changes.

1. Go to supabase.com/dashboard → **New project**, signed in to the account that should own it.
2. Pick the region closest to the users (the current one is `eu-west-1`) and set a strong database password. Save the password; you need it below.
3. Wait until the project shows **Active**.

**Option 2: any other PostgreSQL 15 or newer** (Azure Database for PostgreSQL, AWS RDS, Neon, or a company server).

- The app runs fine on it.
- **File uploads still need a Supabase project for Storage.** Keep a Supabase project only for the `kpi-evidence` bucket (A.6), or change `src/lib/file-storage.ts` to another storage service.
- Make sure the Vercel servers can reach the database. Allow inbound connections from the internet, or use a provider with a public endpoint and SSL.

### A.2 Build the two connection strings

For Supabase, go to **Project Settings → Database → Connection string**:

| Variable | Which string | Port | Notes |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** | `6543` | Append `?pgbouncer=true`. For local development, `&connection_limit=10&pool_timeout=20` stops parallel requests timing out. |
| `DIRECT_URL` | **Session pooler** | `5432` | Used by Prisma CLI commands. The "Direct connection" host is IPv6-only, so prefer the session pooler. |

Example (placeholders, not real values):

```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres"
```

If the password contains `@`, `:`, `/`, `?`, `#` or `%`, URL-encode it (`@` → `%40`, `#` → `%23`).

For any other PostgreSQL server, use the same URL for both variables. Add `?sslmode=require` if the server requires SSL, and leave out `pgbouncer=true` unless a PgBouncer sits in front of it.

### A.3 Create the tables in the new database

Run this from the project folder after `npm install`.

**Gotcha:** `prisma.config.ts` loads **`.env`, not `.env.local`**. Set the two URLs in the shell for these commands.

PowerShell:

```powershell
$env:DATABASE_URL = "<new DATABASE_URL>"
$env:DIRECT_URL   = "<new DIRECT_URL>"
npx prisma db push      # creates every table from prisma/schema.prisma in the NEW database
npx prisma generate
```

bash:

```bash
export DATABASE_URL="<new DATABASE_URL>" DIRECT_URL="<new DIRECT_URL>"
npx prisma db push && npx prisma generate
```

Expected output: *"Your database is now in sync with your Prisma schema."*

### A.4 Copy the data

Pick one route.

**Route 1: copy everything from the old database (keeps all history).**

Use PostgreSQL 17 client tools (`pg_dump` and `pg_restore` must be at least the server's version, which is 17.6). Use the **session** connection (port 5432) for both ends.

```bash
# 1. Data only, from the OLD database (read-only on the old side)
pg_dump "<OLD DIRECT_URL>" --data-only --schema=public \
  --no-owner --no-privileges --format=custom --file=kpi-data.dump

# 2. Load into the NEW database (tables already created in A.3)
pg_restore --dbname="<NEW DIRECT_URL>" --data-only --no-owner --no-privileges \
  --disable-triggers kpi-data.dump
```

- If `--disable-triggers` is refused because the role isn't a superuser, run the restore without it. If foreign-key errors appear, restore table by table with `-t <table>` in this order: companies, departments, users, pillars, kpi_definitions, kpi_targets, sub_kpi_weights, pillar_weights, alpha_configs, eval_periods, kpi_assignments, kpi_actuals, evidence_files, score_snapshots, team_members, notifications, audit_logs, password_history, password_reset_tokens.
- Without the command-line tools, use Supabase's own **Database → Backups** download (Pro plan), or ask Claude Code to run the copy.
- Check the copy by comparing row counts. Run this on both the old and the new database; the numbers must match.

```sql
select 'users', count(*) from users union all
select 'kpi_definitions', count(*) from kpi_definitions union all
select 'kpi_actuals', count(*) from kpi_actuals union all
select 'score_snapshots', count(*) from score_snapshots union all
select 'audit_logs', count(*) from audit_logs;
```

**Route 2: start empty, with the KPI framework and demo accounts.**

Only for a brand-new, empty database. This writes the 6 pillars, the 31 KPIs, all targets and weights, and the seeded people.

```powershell
npx prisma db seed      # NEW database only. Never run this on a database that has real data.
```

Seeded passwords are listed in `prisma/seed.ts`. Change them after the first sign-in.

### A.5 Point the app at the new database

**Local:** in `.env.local`, replace `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Then restart `npm run dev`; the database client is created once, at start-up.

**Vercel:** go to **Project → Settings → Environment Variables → Production** and update the same five values. Then redeploy: **Deployments → … → Redeploy**, or push any commit. Changed variables only take effect in a new deployment.

### A.6 File storage (Supabase Storage)

In the Supabase project that serves Storage:

1. Go to **Storage → New bucket**.
   - Name: `kpi-evidence`.
   - **Public:** off.
   - File size limit: 50 MB.
2. Under **Allowed MIME types**, enter: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, application/vnd.openxmlformats-officedocument.presentationml.presentation, image/png, image/jpeg, application/zip`.
3. If you are moving existing files from an old project, download them from the old bucket and upload them into the same paths in the new one. The paths are stored in the `evidence_files` table and must not change.

The app uploads with the service-role key on the server, so the bucket needs no public policies.

> As of 18 Oct 2026, the bucket did **not** exist in the original project (`KPI_CC`), and there were no evidence files yet. Create it there too if uploads should work before the move.

### A.7 Verify

1. Open `https://<site>/api/health`. It should show `"status":"healthy","database":"connected"`.
2. Sign in as an admin. The Department overview should show the expected people and scores.
3. Open **My KPIs → a KPI** and upload a small PDF as evidence. This tests Storage.
4. Leave the old database untouched for at least a week as a fallback. To roll back, put the old values back into the five variables and redeploy.

---

## Part B: Move hosting to a Vercel project on another account

### B.1 Choose how to move

| Method | Keeps environment variables, domains and history | Use when |
|---|---|---|
| **Transfer the project** | Yes | Both accounts are reachable: the new owner is a Vercel team you're a member of, or you can invite yourself |
| **New project from the GitHub repo** | No, you set them up again | The new account is completely separate |

#### Method 1: Transfer (simplest)

1. In the current account, go to **Project `cc-kpi-tracker` → Settings → General → Transfer Project**.
2. Choose the destination and confirm. You must be a member of the receiving team; if it isn't offered, invite yourself to it first. Vercel's docs list any plan limits.
3. In the new team, check **Settings → Git**. The project must still be connected to `omarsbadrs/cc-kpi-tracker`; if not, see B.2 step 1.
4. Skip to B.4 (verify).

#### Method 2: New project in the other account

### B.2 Give the new account the code

The repository is private on `omarsbadrs`. Do one of these:

- **Add the new account as a collaborator:** GitHub → repo → Settings → Collaborators. Then, from the new Vercel account, install the Vercel GitHub app with access to that repo.
- **Transfer the repository** to the new owner: GitHub → Settings → Danger zone → Transfer. GitHub redirects the old URL.
- **Make a copy** under the new owner (fork, or push the code to a new repo).

### B.3 Create and configure the project

1. Go to vercel.com → **Add New… → Project**, import the repository and choose the `master` branch.
2. Build settings: leave the defaults.
   - Framework preset: **Next.js**.
   - Root directory: `.`
   - Build command: `next build`
   - Install command: `npm install`. It runs `prisma generate` automatically through `postinstall`.
   - Node.js: **24.x**, matching the current project.
3. **Environment Variables:** add all 10 from the table at the top, for **Production** (and Preview if you use preview deployments).
   - Copy the database and Supabase values from the current project, or from Part A if you also moved the database.
   - `NEXTAUTH_URL` = the **new** site address, for example `https://<new-project>.vercel.app` or your custom domain, with no trailing slash.
   - `NEXTAUTH_SECRET` = a **new** random value (`openssl rand -base64 32`). Everyone signs in again once.
   - Type values in, or paste without a trailing line break. See *Two traps* above.
4. Click **Deploy**.
5. **Custom domain** (optional): **Settings → Domains → Add**. Point the DNS record where Vercel tells you. Then change `NEXTAUTH_URL` to the domain and redeploy.

From the command line (use `--value`, never a pipe):

```bash
vercel link --project <new-project-name>
vercel env add DATABASE_URL production --value "<value>" --force
# …repeat for each variable…
vercel --prod
```

### B.4 Verify

1. Open `https://<new-site>/api/health`. It should show `healthy` and `connected`.
2. Sign in, open the Department overview, then sign out. If sign-in returns to the login page, `NEXTAUTH_URL` doesn't exactly match the address in the browser.
3. Check variables for hidden newlines. Run `vercel env pull check.env --environment=production` and make sure no value ends in `\n`. **Delete `check.env` afterwards; it contains secrets.**
4. Tell users the new address.

### B.5 Retire the old project

After a few days without problems:

1. In the old Vercel project, remove the custom domain if it moved, then **Settings → Delete Project**.
2. Revoke any personal access tokens that were made for the move: in Supabase under **Account → Access tokens**, and in Vercel under **Account → Tokens**.

---

## Quick checklist

- [ ] New database created; the two connection strings built (A.1–A.2)
- [ ] `prisma db push` run against the **new** database (A.3)
- [ ] Data copied and row counts match, or the new empty database is seeded (A.4)
- [ ] `kpi-evidence` bucket exists in Storage (A.6)
- [ ] All 10 variables set in Vercel Production, with no trailing newlines (B.3)
- [ ] `NEXTAUTH_URL` = the exact live address; `NEXTAUTH_SECRET` set
- [ ] Redeployed after the last variable change
- [ ] `/api/health` healthy; admin sign-in works; a test upload works
- [ ] Old database and project kept as a fallback, then retired; tokens revoked
