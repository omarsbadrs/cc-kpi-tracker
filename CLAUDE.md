# CLAUDE.md — CC KPI Tracker

## Project: Cost Control KPI Performance Management System

> **Elsewedy Electric — Cost Control Department**
> Full-stack web application for tracking, managing, and scoring individual KPI performance across the Cost Control Department.

---

## 1. PROJECT OVERVIEW

### 1.1 Purpose

Build a role-based KPI tracking application that:

- Allows **Admins** to create, assign, configure, and delete KPIs per individual
- Allows **Managers** to view all department members' performance, drill into pillars, and export reports
- Allows **Users** to view their own assigned KPIs, see targets vs actuals, submit evidence files, and track their overall score
- Implements the full **6-pillar scoring engine** defined in SOP `CC-SOP-KPI-001`
- Provides a dark-mode-first dashboard UI inspired by the reference attendance dashboard (card-based, glassmorphism accents, neon status indicators)

### 1.2 Business Logic Source

All KPI definitions, weights, targets, scoring rules, and pillar structures come from the **Cost Control Department KPI Procedure (SOP)** — Document ID: `CC-SOP-KPI-001`.

### 1.3 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion |
| **UI Components** | shadcn/ui + custom dark/light theme system |
| **Charts** | Recharts (primary), custom SVG components for gauges/waves |
| **Data Fetching** | TanStack Query v5 (client-side caching, mutations, background refetch) |
| **Validation** | Zod (shared schemas: API routes + client forms) |
| **i18n** | next-intl (MVP: English, Future: Arabic RTL) |
| **Logging** | pino (structured JSON logs) |
| **Error Tracking** | Sentry (`@sentry/nextjs`) |
| **Rate Limiting** | Upstash Redis + `@upstash/ratelimit` |
| **Testing** | Vitest (unit/integration), Playwright (E2E), Testing Library (components) |
| **Backend** | Next.js API Routes (Route Handlers) |
| **ORM** | Prisma |
| **Database** | Supabase (PostgreSQL) — hosted DB, Auth helpers, Storage, Edge Functions |
| **Auth** | NextAuth.js v5 (Credentials provider — email/password) |
| **File Storage** | Supabase Storage (S3-compatible buckets, built-in RLS policies) |
| **AI Agent** | AN SDK (`@an-sdk/agent`, `@an-sdk/react`, `@an-sdk/nextjs`) — embedded KPI assistant |
| **Dev Methodology** | Spec Kit (`github/spec-kit`) — Spec-Driven Development workflow |
| **Deployment** | Vercel (frontend) + Supabase (DB, Storage, Auth helpers) |

---

## 2. USER ROLES & PERMISSIONS

### 2.1 Role Matrix

| Capability | Admin | Manager | User |
|---|---|---|---|
| View own dashboard | ✅ | ✅ | ✅ |
| View own KPI scores | ✅ | ✅ | ✅ |
| Submit actual values & evidence | ✅ | ✅ | ✅ |
| View all department members' performance | ✅ | ✅ | ❌ |
| Drill into any individual's pillar breakdown | ✅ | ✅ | ❌ |
| Export department reports (PDF/Excel) | ✅ | ✅ | ❌ |
| Create / Edit / Delete KPI definitions | ✅ | ❌ | ❌ |
| Assign KPIs to individuals | ✅ | ❌ | ❌ |
| Set targets per tier/individual | ✅ | ❌ | ❌ |
| Manage users (CRUD) | ✅ | ❌ | ❌ |
| Manage evaluation periods | ✅ | ❌ | ❌ |
| Configure pillar weights per tier | ✅ | ❌ | ❌ |
| Override scores (with audit trail) | ✅ | ❌ | ❌ |
| Approve/reject submitted actuals | ✅ | ✅ | ❌ |

### 2.2 Authentication Flow

1. User navigates to `/login`
2. Enters company email + password
3. NextAuth validates credentials against `users` table (bcrypt-hashed password)
4. On success → redirect to role-appropriate dashboard:
   - Admin → `/admin/dashboard`
   - Manager → `/manager/dashboard`
   - User → `/dashboard`
5. JWT-based session stored in httpOnly cookie
6. Middleware protects all routes; checks role before rendering

### 2.3 Password Reset & Account Recovery

**Forgot Password Flow:**

1. User clicks "Forgot Password" on `/login`
2. Enters their registered email → POST `/api/auth/forgot-password`
3. Server generates a cryptographically secure reset token (`crypto.randomBytes(32)`)
4. Token is hashed (SHA-256) and stored in a `password_reset_tokens` table with a 1-hour TTL
5. An email containing a reset link (`/auth/reset-password?token={plainToken}`) is sent to the user
6. User clicks link → `/auth/reset-password` page validates the token against the hashed version in DB
7. User enters new password → POST `/api/auth/reset-password` with token + new password
8. Server verifies token is valid and not expired, hashes new password (bcrypt, 12 rounds), updates `users.passwordHash`, deletes the token
9. User is redirected to `/login` with a success message

**MVP Note:** If no email service is configured yet, the admin can manually reset passwords via the Admin → Users panel. The forgot-password UI should still exist but shows "Contact your administrator" until email is integrated.

**Password Rules:**

- Minimum 8 characters
- At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Cannot reuse the last 3 passwords (store hashes in `password_history` table)
- Validated client-side (UX) AND server-side (security) with the same Zod schema

**Session Security:**

- JWT tokens expire after 24 hours (configurable via `NEXTAUTH_SESSION_MAX_AGE`)
- Refresh tokens rotate on each use (sliding window)
- Sessions are invalidated on password change
- Maximum 3 concurrent sessions per user — oldest session is revoked when a 4th login occurs
- Failed login attempts: lock account for 15 minutes after 5 consecutive failures (tracked in `users.failedLoginAttempts` and `users.lockedUntil` columns)

---

## 3. KPI FRAMEWORK (from SOP CC-SOP-KPI-001)

### 3.1 Six Pillars

| Code | Pillar Name | # of KPIs |
|---|---|---|
| **A** | Delivery & Timeliness | 16 (A1.1–A1.9, A2.1–A2.7) |
| **B** | Data Quality & Governance | 4 (B1–B4) |
| **C** | Forecasting & Cost Control Effectiveness | 3 (C1–C3) |
| **D** | Communication & Stakeholders | 2 (D1–D2) |
| **E** | Attendance, Reliability & Professional Conduct | 4 (E1–E4) |
| **F** | Growth, Coaching & Department Contribution | 2 (F1–F2) |

**Total: 31 KPIs**

### 3.2 Role Tiers

| Tier | Roles |
|---|---|
| **Junior** | Junior Cost Control Engineer |
| **Engineer** | Cost Control Engineer |
| **Senior** | Senior Cost Control Engineer |
| **Team Lead (TL)** | Cost Control Team Lead |
| **Section Head (SH)** | Cost Control Section Head |

### 3.3 Pillar Weights by Tier

```
Pillar          | Junior/Eng | Senior | Team Lead | Section Head
----------------|-----------|--------|-----------|-------------
A (Delivery)    |    30%    |   26%  |    20%    |     13%
B (Data Gov.)   |    25%    |   23%  |    20%    |     17%
C (Forecasting) |    20%    |   19%  |    16%    |     13%
D (Comm.)       |    10%    |   14%  |    17%    |     19%
E (Attendance)  |    10%    |    9%  |     5%    |      3%
F (Growth)      |     5%    |   10%  |    22%    |     36%
```

### 3.4 KPI Definitions — Complete Register

#### Pillar A: Delivery & Timeliness

| Code | KPI Name | Measure | Unit | Direction | SLA | Frequency | Source |
|---|---|---|---|---|---|---|---|
| A1.1 | IPC/Payment Request Approval on-time % | (On Time Count / Total Count) × 100, On Time = Approval - Request ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.2 | RDM Approval on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.3 | RPIM Approval on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.4 | Equipment Request Approval on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.5 | Employee Transfer Approval on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.6 | Assign Budget on-time % | Same formula, ≤ 2 days | % | Higher | 2 days | Monthly | Oracle R12 |
| A1.7 | Commercial Offer CC Review on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | SharePoint/Email |
| A1.8 | PO CC Approval on-time % | Same formula, ≤ 1 day | % | Higher | 1 day | Monthly | Oracle R12 |
| A1.9 | PR CC Approval on-time % | Same formula, ≤ 2 days | % | Higher | 2 days | Monthly | Oracle R12 |
| A2.1 | PFR submitted on time % | (# months submitted by 15th) / (Months in period) | % | Higher | 15th monthly | Monthly | SharePoint/Email |
| A2.2 | POC submitted on time % | (# months submitted by 20th) / (Months in period) | % | Higher | 20th monthly | Monthly | SharePoint/Email |
| A2.3 | Invoicing report on time % | (# months submitted by 20th) / (Months in period) | % | Higher | 20th monthly | Monthly | SharePoint/Email |
| A2.4 | Cash report on time % | (# months submitted by 20th) / (Months in period) | % | Higher | 20th monthly | Monthly | SharePoint/Email |
| A2.5 | PAG totals to PM on time % | (# quarters sent by 15th) / (Quarters in period) | % | Higher | 15th quarterly | Quarterly | SharePoint/Email |
| A2.6 | PAG to Excellence/Governance on time % | (# months sent by 15th) / (Months in period) | % | Higher | 15th monthly | Monthly | SharePoint/Email |
| A2.7 | Executive presentation on time % | (# months submitted by 22nd) / (Months in period) | % | Higher | 22nd monthly | Monthly | SharePoint/Email |

#### Pillar B: Data Quality & Governance

| Code | KPI Name | Measure | Unit | Direction | Frequency |
|---|---|---|---|---|---|
| B1 | Data defects rate per report | (Total defects logged) / (Total audited items) | % | Lower | Monthly |
| B2 | First Pass Accept Rate (FPA) | (# reports accepted with no rework) / (Total audited) | % | Higher | Monthly |
| B3 | DMS Compliance | (# files compliant) / (Total files checked) | % | Higher | Monthly |
| B4 | Follow CC Standards & Procedures | Pass/Fail | Binary | Binary | Monthly |

#### Pillar C: Forecasting & Cost Control Effectiveness

| Code | KPI Name | Measure | Unit | Direction | Frequency |
|---|---|---|---|---|---|
| C1 | Forecast Uncertainty % (FU%) | \|EAC(t) − EAC(t−1)\| / EAC(t−1) × 100 | % | Lower | Monthly |
| C2 | Action Adoption | Pass if recommended actions exist in month | Binary | Binary | Monthly |
| C3 | Achievement Rate % | (# actions achieved & verified) / (# total actions) × 100 | % | Higher | Monthly |

#### Pillar D: Communication & Stakeholders

| Code | KPI Name | Measure | Unit | Direction | Frequency |
|---|---|---|---|---|---|
| D1 | No. of complaints and reminder emails | Count of complaints/reminders received | Count | Lower | Monthly |
| D2 | Stakeholder Score | AVG survey score (accuracy, timeliness, proactivity, value) | Score (1–5) | Higher | Quarterly |

#### Pillar E: Attendance, Reliability & Professional Conduct

| Code | KPI Name | Measure | Unit | Direction | Frequency |
|---|---|---|---|---|---|
| E1 | Attendance days % | (Days attended) / (Planned working days) | % | Higher | Monthly |
| E2 | On-time arrival % | (Days on-time) / (Attendance days) | % | Higher | Monthly |
| E3 | Internal meetings attendance % | (# meetings attended) / (Total required) | % | Higher | Monthly |
| E4 | Professional appearance | Pass/Fail | Binary | Binary | Monthly |

#### Pillar F: Growth, Coaching & Department Contribution

| Code | KPI Name | Measure | Unit | Direction | Frequency |
|---|---|---|---|---|---|
| F1 | Training completion vs plan % | (# completed & accepted) / (Total planned) | % | Higher | Quarterly |
| F2 | Training Pass % | (# passed) / (Total registered) | % | Higher | Monthly |

### 3.5 Target Values by Tier

#### Pillar A — Actions (A1.x)

```
KPI     | SLA    | Junior | Engineer | Senior | TL   | SH
--------|--------|--------|----------|--------|------|------
A1.1    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.2    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.3    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.4    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.5    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.6    | 2 days | 95%    | 96%      | 97%    | 98%  | 98%
A1.7    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.8    | 1 day  | 95%    | 96%      | 97%    | 98%  | 98%
A1.9    | 2 days | 95%    | 96%      | 97%    | 98%  | 98%
```

#### Pillar A — Reports (A2.x)

```
KPI     | Deadline       | Junior | Engineer | Senior | TL   | SH
--------|----------------|--------|----------|--------|------|------
A2.1    | 15th monthly   | 100%   | 100%     | 100%   | 100% | 100%
A2.2    | 20th monthly   | 95%    | 97%      | 98%    | 100% | 100%
A2.3    | 20th monthly   | 95%    | 97%      | 98%    | 100% | 100%
A2.4    | 20th monthly   | 95%    | 97%      | 98%    | 100% | 100%
A2.5    | 15th quarterly | 100%   | 100%     | 100%   | 100% | 100%
A2.6    | 15th monthly   | 95%    | 97%      | 98%    | 100% | 100%
A2.7    | 22nd monthly   | 95%    | 97%      | 98%    | 100% | 100%
```

#### Pillar B

```
KPI  | Dir    | Junior | Engineer | Senior | TL   | SH
-----|--------|--------|----------|--------|------|------
B1   | Lower  | ≤5%    | ≤4%      | ≤3%    | ≤2%  | ≤2%
B2   | Higher | ≥90%   | ≥92%     | ≥94%   | ≥95% | ≥95%
B3   | Higher | ≥95%   | ≥96%     | ≥97%   | ≥98% | ≥99%
B4   | Binary | Pass   | Pass     | Pass   | Pass | Pass
```

#### Pillar C

```
KPI  | Dir    | Junior | Engineer | Senior | TL   | SH
-----|--------|--------|----------|--------|------|------
C1   | Lower  | ≤12%   | ≤12%     | ≤12%   | ≤12% | ≤12%
C2   | Binary | Pass   | Pass     | Pass   | Pass | Pass
C3   | Higher | 70%    | 75%      | 80%    | 85%  | 90%
```

#### Pillar D

```
KPI  | Dir    | Unit  | Junior | Engineer | Senior | TL   | SH
-----|--------|-------|--------|----------|--------|------|------
D1   | Lower  | Count | ≤5     | ≤4       | ≤3     | ≤2   | ≤1
D2   | Higher | Score | ≥2.5   | ≥2.5     | ≥2.5   | ≥2.5 | ≥2.5
```

#### Pillar E

```
KPI  | Dir    | Junior | Engineer | Senior | TL   | SH
-----|--------|--------|----------|--------|------|------
E1   | Higher | ≥98%   | ≥98%     | ≥98%   | ≥98% | ≥98%
E2   | Higher | ≥95%   | ≥95%     | ≥95%   | ≥95% | ≥95%
E3   | Higher | ≥97%   | ≥97%     | ≥97%   | ≥95% | ≥95%
E4   | Binary | Pass   | Pass     | Pass   | Pass | Pass
```

#### Pillar F

```
KPI  | Dir    | Junior | Engineer | Senior | TL   | SH
-----|--------|--------|----------|--------|------|------
F1   | Higher | ≥90%   | ≥90%     | ≥95%   | 100% | 100%
F2   | Higher | ≥90%   | ≥90%     | ≥95%   | ≥95% | ≥95%
```

### 3.6 Sub-KPI Weights Within Each Pillar (by Tier)

#### Pillar A — Sub-KPI Weights (sum to 100 per tier)

```
KPI   | Junior | Engineer | Senior | TL  | SH
------|--------|----------|--------|-----|----
A1.1  |   10   |     8    |    7   |  6  |  5
A1.2  |    6   |     6    |    5   |  4  |  2
A1.3  |    6   |     6    |    5   |  3  |  1
A1.4  |    3   |     3    |    2   |  1  |  0
A1.5  |    3   |     3    |    1   |  0  |  0
A1.6  |    7   |     7    |    6   |  5  |  4
A1.7  |    6   |     7    |    6   |  5  |  4
A1.8  |   12   |    10    |    9   |  8  |  7
A1.9  |   12   |    10    |    9   |  8  |  7
A2.1  |    8   |     8    |   10   | 12  | 14
A2.2  |    6   |     7    |    9   | 10  | 12
A2.3  |    6   |     7    |    9   | 10  | 12
A2.4  |    5   |     5    |    6   |  7  |  8
A2.5  |    3   |     4    |    5   |  7  |  8
A2.6  |    4   |     5    |    6   |  8  | 10
A2.7  |    3   |     4    |    5   |  6  |  6
```

#### Pillar B — Sub-KPI Weights

```
KPI  | Junior | Engineer | Senior | TL  | SH
-----|--------|----------|--------|-----|----
B1   |   25   |    20    |   20   | 20  | 15
B2   |   25   |    30    |   35   | 35  | 35
B3   |   25   |    30    |   30   | 35  | 40
B4   |   25   |    20    |   15   | 10  | 10
```

#### Pillar C — Sub-KPI Weights

```
KPI  | Junior | Engineer | Senior | TL  | SH
-----|--------|----------|--------|-----|----
C1   |   30   |    35    |   40   | 45  | 50
C2   |   20   |    20    |   20   | 15  | 15
C3   |   50   |    45    |   40   | 40  | 35
```

#### Pillar D — Sub-KPI Weights

```
KPI  | Junior | Engineer | Senior | TL  | SH
-----|--------|----------|--------|-----|----
D1   |   60   |    55    |   45   | 35  | 30
D2   |   40   |    45    |   55   | 65  | 70
```

#### Pillar E — Sub-KPI Weights

```
KPI  | Junior | Engineer | Senior | TL  | SH
-----|--------|----------|--------|-----|----
E1   |   45   |    40    |   30   | 20  | 15
E2   |   35   |    35    |   25   | 20  | 15
E3   |   10   |    15    |   30   | 45  | 55
E4   |   10   |    10    |   15   | 15  | 15
```

#### Pillar F — Sub-KPI Weights

```
KPI  | Junior | Engineer | Senior | TL  | SH
-----|--------|----------|--------|-----|----
F1   |   60   |    55    |   45   | 40  | 35
F2   |   40   |    45    |   55   | 60  | 65
```

### 3.7 Scoring Engine

#### 3.7.1 Individual KPI Score (0–5)

**If Direction = "Higher" (higher is better):**

| Condition | Score |
|---|---|
| Measured ≥ Target | 5 |
| Target − 1 to 3 pp | 4 |
| Target − 4 to 6 pp | 3 |
| Target − 7 to 10 pp | 2 |
| Target − 11 to 15 pp | 1 |
| Worse than −15 pp | 0 |

**If Direction = "Lower" (lower is better):**

| Condition | Score |
|---|---|
| Measured ≤ Target | 5 |
| +1 to +3 pp above target | 4 |
| +4 to +6 above | 3 |
| +7 to +10 above | 2 |
| +11 to +15 above | 1 |
| Worse than +15 above | 0 |

**If Direction = "Binary":**

| Condition | Score |
|---|---|
| Pass | 5 |
| Fail | 0 |

#### 3.7.2 Pillar Score Calculation

```
Pillar Score (out of 5) = Σ (KPI_score × KPI_sub_weight / 100)
Pillar % = Pillar Score × 20
```

#### 3.7.3 Manager Accountability (α — Team Share)

For Team Leads and Section Heads, each pillar blends personal + team performance:

```
Manager Pillar % = α × Team_Pillar_% + (1 − α) × Personal_Pillar_%
```

**Alpha values:**

```
Pillar | TL α | TL Personal | SH α | SH Personal
-------|------|-------------|------|------------
A      | 0.45 |    0.55     | 0.49 |    0.51
B      | 0.40 |    0.60     | 0.45 |    0.55
C      | 0.45 |    0.55     | 0.49 |    0.51
D      | 0.35 |    0.65     | 0.40 |    0.60
E      | 0.10 |    0.90     | 0.05 |    0.95
F      | 0.40 |    0.60     | 0.45 |    0.55
```

If a TL or SH manages multiple teams, `Team_Pillar_%` = weighted average by team size.

#### 3.7.4 Overall Score

```
Overall Score = Σ (Pillar_% × Pillar_Weight_%)
```

#### 3.7.5 Appraisal Band

```
90–100 = Exceeds Expectations
80–89  = Strong
70–79  = Meets Expectations
60–69  = Needs Improvement
< 60   = Unsatisfactory
```

---

## 4. DATABASE SCHEMA (Supabase PostgreSQL + Prisma)

### 4.1 Entity Relationship Overview

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   companies  │────<│      users       │────<│  kpi_assignments  │
└──────────────┘     └──────────────────┘     └───────────────────┘
                            │                         │
                            │                         │
                     ┌──────┴──────┐          ┌───────┴────────┐
                     │ team_members│          │  kpi_actuals   │
                     └─────────────┘          └───────┬────────┘
                                                      │
                                              ┌───────┴────────┐
                                              │  evidence_files│
                                              └────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   pillars    │────<│  kpi_definitions │────<│  kpi_targets     │
└──────────────┘     └──────────────────┘     └───────────────────┘

┌──────────────────┐  ┌──────────────────┐   ┌───────────────────┐
│ pillar_weights   │  │ sub_kpi_weights  │   │ eval_periods     │
└──────────────────┘  └──────────────────┘   └───────────────────┘

┌──────────────────┐  ┌──────────────────┐
│ alpha_configs    │  │  audit_logs      │
└──────────────────┘  └──────────────────┘

┌──────────────────────┐  ┌──────────────────────┐
│ password_reset_tokens│  │  password_history    │
└──────────────────────┘  └──────────────────────┘
```

> **20 Prisma models total** (18 core + PasswordResetToken + PasswordHistory)

### 4.2 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Supabase pooled connection (Transaction mode)
  directUrl = env("DIRECT_URL")         // Supabase direct connection (for migrations)
}

// ─────────────────────────────────────
// ENUMS
// ─────────────────────────────────────

enum Role {
  ADMIN
  MANAGER
  USER
}

enum Tier {
  JUNIOR
  ENGINEER
  SENIOR
  TEAM_LEAD
  SECTION_HEAD
}

enum KpiDirection {
  HIGHER
  LOWER
  BINARY
}

enum KpiUnit {
  PERCENTAGE
  COUNT
  SCORE
  BINARY
  DAYS
}

enum KpiFrequency {
  MONTHLY
  QUARTERLY
  ANNUALLY
}

enum ActualStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

enum AppraisalBand {
  EXCEEDS
  STRONG
  MEETS
  NEEDS_IMPROVEMENT
  UNSATISFACTORY
}

// ─────────────────────────────────────
// COMPANY & ORGANIZATION
// ─────────────────────────────────────

model Company {
  id          String   @id @default(cuid())
  name        String
  sector      String?
  logo        String?  // URL to company logo
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  departments Department[]
  users       User[]

  @@map("companies")
}

model Department {
  id          String   @id @default(cuid())
  name        String
  companyId   String
  company     Company  @relation(fields: [companyId], references: [id])
  createdAt   DateTime @default(now())

  users       User[]

  @@map("departments")
}

// ─────────────────────────────────────
// USERS & TEAMS
// ─────────────────────────────────────

model User {
  id              String     @id @default(cuid())
  email           String     @unique
  passwordHash    String
  firstName       String
  lastName        String
  employeeId      String?    @unique  // e.g., "#905-27875"
  avatarUrl       String?
  role            Role       @default(USER)
  tier            Tier       @default(ENGINEER)
  jobTitle        String?
  companyId       String
  company         Company    @relation(fields: [companyId], references: [id])
  departmentId    String?
  department      Department? @relation(fields: [departmentId], references: [id])
  managerId       String?    // direct manager
  manager         User?      @relation("ManagerReports", fields: [managerId], references: [id])
  reports         User[]     @relation("ManagerReports")
  nationality     String?
  preferredLocale String     @default("en")  // "en", "ar" (future)
  isActive        Boolean    @default(true)
  failedLoginAttempts Int     @default(0)
  lockedUntil     DateTime?
  lastLoginAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  // Relations
  kpiAssignments  KpiAssignment[]
  kpiActuals      KpiActual[]
  teamMemberships TeamMember[]    @relation("MemberTeams")
  teamLeadOf      TeamMember[]    @relation("LeaderTeams")
  auditLogs       AuditLog[]
  notifications   Notification[]
  passwordHistory PasswordHistory[]
  resetTokens     PasswordResetToken[]

  @@map("users")
}

model PasswordResetToken {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  tokenHash   String   @unique  // SHA-256 hash of the plain token
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())

  @@map("password_reset_tokens")
}

model PasswordHistory {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  passwordHash String   // bcrypt hash of previous password
  createdAt    DateTime @default(now())

  @@map("password_history")
}

model TeamMember {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("MemberTeams", fields: [userId], references: [id])
  leaderId  String
  leader    User     @relation("LeaderTeams", fields: [leaderId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, leaderId])
  @@map("team_members")
}

// ─────────────────────────────────────
// EVALUATION PERIODS
// ─────────────────────────────────────

model EvalPeriod {
  id          String   @id @default(cuid())
  name        String   // e.g., "Q1 2025", "January 2025"
  periodType  String   // "MONTHLY" | "QUARTERLY" | "ANNUAL"
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(true)
  isClosed    Boolean  @default(false)
  isLocked    Boolean  @default(false)  // True while scoring engine is running
  createdAt   DateTime @default(now())

  kpiAssignments KpiAssignment[]
  kpiActuals     KpiActual[]

  @@map("eval_periods")
}

// ─────────────────────────────────────
// KPI DEFINITIONS & STRUCTURE
// ─────────────────────────────────────

model Pillar {
  id          String   @id @default(cuid())
  code        String   @unique  // "A", "B", "C", "D", "E", "F"
  name        String            // "Delivery & Timeliness"
  description String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  kpiDefinitions KpiDefinition[]
  pillarWeights  PillarWeight[]
  alphaConfigs   AlphaConfig[]

  @@map("pillars")
}

model KpiDefinition {
  id              String       @id @default(cuid())
  code            String       @unique  // "A1.1", "B2", "C3", etc.
  name            String                // "IPC/Payment Request Approval on-time %"
  description     String?               // Full measure/calculation description
  pillarId        String
  pillar          Pillar       @relation(fields: [pillarId], references: [id])
  unit            KpiUnit      @default(PERCENTAGE)
  direction       KpiDirection @default(HIGHER)
  frequency       KpiFrequency @default(MONTHLY)
  sla             String?               // "1 day", "15th monthly"
  dataSource      String?               // "Oracle R12", "SharePoint"
  formula         String?               // calculation formula text
  sortOrder       Int          @default(0)
  isActive        Boolean      @default(true)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  // Relations
  targets         KpiTarget[]
  subKpiWeights   SubKpiWeight[]
  assignments     KpiAssignment[]

  @@map("kpi_definitions")
}

// ─────────────────────────────────────
// TARGETS & WEIGHTS (configured by tier)
// ─────────────────────────────────────

model KpiTarget {
  id              String   @id @default(cuid())
  kpiDefinitionId String
  kpiDefinition   KpiDefinition @relation(fields: [kpiDefinitionId], references: [id])
  tier            Tier
  targetValue     Float    // e.g., 95.0 for 95%, 5.0 for ≤5 complaints
  targetOperator  String   @default(">=")  // ">=", "<=", "==" (for binary)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([kpiDefinitionId, tier])
  @@map("kpi_targets")
}

model SubKpiWeight {
  id              String   @id @default(cuid())
  kpiDefinitionId String
  kpiDefinition   KpiDefinition @relation(fields: [kpiDefinitionId], references: [id])
  tier            Tier
  weight          Float    // weight within the pillar (0-100), sums to 100 per pillar/tier
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([kpiDefinitionId, tier])
  @@map("sub_kpi_weights")
}

model PillarWeight {
  id        String   @id @default(cuid())
  pillarId  String
  pillar    Pillar   @relation(fields: [pillarId], references: [id])
  tier      Tier
  weight    Float    // percentage (0-100), sums to 100 per tier
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([pillarId, tier])
  @@map("pillar_weights")
}

model AlphaConfig {
  id             String @id @default(cuid())
  pillarId       String
  pillar         Pillar @relation(fields: [pillarId], references: [id])
  tier           Tier   // TEAM_LEAD or SECTION_HEAD only
  alphaTeam      Float  // e.g., 0.45
  alphaPersonal  Float  // e.g., 0.55 (= 1 - alphaTeam)

  @@unique([pillarId, tier])
  @@map("alpha_configs")
}

// ─────────────────────────────────────
// KPI ASSIGNMENTS & ACTUALS
// ─────────────────────────────────────

model KpiAssignment {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  kpiDefinitionId String
  kpiDefinition   KpiDefinition @relation(fields: [kpiDefinitionId], references: [id])
  evalPeriodId    String
  evalPeriod      EvalPeriod    @relation(fields: [evalPeriodId], references: [id])
  targetOverride  Float?        // optional override of tier-default target
  weightOverride  Float?        // optional override of tier-default sub-weight
  isActive        Boolean       @default(true)
  assignedBy      String?       // admin userId who assigned
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  actuals         KpiActual[]

  @@unique([userId, kpiDefinitionId, evalPeriodId])
  @@map("kpi_assignments")
}

model KpiActual {
  id              String       @id @default(cuid())
  assignmentId    String
  assignment      KpiAssignment @relation(fields: [assignmentId], references: [id])
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  evalPeriodId    String
  evalPeriod      EvalPeriod   @relation(fields: [evalPeriodId], references: [id])
  actualValue     Float?       // the measured value
  binaryValue     Boolean?     // for Pass/Fail KPIs
  score           Int?         // calculated 0–5 score
  status          ActualStatus @default(DRAFT)
  submittedAt     DateTime?
  reviewedBy      String?      // manager/admin who approved
  reviewedAt      DateTime?
  reviewComment   String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  evidenceFiles   EvidenceFile[]

  @@unique([assignmentId, evalPeriodId])
  @@map("kpi_actuals")
}

// ─────────────────────────────────────
// EVIDENCE & FILE UPLOADS
// ─────────────────────────────────────

model EvidenceFile {
  id           String    @id @default(cuid())
  actualId     String
  actual       KpiActual @relation(fields: [actualId], references: [id], onDelete: Cascade)
  fileName     String    // original filename
  fileType     String    // MIME type
  fileSize     Int       // bytes
  storagePath  String    // Supabase Storage object path (bucket/folder/filename)
  uploadedAt   DateTime  @default(now())

  @@map("evidence_files")
}

// Supported evidence file types:
// - Documents: .pdf, .docx, .xlsx, .csv, .pptx
// - Images: .png, .jpg, .jpeg
// - Archives: .zip (for bundled evidence)
// - Max file size: 25 MB per file
// - Max files per actual: 5

// ─────────────────────────────────────
// SCORING SNAPSHOTS
// ─────────────────────────────────────

model ScoreSnapshot {
  id             String        @id @default(cuid())
  userId         String
  evalPeriodId   String
  pillarCode     String        // "A", "B", etc.
  pillarScore    Float         // out of 5
  pillarPercent  Float         // out of 100
  overallScore   Float?        // final weighted score (only on "OVERALL" row)
  appraisalBand  AppraisalBand?
  version        Int           @default(1)  // Optimistic concurrency control
  calculatedAt   DateTime      @default(now())

  @@unique([userId, evalPeriodId, pillarCode])
  @@map("score_snapshots")
}

// ─────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String
  message   String
  type      String   // "KPI_ASSIGNED", "DEADLINE_REMINDER", "SCORE_PUBLISHED", "ACTUAL_REJECTED"
  isRead    Boolean  @default(false)
  link      String?  // deep link within app
  createdAt DateTime @default(now())

  @@map("notifications")
}

// ─────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // "CREATE_KPI", "UPDATE_SCORE", "OVERRIDE_TARGET", etc.
  entity     String   // "kpi_definition", "kpi_actual", "user", etc.
  entityId   String
  oldValue   Json?
  newValue   Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@map("audit_logs")
}
```

### 4.3 Seed Data Strategy

The database must be seeded with:

1. **6 Pillars** (A–F) with names and descriptions
2. **31 KPI Definitions** (all codes from A1.1 to F2)
3. **155 KPI Targets** (31 KPIs × 5 tiers)
4. **155 Sub-KPI Weights** (31 KPIs × 5 tiers)
5. **30 Pillar Weights** (6 pillars × 5 tiers)
6. **12 Alpha Configs** (6 pillars × 2 manager tiers: TL + SH)
7. **1 Company** (Elsewedy Electric)
8. **1 Department** (Cost Control)
9. **Demo Users** (1 per role: admin, manager, user)
10. **Demo Eval Period** (current month/quarter)

> Create `prisma/seed.ts` with all data from Section 3 of this document.

---

## 5. APPLICATION ARCHITECTURE

### 5.1 Directory Structure

```
cc-kpi-tracker/
├── CLAUDE.md                    # This file
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   ├── logo.svg
│   └── avatars/
├── src/
│   ├── messages/
│   │   ├── en.json                  # English translations
│   │   └── ar.json                  # Arabic (future)
│   ├── i18n/
│   │   ├── request.ts               # next-intl request config
│   │   └── routing.ts               # Locale-based routing
│   ├── middleware/
│   │   └── rate-limit.ts            # Upstash rate limiter
│   ├── app/
│   │   ├── layout.tsx           # Root layout (theme provider, auth, QueryClient)
│   │   ├── page.tsx             # Landing → redirect to login
│   │   ├── globals.css
│   │   ├── error.tsx            # Global error boundary page
│   │   ├── not-found.tsx        # Custom 404 page
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (app)/               # Authenticated routes
│   │   │   ├── layout.tsx       # Sidebar + topbar layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx     # User dashboard (role-aware)
│   │   │   ├── kpis/
│   │   │   │   ├── page.tsx     # My KPIs list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # KPI detail + submit actual
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── notifications/
│   │   │       └── page.tsx
│   │   ├── (manager)/           # Manager-only routes
│   │   │   ├── layout.tsx
│   │   │   ├── team/
│   │   │   │   └── page.tsx     # Team overview
│   │   │   ├── members/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Individual member drill-down
│   │   │   └── reports/
│   │   │       └── page.tsx     # Export reports
│   │   ├── (admin)/             # Admin-only routes
│   │   │   ├── layout.tsx
│   │   │   ├── users/
│   │   │   │   ├── page.tsx     # Manage users
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── kpi-library/
│   │   │   │   ├── page.tsx     # All KPI definitions
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Edit KPI definition
│   │   │   ├── assignments/
│   │   │   │   └── page.tsx     # Assign KPIs to users
│   │   │   ├── periods/
│   │   │   │   └── page.tsx     # Manage evaluation periods
│   │   │   ├── weights/
│   │   │   │   └── page.tsx     # Configure pillar/sub-KPI weights
│   │   │   ├── scoring/
│   │   │   │   └── page.tsx     # Run scoring engine, view results
│   │   │   └── import/
│   │   │       └── page.tsx     # CSV import for historical data
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       ├── users/
│   │       │   └── route.ts
│   │       ├── kpis/
│   │       │   ├── route.ts         # CRUD KPI definitions
│   │       │   ├── assignments/
│   │       │   │   └── route.ts
│   │       │   ├── actuals/
│   │       │   │   └── route.ts
│   │       │   └── scoring/
│   │       │       └── route.ts     # Trigger score calculation
│   │       ├── periods/
│   │       │   └── route.ts
│   │       ├── upload/
│   │       │   └── route.ts         # File upload endpoint
│   │       └── export/
│   │           └── route.ts         # PDF/Excel export
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── dashboard/
│   │   │   ├── OverallScoreCard.tsx
│   │   │   ├── PillarRadarChart.tsx
│   │   │   ├── KpiStatusGrid.tsx
│   │   │   ├── AppraisalBandBadge.tsx
│   │   │   ├── ProgressGauge.tsx    # SVG donut/gauge
│   │   │   ├── PillarBreakdownCard.tsx
│   │   │   ├── TrendLineChart.tsx
│   │   │   └── DeadlineTimeline.tsx
│   │   ├── kpi/
│   │   │   ├── KpiCard.tsx
│   │   │   ├── KpiActualForm.tsx
│   │   │   ├── KpiScoreBadge.tsx
│   │   │   ├── EvidenceUploader.tsx
│   │   │   └── KpiDefinitionForm.tsx
│   │   ├── team/
│   │   │   ├── MemberPerformanceRow.tsx
│   │   │   ├── TeamHeatmap.tsx
│   │   │   └── DepartmentOverview.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx
│   │       ├── StatCard.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx     # React error boundary fallback
│   │       └── FileDropzone.tsx
│   ├── lib/
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── supabase/
│   │   │   ├── server.ts            # Service role client (server-only)
│   │   │   └── client.ts            # Anon key client (browser-safe)
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── scoring-engine.ts        # ⭐ Core scoring logic
│   │   ├── file-storage.ts          # Supabase Storage upload/download helpers
│   │   ├── api-response.ts          # Standardized success/error responses
│   │   ├── api-handler.ts           # withAuth wrapper + global error catch
│   │   ├── pagination.ts            # Pagination query helpers
│   │   ├── logger.ts                # Pino structured logger
│   │   ├── query-keys.ts            # TanStack Query key factory
│   │   ├── validations/
│   │   │   ├── auth.ts              # Login, password, reset schemas
│   │   │   ├── users.ts             # Create/update user schemas
│   │   │   ├── actuals.ts           # Submit/review actual schemas
│   │   │   ├── scoring.ts           # Run scoring, override schemas
│   │   │   ├── upload.ts            # File type/size validation
│   │   │   └── shared.ts            # Pagination, cuid, date range
│   │   ├── export.ts                # PDF/Excel generation
│   │   ├── utils.ts
│   │   └── constants.ts             # Tier labels, pillar codes, etc.
│   ├── hooks/
│   │   ├── useKpis.ts
│   │   ├── useScoring.ts
│   │   ├── useTeam.ts
│   │   └── useNotifications.ts
│   └── types/
│       └── index.ts                 # TypeScript interfaces
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI/CD pipeline (Section 13)
├── supabase/
│   ├── config.toml                  # Supabase CLI local config
│   ├── migrations/                  # SQL migration files (if using supabase CLI)
│   └── seed.sql                     # Optional: raw SQL seed as backup
├── tailwind.config.ts
├── next.config.js
├── sentry.client.config.ts
├── sentry.server.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── tests/
│   ├── unit/
│   │   ├── scoring-engine.test.ts
│   │   ├── scoring-bands.test.ts
│   │   └── validations/
│   ├── integration/
│   │   ├── api/
│   │   └── helpers/
│   │       ├── test-db.ts
│   │       ├── test-users.ts
│   │       └── test-kpis.ts
│   └── e2e/
│       ├── login.spec.ts
│       ├── submit-actual.spec.ts
│       └── admin-scoring.spec.ts
```

### 5.2 Core Module: Scoring Engine (`lib/scoring-engine.ts`)

This is the heart of the application. Pseudocode:

```typescript
/**
 * calculateKpiScore(actualValue, targetValue, direction): number (0-5)
 *
 * For HIGHER: gap = target - actual
 * For LOWER:  gap = actual - target
 * For BINARY: pass=5, fail=0
 *
 * Score bands: 0 gap → 5, 1-3 → 4, 4-6 → 3, 7-10 → 2, 11-15 → 1, >15 → 0
 */

/**
 * calculatePillarScore(kpiScores[], subKpiWeights[]): { score5: number, percent: number }
 *
 * pillarScore = Σ (kpiScore × subWeight / 100)
 * pillarPercent = pillarScore × 20
 */

/**
 * calculateManagerPillar(personalPercent, teamPercent, alpha): number
 *
 * return alpha * teamPercent + (1 - alpha) * personalPercent
 */

/**
 * calculateOverallScore(pillarPercents[], pillarWeights[], tier): number
 *
 * overall = Σ (pillarPercent × pillarWeight / 100)
 */

/**
 * getAppraisalBand(overallScore): AppraisalBand
 *
 * 90-100 → EXCEEDS, 80-89 → STRONG, 70-79 → MEETS, 60-69 → NEEDS_IMPROVEMENT, <60 → UNSATISFACTORY
 */

/**
 * runFullScoring(userId, evalPeriodId): ScoreResult
 *
 * 1. Fetch user's tier
 * 2. Fetch all assignments + approved actuals for the period
 * 3. Fetch sub-kpi weights, pillar weights, and alpha configs for the tier
 * 4. For each KPI: calculate score (0-5)
 * 5. For each pillar: calculate pillar score and percent
 * 6. If TL/SH: fetch team members, calculate team pillar %, blend with alpha
 * 7. Calculate overall score
 * 8. Map to appraisal band
 * 9. Save ScoreSnapshot records
 * 10. Return full result tree
 */
```

### 5.3 Client-Side Data Fetching Pattern

All client-side data fetching uses **TanStack Query (React Query v5)** for caching, background refetching, optimistic updates, and error state management.

```bash
pnpm add @tanstack/react-query
```

**Provider setup (in root layout):**

```typescript
// src/app/(app)/layout.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes before data is considered stale
      gcTime: 10 * 60 * 1000,      // 10 minutes before unused cache is garbage collected
      retry: 2,                      // Retry failed requests twice
      refetchOnWindowFocus: true,    // Refetch when user returns to tab
    },
  },
})
```

**Query key convention:**

```typescript
// src/lib/query-keys.ts
export const queryKeys = {
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", id] as const,
    me: ["users", "me"] as const,
  },
  kpis: {
    definitions: ["kpis", "definitions"] as const,
    assignments: (userId: string, periodId: string) =>
      ["kpis", "assignments", userId, periodId] as const,
    actuals: (userId: string, periodId: string) =>
      ["kpis", "actuals", userId, periodId] as const,
  },
  scoring: {
    results: (userId: string, periodId: string) =>
      ["scoring", "results", userId, periodId] as const,
    trend: (userId: string, pillar: string, months: number) =>
      ["scoring", "trend", userId, pillar, months] as const,
  },
  periods: {
    all: ["periods"] as const,
    active: ["periods", "active"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
}
```

**Custom hook example:**

```typescript
// src/hooks/useMyScores.ts
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useMyScores(periodId: string) {
  return useQuery({
    queryKey: queryKeys.scoring.results("me", periodId),
    queryFn: async () => {
      const res = await fetch(`/api/kpis/scoring/results?periodId=${periodId}`)
      if (!res.ok) throw new Error("Failed to fetch scores")
      return res.json()
    },
    enabled: !!periodId,
  })
}
```

**Mutation pattern with optimistic update (actual submission):**

```typescript
// src/hooks/useSubmitActual.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useSubmitActual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { assignmentId: string; actualValue: number }) => {
      const res = await fetch("/api/kpis/actuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Submission failed")
      return res.json()
    },
    onSuccess: () => {
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["kpis", "actuals"] })
      queryClient.invalidateQueries({ queryKey: ["scoring"] })
    },
  })
}
```

**Server Components vs Client Components rule:**

- **Server Components** (default): Dashboard page shells, data tables, profile cards — anything that fetches once on load
- **Client Components** (`"use client"`): Charts, forms, file uploaders, theme toggle, period selector dropdown, notification bell, AI chat widget
- **Never fetch data in Server Components and pass to Client Components as props for re-fetching** — use TanStack Query in the client component directly

---

## 6. UI/UX DESIGN SYSTEM

### 6.1 Design Inspiration

The UI is inspired by the reference **Work Attendance Dashboard** (dark theme, card-based, colorful status indicators) with these principles:

- **Dark mode first** — rich dark backgrounds (`#0a0a0f`, `#111118`, `#1a1a25`)
- **Light mode available** — clean whites/grays with same accent colors
- **Card-based layout** — rounded corners (12–16px), subtle borders, glassmorphism on hover
- **Color-coded pillars** — each pillar gets a distinct accent color:
  - A (Delivery): `#22c55e` (green)
  - B (Data Gov.): `#3b82f6` (blue)
  - C (Forecasting): `#f59e0b` (amber)
  - D (Communication): `#8b5cf6` (violet)
  - E (Attendance): `#ef4444` (red)
  - F (Growth): `#06b6d4` (cyan)
- **Score-based color indicators**:
  - Score 5: `#22c55e` (green)
  - Score 4: `#84cc16` (lime)
  - Score 3: `#f59e0b` (amber)
  - Score 2: `#f97316` (orange)
  - Score 1: `#ef4444` (red)
  - Score 0: `#991b1b` (dark red)
- **Appraisal band colors**:
  - Exceeds: `#22c55e`
  - Strong: `#3b82f6`
  - Meets: `#f59e0b`
  - Needs Improvement: `#f97316`
  - Unsatisfactory: `#ef4444`
- **Typography**: `"Plus Jakarta Sans"` (headings), `"DM Sans"` (body), monospace for numbers/scores
- **Animations**: Framer Motion for page transitions, score counter animations, card hover effects

### 6.2 Key Screens

#### 6.2.1 Login Page

- Centered card with company logo
- Email + password fields
- "Remember me" checkbox
- Dark gradient background with subtle animated particles or grid
- Error shake animation on invalid credentials

#### 6.2.2 User Dashboard (`/dashboard`)

Top section:
- **Profile card** — avatar, name, title, tier badge, employee ID, department
- **Overall Score gauge** — large donut/radial chart showing score out of 100 + appraisal band badge
- **Period selector** — dropdown for eval period

Middle section (6-column grid on desktop):
- **6 Pillar Cards** — one per pillar, each showing:
  - Pillar name + icon
  - Pillar % (large number)
  - Mini progress bar
  - Pillar-specific accent color
  - Click to expand → shows all sub-KPIs under that pillar

Bottom section:
- **KPI Status Grid** — table of all assigned KPIs with columns: Code, Name, Target, Actual, Score (0–5), Status badge (Draft/Submitted/Approved/Rejected)
- **Trend chart** — line chart showing overall score over past 6 months
- **Upcoming Deadlines** — timeline of next KPI submission deadlines

#### 6.2.3 KPI Detail + Submit (`/kpis/[id]`)

- KPI definition card (name, formula, SLA, data source, direction, frequency)
- Target display (with tier context)
- **Actual value input** — number field or Pass/Fail toggle
- **Evidence file uploader** — drag-and-drop zone, shows uploaded files
- Submit button → changes status to SUBMITTED
- History of past actuals for this KPI (scrollable timeline)

#### 6.2.4 Manager — Team Overview (`/team`)

- **Department heatmap** — grid of all members × 6 pillars, cells colored by score
- **Ranking table** — sortable by overall score, any pillar, specific KPI
- **Filters** — by tier, by pillar, by appraisal band
- Click any member → drill into their full dashboard

#### 6.2.5 Admin — KPI Library (`/admin/kpi-library`)

- Full CRUD table of all 31 KPI definitions
- Inline editing of targets per tier
- Bulk assign to users/tiers
- Import/export KPI definitions (CSV)

#### 6.2.6 Admin — Assignment Matrix (`/admin/assignments`)

- Matrix view: Users (rows) × KPIs (columns) × Period
- Toggle assignment on/off per cell
- Bulk operations: "Assign all Pillar A KPIs to all Engineers"

#### 6.2.7 Admin — Scoring Dashboard (`/admin/scoring`)

- Run scoring engine for a period
- View results before publishing
- Override individual scores (with mandatory comment → audit log)
- Publish scores → triggers notifications to all users

### 6.3 Accessibility (a11y) Standards

**Target:** WCAG 2.1 Level AA compliance.

**Color Contrast:**

- All text on dark backgrounds must meet minimum contrast ratio **4.5:1** (normal text) or **3:1** (large text ≥ 18px)
- Score color indicators (green/amber/red) must never be the **only** signal — always pair with a numeric label or icon
- Neon accent colors from the reference design are decorative only — functional information must use high-contrast alternatives
- Use the `tailwindcss-contrast` plugin or manual checks with [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)

**Verified color pairings (dark mode):**

```
Background #0a0a0f + Text #e2e8f0   → Ratio 15.2:1 ✓
Background #1a1a25 + Text #94a3b8   → Ratio  7.1:1 ✓
Card #1e1e2e      + Green #22c55e   → Ratio  6.3:1 ✓
Card #1e1e2e      + Red #ef4444     → Ratio  4.6:1 ✓
Card #1e1e2e      + Amber #f59e0b   → Ratio  5.8:1 ✓
```

**Keyboard Navigation:**

- All interactive elements must be reachable via Tab key
- Focus indicators: visible 2px ring using `focus-visible:ring-2 focus-visible:ring-blue-500`
- Score cards and KPI rows are keyboard-activatable (Enter/Space)
- Modal dialogs trap focus (use `@headlessui/react` or shadcn Dialog)
- Skip-to-content link on every page
- Escape key closes modals, dropdowns, and the AI chat widget

**Screen Reader Support:**

- All charts/gauges include `aria-label` with the numeric value (e.g., `aria-label="Overall score: 83 out of 100, Strong"`)
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Status badges use `aria-live="polite"` for dynamic score updates
- Data tables use proper `<th scope="col">` and `<th scope="row">` markup
- Icon-only buttons always include `aria-label` (e.g., theme toggle, notification bell)
- Toast notifications use `role="alert"` for error messages, `role="status"` for success

**Semantic HTML Rules:**

- One `<h1>` per page (page title)
- Heading hierarchy: h1 → h2 → h3 (never skip levels)
- Use `<nav>` for sidebar and breadcrumbs
- Use `<main>` for page content
- Use `<aside>` for the AI chat panel
- Form inputs always have associated `<label>` elements (not just placeholder text)

### 6.4 Internationalization (i18n)

**MVP:** English only — but with full i18n-readiness built into the architecture.

**Future Phase:** Arabic (RTL) support for the Egyptian team, plus potential French/Spanish for multinational EPC projects.

**Framework:** `next-intl` (lightweight, App Router native, supports RSC)

```bash
pnpm add next-intl
```

**i18n-Ready Architecture:**

```
src/
├── messages/
│   ├── en.json              # English translations (MVP)
│   └── ar.json              # Arabic translations (future)
├── i18n/
│   ├── request.ts           # next-intl request config
│   └── routing.ts           # locale-based routing
```

**Coding rules for i18n readiness (apply from Day 1):**

1. **Never hardcode user-facing strings** — always use translation keys:
   ```typescript
   // ❌ Bad
   <h1>My KPI Dashboard</h1>

   // ✅ Good
   const t = useTranslations("dashboard")
   <h1>{t("title")}</h1>
   ```

2. **Never hardcode date/number formats** — use `Intl` APIs:
   ```typescript
   // ❌ Bad
   `${score}%`

   // ✅ Good
   new Intl.NumberFormat(locale, { style: "percent" }).format(score / 100)
   ```

3. **Never assume LTR layout** — use logical CSS properties:
   ```css
   /* ❌ Bad */
   margin-left: 16px;
   text-align: left;

   /* ✅ Good */
   margin-inline-start: 16px;
   text-align: start;
   ```

4. **KPI names and pillar names** must come from the database, not hardcoded — this enables future translation of business terms

5. **Store locale preference** in the `users` table (`preferredLocale` column, default `"en"`)

**RTL Considerations (for Arabic phase):**

- Tailwind RTL plugin: `tailwindcss-rtl` (converts `ml-4` → `ms-4` etc.)
- Sidebar flips to right side
- Charts and progress bars read right-to-left
- Numbers remain LTR even in RTL context (standard Arabic typographic convention)
- Date format: DD/MM/YYYY (already used in Egypt)

### 6.5 Responsive Design Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| `sm` | ≥ 640px | Single column, collapsed sidebar as bottom nav |
| `md` | ≥ 768px | Sidebar appears as overlay drawer |
| `lg` | ≥ 1024px | 2-column dashboard grid, persistent sidebar |
| `xl` | ≥ 1280px | 3-column dashboard grid, full sidebar |
| `2xl` | ≥ 1536px | 4-column dashboard grid (manager heatmap) |

**Mobile-specific behavior:**

- Sidebar collapses to hamburger menu on `< md`
- Pillar cards stack vertically on `< lg`
- Data tables become horizontally scrollable cards on `< md`
- AI chat widget becomes full-screen overlay on mobile
- File upload drag-and-drop falls back to tap-to-select on touch devices

---

## 7. API ENDPOINTS

### 7.1 Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signin` | Login with email/password |
| POST | `/api/auth/signout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/health` | Health check (DB connectivity, app version) |

### 7.2 Users

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/users` | ADMIN | List all users (paginated, filterable) |
| POST | `/api/users` | ADMIN | Create user |
| GET | `/api/users/[id]` | ADMIN/MANAGER | Get user details |
| PATCH | `/api/users/[id]` | ADMIN | Update user |
| DELETE | `/api/users/[id]` | ADMIN | Deactivate user |
| GET | `/api/users/me` | ALL | Get current user profile |

### 7.3 KPI Definitions

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/kpis` | ALL | List KPI definitions (with targets) |
| POST | `/api/kpis` | ADMIN | Create KPI definition |
| GET | `/api/kpis/[id]` | ALL | Get KPI detail |
| PATCH | `/api/kpis/[id]` | ADMIN | Update KPI |
| DELETE | `/api/kpis/[id]` | ADMIN | Soft-delete KPI |

### 7.4 Targets & Weights

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/kpis/targets` | ALL | Get all targets (filterable by tier) |
| PATCH | `/api/kpis/targets/[id]` | ADMIN | Update target value |
| GET | `/api/kpis/weights` | ALL | Get pillar + sub-KPI weights |
| PATCH | `/api/kpis/weights/[id]` | ADMIN | Update weight |

### 7.5 Assignments

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/kpis/assignments` | ALL | Get assignments (filtered by user/period) |
| POST | `/api/kpis/assignments` | ADMIN | Create assignment(s) |
| POST | `/api/kpis/assignments/bulk` | ADMIN | Bulk assign KPIs |
| DELETE | `/api/kpis/assignments/[id]` | ADMIN | Remove assignment |

### 7.6 Actuals & Evidence

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/kpis/actuals` | ALL | Get actuals (filtered by user/period) |
| POST | `/api/kpis/actuals` | ALL | Submit actual value |
| PATCH | `/api/kpis/actuals/[id]` | ALL | Update draft actual |
| PATCH | `/api/kpis/actuals/[id]/review` | ADMIN/MANAGER | Approve/reject actual |
| POST | `/api/upload` | ALL | Upload evidence file |
| DELETE | `/api/upload/[id]` | ALL | Delete own evidence file |

### 7.7 Scoring

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/kpis/scoring/run` | ADMIN | Run scoring engine for a period |
| GET | `/api/kpis/scoring/results` | ALL | Get score snapshots |
| PATCH | `/api/kpis/scoring/override` | ADMIN | Override a score (audit logged) |

### 7.8 Evaluation Periods

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/periods` | ALL | List periods |
| POST | `/api/periods` | ADMIN | Create period |
| PATCH | `/api/periods/[id]` | ADMIN | Update/close period |

### 7.9 Export

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/export/user/[id]` | ADMIN/MANAGER | Export individual scorecard (PDF) |
| GET | `/api/export/department` | ADMIN/MANAGER | Export department report (Excel) |

### 7.10 Notifications

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/api/notifications` | ALL | Get user's notifications |
| PATCH | `/api/notifications/read` | ALL | Mark as read |

### 7.11 Data Import

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/admin/import` | ADMIN | Bulk import historical actuals from CSV (supports dry run) |

### 7.12 API Error Response Contract

Every API route returns a consistent error shape. Client code can rely on this structure for all error handling.

**Success response:**

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

**Error response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Actual value must be between 0 and 100",
    "details": [
      {
        "field": "actualValue",
        "message": "Number must be less than or equal to 100"
      }
    ]
  }
}
```

**Standard error codes:**

| HTTP Status | Error Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod validation fails on request body/params |
| 401 | `UNAUTHORIZED` | No valid session / expired JWT |
| 403 | `FORBIDDEN` | Valid session but insufficient role |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `CONFLICT` | Duplicate assignment, concurrent score override |
| 422 | `UNPROCESSABLE` | Business rule violation (e.g., submitting actual for a closed period) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error (log details, return generic message) |

**Implementation helper:**

```typescript
// src/lib/api-response.ts
import { NextResponse } from "next/server"

export function success<T>(data: T, meta?: PaginationMeta) {
  return NextResponse.json({ data, meta })
}

export function error(
  status: number,
  code: string,
  message: string,
  details?: { field: string; message: string }[]
) {
  return NextResponse.json({ error: { code, message, details } }, { status })
}
```

### 7.13 Zod Validation Schemas

Every API route validates inputs with Zod before touching the database. Schemas are co-located in a dedicated directory and shared between API routes and client forms.

```bash
pnpm add zod
```

**Schema directory:**

```
src/lib/validations/
├── auth.ts          # Login, password reset, password rules
├── users.ts         # Create/update user
├── kpis.ts          # KPI definition CRUD
├── assignments.ts   # Assign/unassign KPIs
├── actuals.ts       # Submit/update actuals
├── scoring.ts       # Score override, run scoring
├── periods.ts       # Create/update eval periods
├── upload.ts        # File validation (size, type, count)
└── shared.ts        # Reusable schemas (pagination, IDs, dates)
```

**Core schemas:**

```typescript
// src/lib/validations/shared.ts
import { z } from "zod"

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export const cuidSchema = z.string().cuid()

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => !data.from || !data.to || data.from <= data.to,
  { message: "From date must be before to date" }
)

// src/lib/validations/auth.ts
export const passwordSchema = z
  .string()
  .min(8, "Minimum 8 characters")
  .regex(/[A-Z]/, "Must contain at least 1 uppercase letter")
  .regex(/[a-z]/, "Must contain at least 1 lowercase letter")
  .regex(/[0-9]/, "Must contain at least 1 number")
  .regex(/[^A-Za-z0-9]/, "Must contain at least 1 special character")

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// src/lib/validations/actuals.ts
export const submitActualSchema = z.object({
  assignmentId: cuidSchema,
  evalPeriodId: cuidSchema,
  actualValue: z.number().min(0).max(100).optional(),
  binaryValue: z.boolean().optional(),
}).refine(
  (data) => data.actualValue !== undefined || data.binaryValue !== undefined,
  { message: "Either actualValue or binaryValue must be provided" }
)

export const reviewActualSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewComment: z.string().min(1, "Comment is required when rejecting").optional(),
}).refine(
  (data) => data.status !== "REJECTED" || (data.reviewComment && data.reviewComment.length > 0),
  { message: "Comment is required when rejecting", path: ["reviewComment"] }
)

// src/lib/validations/scoring.ts
export const runScoringSchema = z.object({
  evalPeriodId: cuidSchema,
  dryRun: z.boolean().default(false),  // Preview without saving
})

export const overrideScoreSchema = z.object({
  snapshotId: cuidSchema,
  newScore: z.number().min(0).max(5),
  comment: z.string().min(10, "Override comment must be at least 10 characters"),
})

// src/lib/validations/users.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  employeeId: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]),
  tier: z.enum(["JUNIOR", "ENGINEER", "SENIOR", "TEAM_LEAD", "SECTION_HEAD"]),
  jobTitle: z.string().optional(),
  departmentId: cuidSchema.optional(),
  managerId: cuidSchema.optional(),
  nationality: z.string().optional(),
})

// src/lib/validations/upload.ts
export const uploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "application/zip",
  ]),
  fileSize: z.number().max(50 * 1024 * 1024, "Max file size is 50 MB"),
})
```

**Usage pattern in API routes:**

```typescript
// src/app/api/kpis/actuals/route.ts
import { submitActualSchema } from "@/lib/validations/actuals"
import { error, success } from "@/lib/api-response"

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = submitActualSchema.safeParse(body)

  if (!parsed.success) {
    return error(400, "VALIDATION_ERROR", "Invalid input", 
      parsed.error.issues.map(i => ({ field: String(i.path[0]), message: i.message }))
    )
  }

  // ... proceed with validated data: parsed.data
}
```

### 7.14 Pagination & Filtering Contract

All list endpoints support a consistent pagination and filtering interface.

**Query parameters (via GET):**

```
GET /api/users?page=2&pageSize=20&sortBy=lastName&sortOrder=asc&role=USER&tier=ENGINEER&search=ahmed
```

**Standard pagination parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Current page (1-indexed) |
| `pageSize` | int | 20 | Items per page (max 100) |
| `sortBy` | string | `createdAt` | Column to sort by |
| `sortOrder` | `asc\|desc` | `desc` | Sort direction |
| `search` | string | — | Full-text search across name/email/employeeId |

**Endpoint-specific filters:**

| Endpoint | Filters |
|---|---|
| `/api/users` | `role`, `tier`, `departmentId`, `isActive`, `managerId` |
| `/api/kpis/assignments` | `userId`, `evalPeriodId`, `pillarCode`, `isActive` |
| `/api/kpis/actuals` | `userId`, `evalPeriodId`, `status`, `kpiCode`, `pillarCode` |
| `/api/kpis/scoring/results` | `userId`, `evalPeriodId`, `appraisalBand`, `pillarCode` |
| `/api/notifications` | `isRead`, `type` |

**Prisma implementation pattern:**

```typescript
// src/lib/pagination.ts
import { paginationSchema } from "./validations/shared"

export function parsePagination(searchParams: URLSearchParams) {
  return paginationSchema.parse(Object.fromEntries(searchParams))
}

export function paginateQuery(page: number, pageSize: number) {
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}

export function buildMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  }
}
```

### 7.15 Rate Limiting

Protects API routes from brute force attacks and abusive clients.

**Implementation:** `@upstash/ratelimit` with Vercel KV (serverless-friendly), or in-memory `Map` for local dev.

```bash
pnpm add @upstash/ratelimit @upstash/redis
```

**Rate limit tiers:**

| Route Category | Limit | Window | Identifier |
|---|---|---|---|
| `/api/auth/signin` | 5 requests | 15 minutes | IP address |
| `/api/auth/forgot-password` | 3 requests | 1 hour | IP + email |
| `/api/upload` | 20 requests | 1 hour | User ID |
| `/api/kpis/scoring/run` | 5 requests | 1 hour | User ID |
| All other `/api/*` | 100 requests | 1 minute | User ID |

**Middleware implementation:**

```typescript
// src/middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  analytics: true,
  prefix: "ratelimit:auth",
})

const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
  prefix: "ratelimit:general",
})
```

**Response when rate limited:**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 42 seconds.",
    "retryAfter": 42
  }
}
```

Header: `Retry-After: 42`

### 7.16 Security Headers

Applied via `next.config.js` and middleware:

```typescript
// next.config.js
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // needed for Next.js
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://api.an.dev`,
      `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
]

module.exports = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}
```

**CORS configuration:**

```typescript
// src/middleware.ts (CORS section)
const allowedOrigins = [
  process.env.NEXTAUTH_URL,
  "https://your-production-domain.com",
]
// Only needed if API is consumed by external clients (e.g., mobile app)
```

---

## 8. FILE UPLOAD SPECIFICATIONS

### 8.1 Supported Evidence File Types

| Category | Extensions | Max Size |
|---|---|---|
| Documents | `.pdf`, `.docx`, `.xlsx`, `.csv`, `.pptx` | 25 MB |
| Images | `.png`, `.jpg`, `.jpeg` | 10 MB |
| Archives | `.zip` | 50 MB |

### 8.2 Upload Rules

- Maximum **5 files** per KPI actual submission
- Files are renamed to `{userId}_{kpiCode}_{period}_{timestamp}.{ext}` for traceability
- Storage path: `/uploads/{companyId}/{userId}/{periodId}/{filename}`
- Virus scanning: optional middleware (ClamAV integration for production)
- Metadata stored in `evidence_files` table

### 8.3 Storage Backend — Supabase Storage

- **Bucket**: `kpi-evidence` (private bucket with RLS policies)
- **Path format**: `{companyId}/{userId}/{periodId}/{filename}`
- **Access**: Signed URLs generated server-side via `supabase.storage.from('kpi-evidence').createSignedUrl()`
- **RLS Policy**: Users can only access files in their own `{userId}/` path; Managers/Admins can access all paths within their department
- **Max upload**: 50 MB per file (Supabase Storage default)

**Supabase Storage setup (run once via Supabase Dashboard or SQL):**

```sql
-- Create the private bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('kpi-evidence', 'kpi-evidence', false);

-- RLS: Users can upload to their own folder
CREATE POLICY "Users upload own evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kpi-evidence' AND auth.uid()::text = (storage.foldername(name))[2]);

-- RLS: Users can read their own files
CREATE POLICY "Users read own evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kpi-evidence' AND auth.uid()::text = (storage.foldername(name))[2]);

-- RLS: Admins/Managers can read all evidence
CREATE POLICY "Managers read all evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kpi-evidence');
```

> **Note:** Even though Supabase Storage has its own RLS, we still validate file access in the Next.js API routes as defense-in-depth. The Next.js API uses the Supabase service role key to generate signed URLs only after verifying the requester's role.

---

## 9. SPEC-DRIVEN DEVELOPMENT METHODOLOGY (Spec Kit)

> **Repository:** https://github.com/github/spec-kit
> **Purpose:** Structured, AI-assisted development workflow that ensures every feature is specified, planned, broken down, and implemented with full traceability.

### 9.1 Why Spec Kit for This Project

This KPI tracker has complex business logic (scoring engine, alpha blending, tiered weights) and multiple user roles. Vibe-coding this will produce inconsistent results. Spec Kit enforces a **specification-first** approach where requirements are locked before code is written — critical for an enterprise-grade tool managing real employee performance data.

### 9.2 Setup

```bash
# Install Specify CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Initialize in the project root
cd cc-kpi-tracker
specify init . --ai claude --force

# Verify
specify check
```

This creates the `.specify/` directory with templates, scripts, and slash commands.

### 9.3 Project Constitution (`.specify/memory/constitution.md`)

Run once at project start to establish governing principles:

```
/speckit.constitution Create principles for an EPC-sector KPI tracking application:
- All scoring logic must match SOP CC-SOP-KPI-001 exactly (no approximations)
- AACE-aligned terminology throughout
- Server-side scoring engine only — never expose calculation logic to client
- Every score override must be audit-logged with mandatory comment
- File uploads must go through authenticated API routes (never expose Supabase Storage URLs directly)
- All database writes use Prisma transactions
- Zod validation on every API input
- Role-based access enforced at middleware AND API route level (defense in depth)
- Dark mode is the primary design target; light mode is secondary
- TypeScript strict mode — zero tolerance for `any` types
- All KPI business rules are parameterized (from DB seed), not hardcoded in app logic
```

### 9.4 Feature Spec Workflow

Each major feature follows the 6-step Spec Kit pipeline:

#### Step 1: Specify (the "what" and "why")

```
/speckit.specify Build the KPI Scoring Engine feature. The system must calculate
individual KPI scores (0-5) based on direction (Higher/Lower/Binary), aggregate
them into pillar scores using tier-specific sub-KPI weights, convert to pillar
percentages (×20), apply manager alpha blending for TL/SH roles, compute overall
weighted scores, and map to appraisal bands (Exceeds/Strong/Meets/NeedsImprovement/
Unsatisfactory). Scores are stored as snapshots and only recalculated when triggered
by an admin. See CLAUDE.md Section 3.7 for the complete scoring specification.
```

#### Step 2: Clarify

```
/speckit.clarify
```

This surfaces under-specified areas (e.g., "What happens if a TL manages teams in two different departments?" or "How is FU% calculated when the previous month EAC is zero?").

#### Step 3: Plan (the "how")

```
/speckit.plan Using Next.js 14 App Router with TypeScript, Prisma ORM on Supabase PostgreSQL.
The scoring engine lives in src/lib/scoring-engine.ts as pure functions.
API trigger via POST /api/kpis/scoring/run (admin-only).
Results stored in score_snapshots table.
Test with Jest — unit tests for every scoring band boundary.
```

#### Step 4: Tasks

```
/speckit.tasks
```

Generates ordered, dependency-aware task breakdown with parallel execution markers.

#### Step 5: Analyze (pre-implementation validation)

```
/speckit.analyze
```

Cross-checks spec ↔ plan ↔ tasks for gaps (e.g., "Plan references alpha_configs table but no task creates the Prisma model").

#### Step 6: Implement

```
/speckit.implement
```

Executes all tasks in sequence, respecting dependencies.

### 9.5 Feature Breakdown for Spec Kit

Each feature below should go through the full `/speckit.specify → /speckit.implement` pipeline as a separate branch:

| Branch | Feature | Spec Kit Feature ID |
|---|---|---|
| `001-foundation` | Project init, Prisma schema, seed data, auth, layout shell | `001-foundation` |
| `002-user-dashboard` | User dashboard with score gauge, pillar cards, KPI grid | `002-user-dashboard` |
| `003-kpi-submission` | KPI actual submission, evidence upload, status workflow | `003-kpi-submission` |
| `004-scoring-engine` | Full scoring engine with all calculation rules | `004-scoring-engine` |
| `005-manager-views` | Team heatmap, member drill-down, ranking table | `005-manager-views` |
| `006-admin-kpi-mgmt` | KPI library CRUD, target/weight configuration | `006-admin-kpi-mgmt` |
| `007-admin-assignments` | Assignment matrix, bulk operations | `007-admin-assignments` |
| `008-admin-scoring` | Score run, review, override, publish | `008-admin-scoring` |
| `009-exports` | PDF individual scorecards, Excel department reports | `009-exports` |
| `010-notifications` | In-app notification system + deadline reminders | `010-notifications` |
| `011-ai-assistant` | Embedded AN SDK KPI assistant agent | `011-ai-assistant` |
| `012-polish` | Dark/light theme, responsive design, animations | `012-polish` |

### 9.6 Directory Structure Addition

```
cc-kpi-tracker/
├── .specify/
│   ├── memory/
│   │   └── constitution.md          # Project governing principles
│   ├── scripts/                     # Spec Kit automation scripts
│   ├── specs/
│   │   ├── 001-foundation/
│   │   │   ├── spec.md
│   │   │   ├── plan.md
│   │   │   ├── tasks.md
│   │   │   ├── data-model.md
│   │   │   └── research.md
│   │   ├── 002-user-dashboard/
│   │   ├── 003-kpi-submission/
│   │   ├── 004-scoring-engine/
│   │   │   ├── spec.md              # Full scoring rules from SOP
│   │   │   ├── plan.md
│   │   │   ├── tasks.md
│   │   │   └── contracts/
│   │   │       └── api-spec.json    # Scoring API contract
│   │   └── ... (005–012)
│   └── templates/
│       ├── spec-template.md
│       ├── plan-template.md
│       └── tasks-template.md
├── CLAUDE.md
├── prisma/
├── src/
│   └── ...
```

---

## 10. EMBEDDED AI ASSISTANT (AN SDK)

> **Repository:** https://github.com/21st-dev/an-sdk
> **Purpose:** Embeddable AI coding agent framework — used here to provide an in-app KPI assistant that helps users understand their scores, get recommendations, and query KPI data in natural language.

### 10.1 Why AN SDK

Users in the Cost Control department are not data analysts. An embedded AI assistant provides a natural-language interface to answer questions like:

- "Why did my Pillar A score drop this month?"
- "Which KPIs am I below target on?"
- "What do I need to score to reach 'Strong' overall?"
- "Show me my FU% trend for the past 6 months"
- "When is my PFR submission due?"

### 10.2 Architecture

```
User → Chat Widget (@an-sdk/react) → Next.js API → AN Platform → Agent Sandbox
                                                         ↕
                                          KPI Database (via custom tools)
```

The AN SDK agent is defined with **custom tools** that query the KPI database, so the AI can answer questions grounded in real data — not hallucinated.

### 10.3 Packages to Install

```bash
pnpm add @an-sdk/agent @an-sdk/react @an-sdk/nextjs @an-sdk/node
```

### 10.4 Agent Definition

```typescript
// agents/kpi-assistant.ts
import { agent, tool } from "@an-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  systemPrompt: `You are the CC KPI Assistant for the Cost Control Department.
You help employees understand their KPI performance, scoring methodology, targets,
and deadlines. You have access to the user's KPI data through tools.

Key rules:
- Always reference the SOP CC-SOP-KPI-001 scoring methodology when explaining scores
- Scores are 0-5 per KPI, pillar % = pillar_score × 20, overall = Σ(pillar_% × pillar_weight)
- Appraisal bands: 90-100 Exceeds, 80-89 Strong, 70-79 Meets, 60-69 Needs Improvement, <60 Unsatisfactory
- Be encouraging but honest about areas needing improvement
- Never reveal other employees' individual scores — only the user's own data
- For TL/SH, explain the alpha blending (team vs personal) when relevant`,

  tools: {
    getMyKpiScores: tool({
      description: "Get the current user's KPI scores for a given evaluation period",
      inputSchema: z.object({
        evalPeriodId: z.string().optional().describe("Evaluation period ID. If not provided, uses the active period."),
      }),
      execute: async ({ evalPeriodId }) => {
        // Calls internal API: GET /api/kpis/scoring/results?userId={sessionUserId}&periodId={evalPeriodId}
        // Returns: pillar scores, individual KPI scores, overall score, appraisal band
      },
    }),

    getMyKpiDetails: tool({
      description: "Get details for a specific KPI including target, actual, score, and evidence status",
      inputSchema: z.object({
        kpiCode: z.string().describe("The KPI code, e.g., 'A1.1', 'B2', 'C3'"),
      }),
      execute: async ({ kpiCode }) => {
        // Calls internal API: GET /api/kpis/actuals?userId={sessionUserId}&kpiCode={kpiCode}
        // Returns: definition, target for user's tier, latest actual, score, status, deadline
      },
    }),

    getMyTrend: tool({
      description: "Get the user's score trend over multiple evaluation periods",
      inputSchema: z.object({
        pillarCode: z.string().optional().describe("Pillar code (A-F) or 'OVERALL' for total score"),
        months: z.number().default(6).describe("Number of months to look back"),
      }),
      execute: async ({ pillarCode, months }) => {
        // Calls internal API: GET /api/kpis/scoring/trend?userId={sessionUserId}&pillar={pillarCode}&months={months}
        // Returns: array of { period, score } objects
      },
    }),

    getMyDeadlines: tool({
      description: "Get upcoming KPI submission deadlines for the current user",
      inputSchema: z.object({}),
      execute: async () => {
        // Calls internal API: GET /api/kpis/assignments?userId={sessionUserId}&status=PENDING
        // Returns: list of KPIs with next deadline dates
      },
    }),

    simulateScore: tool({
      description: "Simulate what the user's overall score would be if they achieved specific KPI values",
      inputSchema: z.object({
        simulations: z.array(z.object({
          kpiCode: z.string(),
          hypotheticalValue: z.number(),
        })).describe("Array of KPI codes with hypothetical actual values to simulate"),
      }),
      execute: async ({ simulations }) => {
        // Runs the scoring engine with hypothetical values
        // Returns: simulated pillar scores, overall score, and appraisal band
      },
    }),

    explainScoring: tool({
      description: "Explain how a specific KPI or pillar score was calculated",
      inputSchema: z.object({
        kpiCode: z.string().optional().describe("Specific KPI code to explain"),
        pillarCode: z.string().optional().describe("Pillar code (A-F) to explain"),
      }),
      execute: async ({ kpiCode, pillarCode }) => {
        // Returns: step-by-step calculation breakdown with actual numbers
        // e.g., "Your A1.1 actual is 94%. Target for Engineers is 96%. Gap = 2pp → Score = 4"
      },
    }),
  },
})
```

### 10.5 React Integration — Chat Widget

```typescript
// src/components/ai/KpiAssistantChat.tsx
"use client"

import { AnAgentChat } from "@an-sdk/react"
import { useSession } from "next-auth/react"

export function KpiAssistantChat() {
  const { data: session } = useSession()

  return (
    <AnAgentChat
      agent="cc-kpi-assistant"
      metadata={{
        userId: session?.user?.id,
        tier: session?.user?.tier,
        role: session?.user?.role,
      }}
      theme="dark"
      position="bottom-right"
      placeholder="Ask about your KPI performance..."
      welcomeMessage={`Hi ${session?.user?.firstName}! I can help you understand your KPI scores, check deadlines, or simulate scenarios. What would you like to know?`}
    />
  )
}
```

### 10.6 Next.js Integration

```typescript
// src/app/api/agent/route.ts
import { createAnHandler } from "@an-sdk/nextjs"
import kpiAssistant from "../../../../agents/kpi-assistant"

export const { GET, POST } = createAnHandler(kpiAssistant)
```

### 10.7 Deployment

```bash
# Deploy the agent to AN Platform
npx @an-sdk/cli login
npx @an-sdk/cli deploy
```

The agent runs in a sandboxed E2B environment on the AN Platform. The React widget connects via SSE streaming through the AN relay.

### 10.8 User-Facing Features Powered by the Agent

| Feature | Example Query | Tool Used |
|---|---|---|
| Score Explanation | "Why is my Pillar B only 72%?" | `explainScoring` |
| Gap Analysis | "Which KPIs am I failing?" | `getMyKpiScores` |
| What-If Simulation | "If I get FPA to 95%, what's my new score?" | `simulateScore` |
| Deadline Awareness | "When is my next report due?" | `getMyDeadlines` |
| Trend Analysis | "How has my attendance score changed?" | `getMyTrend` |
| KPI Definition | "What does FU% mean and how is it calculated?" | `explainScoring` |
| Target Guidance | "What score do I need on C3 to reach 'Strong'?" | `simulateScore` |

### 10.9 Privacy & Access Control

- The agent only accesses the **authenticated user's own data** — session userId is injected server-side, never from the client
- Managers cannot use the AI chat to query individual employees' data (they have the manager dashboard for that)
- All agent queries are logged in the `audit_logs` table with action `AI_QUERY`
- The agent refuses to compare the user with named colleagues — it can only reference the user's own history

### 10.10 Directory Structure Addition

```
cc-kpi-tracker/
├── agents/
│   └── kpi-assistant.ts             # AN SDK agent definition
├── src/
│   ├── app/
│   │   └── api/
│   │       └── agent/
│   │           └── route.ts         # AN SDK Next.js handler
│   └── components/
│       └── ai/
│           ├── KpiAssistantChat.tsx  # Chat widget component
│           ├── AssistantToggle.tsx   # FAB button to open/close chat
│           └── ChatBubble.tsx       # Custom message bubble styling
```

---

## 11. IMPLEMENTATION PHASES

> **Each phase below maps to a Spec Kit feature branch.** Before coding any phase, run the full `/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement` pipeline.

### Phase 1: Foundation — `001-foundation` (Days 1–3)

```bash
# Start the Spec Kit workflow for this feature
/speckit.specify Build the project foundation: Next.js 14 App Router, Prisma schema with
all 18 models, Supabase PostgreSQL, seed script with 31 KPIs + targets + weights,
NextAuth credentials auth, role-based middleware, sidebar+topbar layout shell, dark/light
theme toggle using CSS custom properties.
```

- [ ] Initialize Next.js project with TypeScript, Tailwind, shadcn/ui
- [ ] Install and configure Spec Kit (`specify init . --ai claude`)
- [ ] Set up Prisma + Supabase project (create project, get connection strings)
- [ ] Create full Prisma schema from Section 4
- [ ] Write seed script with all 31 KPIs, targets, weights from Section 3
- [ ] Implement NextAuth with credentials provider
- [ ] Build login page
- [ ] Create layout shell (sidebar, topbar, theme toggle)
- [ ] Set up role-based middleware

### Phase 2: Core Features — `002-user-dashboard` + `003-kpi-submission` + `004-scoring-engine` (Days 4–7)

- [ ] User Dashboard — overall score gauge, 6 pillar cards, KPI grid
- [ ] KPI detail page with actual submission form
- [ ] Evidence file upload system
- [ ] Scoring engine (`lib/scoring-engine.ts`) with full calculation logic
- [ ] Score snapshot creation and storage
- [ ] API routes for assignments, actuals, scoring

### Phase 3: Manager & Admin — `005-manager-views` + `006-admin-kpi-mgmt` + `007-admin-assignments` + `008-admin-scoring` (Days 8–10)

- [ ] Manager team overview with heatmap
- [ ] Member drill-down view
- [ ] Admin user management CRUD
- [ ] Admin KPI library management
- [ ] Admin assignment matrix
- [ ] Admin scoring dashboard (run, review, override, publish)
- [ ] Admin period management

### Phase 4: Polish & Export — `009-exports` + `010-notifications` (Days 11–12)

- [ ] PDF export for individual scorecards
- [ ] Excel export for department reports
- [ ] Notification system
- [ ] Audit log viewer (admin)
- [ ] Dark/light theme refinement
- [ ] Responsive design (mobile sidebar collapse)
- [ ] Loading states, error boundaries, empty states

### Phase 5: AI Assistant — `011-ai-assistant` (Days 13–14)

- [ ] Install AN SDK packages (`@an-sdk/agent`, `@an-sdk/react`, `@an-sdk/nextjs`)
- [ ] Define KPI assistant agent with 6 custom tools (Section 10.4)
- [ ] Build internal API endpoints for agent tool calls
- [ ] Integrate `AnAgentChat` widget in the app layout
- [ ] Style chat widget to match dark/light theme system
- [ ] Implement privacy controls (user-only data access)
- [ ] Add `AI_QUERY` audit logging
- [ ] Deploy agent to AN Platform (`@an-sdk/cli deploy`)
- [ ] Test all 7 user-facing features (Section 10.8)

### Phase 6: Testing, CI/CD & Deployment — `012-polish` (Days 15–18)

- [ ] Configure Vitest with test database (separate Supabase project)
- [ ] Write exhaustive scoring engine unit tests (Section 12.3 — all boundary cases)
- [ ] Write Zod validation tests for all schemas
- [ ] API route integration tests (auth, actuals, scoring flows)
- [ ] Set up Playwright for 5 critical E2E paths
- [ ] Configure GitHub Actions CI pipeline (lint → test → e2e → deploy)
- [ ] Set up Sentry error tracking (production)
- [ ] Configure pino structured logging
- [ ] Set up branch protection rules on `main`
- [ ] Seed with realistic demo data (10+ users, 3 months of actuals)
- [ ] Vercel deployment configuration + Supabase environment binding
- [ ] Environment variable documentation
- [ ] README with setup instructions

---

## 12. TESTING STRATEGY

### 12.1 Test Framework & Tools

| Tool | Purpose |
|---|---|
| **Vitest** | Unit tests + integration tests (faster than Jest, native ESM, Vite-compatible) |
| **Testing Library** (`@testing-library/react`) | Component tests — user-centric queries |
| **MSW** (`msw`) | Mock API responses in integration tests |
| **Playwright** | End-to-end tests (browser automation) |
| **Prisma** (`@prisma/client/test`) | Test database with isolated transactions |

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event msw playwright @vitejs/plugin-react jsdom
```

### 12.2 Test Directory Structure

```
tests/
├── unit/
│   ├── scoring-engine.test.ts        # ⭐ Most critical — every scoring rule
│   ├── scoring-bands.test.ts         # Boundary testing for 0-5 score bands
│   ├── alpha-blending.test.ts        # TL/SH team share calculations
│   ├── appraisal-mapping.test.ts     # Overall → band mapping
│   ├── validations/
│   │   ├── auth.test.ts              # Password rules, login schema
│   │   ├── actuals.test.ts           # Actual submission validation
│   │   └── scoring.test.ts           # Override validation
│   └── pagination.test.ts            # Pagination math helpers
├── integration/
│   ├── api/
│   │   ├── auth.test.ts              # Login, logout, password reset flow
│   │   ├── kpis.test.ts              # CRUD KPI definitions
│   │   ├── actuals.test.ts           # Submit, review, approve/reject
│   │   ├── scoring.test.ts           # Run scoring, override, snapshots
│   │   └── upload.test.ts            # File upload + evidence linking
│   ├── middleware/
│   │   ├── auth-middleware.test.ts    # Role guard tests
│   │   └── rate-limit.test.ts        # Rate limiting behavior
│   └── helpers/
│       ├── test-db.ts                # Test database setup/teardown
│       ├── test-users.ts             # Factory for test users (per role/tier)
│       └── test-kpis.ts              # Factory for test KPI data
├── e2e/
│   ├── login.spec.ts                 # Full login → dashboard flow
│   ├── submit-actual.spec.ts         # User submits KPI actual + evidence
│   ├── admin-scoring.spec.ts         # Admin runs scoring engine
│   ├── manager-review.spec.ts        # Manager approves/rejects actuals
│   └── password-reset.spec.ts        # Forgot password → reset → login
└── vitest.config.ts
```

### 12.3 Scoring Engine Test Cases (Exhaustive)

The scoring engine is the single most critical module. Every boundary must be tested:

**Direction = HIGHER (higher is better):**

```
Target = 95%
Actual = 95% → Score 5  (at target)
Actual = 96% → Score 5  (above target)
Actual = 94% → Score 4  (1pp below)
Actual = 92% → Score 4  (3pp below — boundary)
Actual = 91% → Score 3  (4pp below)
Actual = 89% → Score 3  (6pp below — boundary)
Actual = 88% → Score 2  (7pp below)
Actual = 85% → Score 2  (10pp below — boundary)
Actual = 84% → Score 1  (11pp below)
Actual = 80% → Score 1  (15pp below — boundary)
Actual = 79% → Score 0  (16pp below)
Actual = 0%  → Score 0  (extreme)
```

**Direction = LOWER (lower is better):**

```
Target = 5%
Actual = 5%  → Score 5  (at target)
Actual = 3%  → Score 5  (below target — better)
Actual = 6%  → Score 4  (1pp above)
Actual = 11% → Score 3  (6pp above — boundary)
Actual = 20% → Score 2  (15pp above — boundary)
Actual = 21% → Score 0  (16pp above)
```

**Direction = BINARY:**

```
Pass → Score 5
Fail → Score 0
```

**Pillar score calculation:**

```
KPI scores: [4, 5, 3], weights: [50, 30, 20]
Pillar score = (4×50 + 5×30 + 3×20) / 100 = 4.10
Pillar % = 4.10 × 20 = 82%
```

**Alpha blending (TL):**

```
Personal C% = 88, Team C% = 80, α = 0.45
Result = 0.45 × 80 + 0.55 × 88 = 84.4
```

**Edge cases:**

```
- TL with 0 team members → use 100% personal score
- All KPIs score 5 → overall = 100 → Exceeds
- All KPIs score 0 → overall = 0 → Unsatisfactory
- Mixed binary (1 pass, 1 fail) → must weight correctly
- KPI with weight = 0 for a tier → skip, don't divide by zero
- Missing actual for a KPI → exclude from calculation, don't penalize
```

### 12.4 Test Database Strategy

```typescript
// tests/helpers/test-db.ts
import { PrismaClient } from "@prisma/client"
import { execSync } from "child_process"

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
})

// Before all tests: push schema to test DB
export async function setupTestDB() {
  execSync("npx prisma db push --force-reset", {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  })
}

// After each test: clean all data (keep schema)
export async function cleanTestDB() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `
  for (const { tablename } of tables) {
    if (tablename !== "_prisma_migrations") {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
}

export { prisma as testPrisma }
```

Use a separate Supabase project (or local Supabase instance) for tests. Add `TEST_DATABASE_URL` to `.env.test`.

### 12.5 Coverage Targets

| Category | Target | Rationale |
|---|---|---|
| Scoring engine (`lib/scoring-engine.ts`) | **100%** | Business-critical — wrong scores = wrong appraisals |
| Zod validation schemas | **100%** | Every edge case must be caught before DB |
| API routes | **≥ 85%** | All happy paths + error paths |
| React components | **≥ 70%** | Interactive components (forms, uploads) |
| E2E flows | **≥ 5 critical paths** | Login, submit, review, score, export |

**Run tests:**

```bash
pnpm test              # Unit + integration (Vitest)
pnpm test:e2e          # E2E (Playwright)
pnpm test:coverage     # Coverage report
```

---

## 13. CI/CD PIPELINE

### 13.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
  NEXTAUTH_SECRET: "ci-test-secret"
  NEXTAUTH_URL: "http://localhost:3000"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: pnpm test --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: npx prisma generate
      - run: npx playwright install --with-deps chromium
      - run: pnpm build
      - run: pnpm test:e2e

  deploy-preview:
    runs-on: ubuntu-latest
    needs: [lint, test]
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: [lint, test, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: "--prod"
```

### 13.2 PR Pipeline Summary

```
PR Opened → Lint + Type Check → Unit Tests → Integration Tests → E2E Tests → Preview Deploy
Main Merge → All of the above → Production Deploy to Vercel
```

### 13.3 Database Migration in CI

```yaml
# Added to deploy-production job
- name: Run Prisma migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
    DIRECT_URL: ${{ secrets.PROD_DIRECT_URL }}
```

### 13.4 Branch Protection Rules

- `main` branch requires:
  - All CI checks passing
  - At least 1 PR review approval
  - No direct pushes (force push disabled)
  - Linear history (squash merge only)

### 13.5 Scripts in `package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint && eslint . --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "postinstall": "prisma generate"
  }
}
```

---

## 14. LOGGING, MONITORING & ERROR HANDLING

### 14.1 Structured Logging

**Library:** `pino` (fast, structured JSON logs — Vercel-compatible)

```bash
pnpm add pino pino-pretty
```

```typescript
// src/lib/logger.ts
import pino from "pino"

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined, // JSON in production (for log aggregation)
})

// Usage in API routes:
// logger.info({ userId, kpiCode, actualValue }, "Actual submitted")
// logger.error({ error, userId }, "Score calculation failed")
// logger.warn({ userId, attempts: 4 }, "Login attempt approaching lockout")
```

**What to log:**

| Event | Level | Fields |
|---|---|---|
| User login success | `info` | `userId`, `email`, `ip` |
| User login failure | `warn` | `email`, `ip`, `attempt` |
| Account locked | `warn` | `email`, `ip`, `lockedUntil` |
| KPI actual submitted | `info` | `userId`, `kpiCode`, `periodId`, `actualValue` |
| KPI actual approved/rejected | `info` | `reviewerId`, `userId`, `kpiCode`, `status` |
| Scoring engine run | `info` | `adminId`, `periodId`, `usersScored`, `durationMs` |
| Score override | `warn` | `adminId`, `userId`, `snapshotId`, `oldScore`, `newScore`, `comment` |
| File uploaded | `info` | `userId`, `fileName`, `fileSize`, `kpiCode` |
| API validation error | `warn` | `route`, `errors`, `ip` |
| Unhandled error | `error` | `route`, `error.message`, `error.stack`, `userId` |
| Rate limit hit | `warn` | `ip`, `userId`, `route`, `retryAfter` |

**Never log:** passwords, tokens, full file contents, `SUPABASE_SERVICE_ROLE_KEY`

### 14.2 Error Tracking (Production)

**Service:** Sentry (`@sentry/nextjs`)

```bash
pnpm add @sentry/nextjs
```

**Configuration:**

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of requests traced
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Strip PII from error reports
    if (event.request?.headers) {
      delete event.request.headers["authorization"]
      delete event.request.headers["cookie"]
    }
    return event
  },
})
```

**Sentry captures:**

- Unhandled exceptions in API routes
- Unhandled rejections in Server Components
- React error boundary crashes on the client
- Slow API responses (> 5 seconds)
- Failed Supabase queries

### 14.3 Global Error Handling

**API route wrapper:**

```typescript
// src/lib/api-handler.ts
import { NextRequest, NextResponse } from "next/server"
import { logger } from "./logger"
import * as Sentry from "@sentry/nextjs"
import { error } from "./api-response"
import { getServerSession } from "next-auth"

type Handler = (
  req: NextRequest,
  context: { session: Session; params?: Record<string, string> }
) => Promise<NextResponse>

export function withAuth(handler: Handler, requiredRole?: Role) {
  return async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    try {
      const session = await getServerSession()
      if (!session) return error(401, "UNAUTHORIZED", "Not authenticated")
      if (requiredRole && session.user.role !== requiredRole && session.user.role !== "ADMIN") {
        return error(403, "FORBIDDEN", "Insufficient permissions")
      }
      return await handler(req, { session, params: ctx?.params })
    } catch (err) {
      logger.error({ error: err, route: req.url, method: req.method }, "Unhandled API error")
      Sentry.captureException(err)
      return error(500, "INTERNAL_ERROR", "An unexpected error occurred")
    }
  }
}
```

**React error boundary (client-side):**

```typescript
// src/components/shared/ErrorBoundary.tsx
"use client"
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="p-8 text-center">
      <h2 className="text-xl font-bold text-red-500">Something went wrong</h2>
      <p className="mt-2 text-gray-400">{error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-blue-600 rounded">
        Try again
      </button>
    </div>
  )
}
```

**Next.js error pages:**

```
src/app/
├── error.tsx          # Global error page (catches RSC errors)
├── not-found.tsx      # Custom 404
├── (app)/
│   └── error.tsx      # App-scoped error page
└── (auth)/
    └── error.tsx      # Auth-scoped error page
```

### 14.4 Health Check Endpoint

```typescript
// src/app/api/health/route.ts
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: process.env.npm_package_version || "unknown",
    })
  } catch {
    return Response.json({ status: "unhealthy", database: "disconnected" }, { status: 503 })
  }
}
```

---

## 15. DATA MIGRATION PLAN

### 15.1 Existing Data Sources

The Cost Control department likely has historical KPI data in:

| Source | Format | What It Contains |
|---|---|---|
| Oracle ERP R12 | Database / exports | Approval timestamps, PO/PR data (Pillar A actuals) |
| Excel spreadsheets | `.xlsx` | Manual KPI tracking, historical scores, attendance logs |
| SharePoint | Files + metadata | Report submission dates, PAG documents |
| HR system | Database / exports | Attendance records, on-time arrival (Pillar E) |
| Outlook | Email logs | Complaint counts, stakeholder communications (Pillar D) |

### 15.2 Migration Strategy

**Phase 1 — Clean Start (MVP launch):**

- Seed database with KPI definitions, targets, and weights only (no historical actuals)
- Users start fresh — first evaluation period is the "go-live" month
- Historical data remains in Excel for reference

**Phase 2 — Backfill (Post-launch, optional):**

- Import last 3–6 months of historical actuals via CSV upload
- Admin bulk-imports historical data through a dedicated import page
- Each import is validated against Zod schemas before insertion
- All imported records are marked with `source: "MIGRATION"` in the audit log

### 15.3 CSV Import Format

Standard import template for each pillar:

```csv
employee_id,kpi_code,eval_period,actual_value,binary_value,notes
905-27875,A1.1,2025-01,94.5,,Imported from Oracle ERP export
905-27875,B4,2025-01,,true,Pass — verified by governance audit
905-27875,D1,2025-01,3,,3 complaint emails logged
```

**Import validation rules:**

- `employee_id` must match an existing user
- `kpi_code` must match an existing KPI definition
- `eval_period` must match an existing (or auto-created) evaluation period
- `actual_value` is required for numeric KPIs; `binary_value` for binary KPIs
- Duplicates (same employee + KPI + period) are rejected with a clear error message

### 15.4 Import API

```
POST /api/admin/import
Content-Type: multipart/form-data
Body: { file: CSV, periodId: string, dryRun: boolean }

Response:
{
  "data": {
    "total": 150,
    "valid": 142,
    "errors": [
      { "row": 12, "field": "employee_id", "message": "User 905-99999 not found" },
      { "row": 45, "field": "actual_value", "message": "Value 105 exceeds maximum of 100" }
    ],
    "imported": 142  // 0 if dryRun=true
  }
}
```

### 15.5 Oracle ERP Integration (Future)

For automated Pillar A data (approval timestamps), a future phase can:

1. Create a Supabase Edge Function that runs nightly
2. Connects to Oracle ERP via a read-only DB link or REST API
3. Pulls new approval records since last sync
4. Calculates on-time percentages
5. Creates `kpi_actuals` records with `source: "ORACLE_ERP"`
6. Requires: Oracle ERP credentials, VPN/network access, ETL mapping document

---

## 16. BACKUP, RECOVERY & CONCURRENCY

### 16.1 Supabase Backup Configuration

**Automatic Backups (included in Supabase):**

| Plan | Backup Frequency | Retention | Point-in-Time Recovery (PITR) |
|---|---|---|---|
| Free | Daily | 7 days | ❌ |
| Pro ($25/mo) | Daily | 7 days | ✅ (up to 7 days) |
| Team ($599/mo) | Daily | 14 days | ✅ (up to 14 days) |

**Recommendation:** Use the **Pro plan** for production — PITR is essential for a system that stores employee performance data. If an admin accidentally publishes wrong scores, you can restore to the exact minute before the mistake.

**Manual Backup Strategy (belt and suspenders):**

```bash
# Weekly manual backup via pg_dump (run as a cron job or GitHub Action)
pg_dump "$DATABASE_URL" --format=custom --file="backup_$(date +%Y%m%d).dump"

# Store backups in a separate Supabase Storage bucket or external S3
```

### 16.2 Recovery Procedures

| Scenario | Recovery Method | RPO | RTO |
|---|---|---|---|
| Accidental record deletion | PITR via Supabase Dashboard → restore to specific timestamp | < 1 minute | 15–30 minutes |
| Wrong scores published | Soft-delete snapshots + re-run scoring engine | 0 (data still in actuals) | 5 minutes |
| Database corruption | Restore from daily backup | Up to 24 hours (free) / minutes (Pro PITR) | 30–60 minutes |
| Supabase outage | Wait for Supabase recovery (99.9% SLA on Pro) | N/A | Depends on Supabase |
| Accidental schema migration | Revert Prisma migration + restore data | Depends on backup | 30 minutes |

**Critical rule:** Never use `prisma migrate reset` on production. Use `prisma migrate deploy` only, and always test migrations on a staging Supabase project first.

### 16.3 Soft Delete Policy

No records in this system should be **hard deleted** (except password reset tokens after use). All "deletes" are soft deletes:

- Users: `isActive = false` (never remove the row)
- KPI definitions: `isActive = false`
- Assignments: `isActive = false`
- Score snapshots: never deleted — keep full history
- Audit logs: immutable — never deleted or modified

This ensures full auditability and enables recovery without backups for most scenarios.

### 16.4 Concurrency Handling

**Problem:** Multiple admins or automated processes could conflict when writing to the same records simultaneously.

**Scenario 1: Two admins override the same score simultaneously**

**Solution:** Optimistic concurrency control with version column.

```prisma
model ScoreSnapshot {
  // ... existing fields
  version   Int      @default(1)  // Incremented on each update
}
```

```typescript
// Override API: check version before updating
const snapshot = await prisma.scoreSnapshot.findUnique({ where: { id } })
if (snapshot.version !== expectedVersion) {
  return error(409, "CONFLICT", "This score was modified by another user. Please refresh and try again.")
}
await prisma.scoreSnapshot.update({
  where: { id, version: expectedVersion },
  data: { ...newData, version: { increment: 1 } },
})
```

**Scenario 2: User submits actual while admin runs scoring engine**

**Solution:** Scoring engine locks the evaluation period during calculation.

```typescript
// Before running scoring:
const period = await prisma.evalPeriod.update({
  where: { id: periodId, isClosed: false },
  data: { isLocked: true }, // New column: prevents new submissions
})

try {
  // ... run scoring engine
} finally {
  await prisma.evalPeriod.update({
    where: { id: periodId },
    data: { isLocked: false },
  })
}

// In the submit actual API:
const period = await prisma.evalPeriod.findUnique({ where: { id: periodId } })
if (period.isLocked) {
  return error(422, "UNPROCESSABLE", "This evaluation period is currently being scored. Please try again in a few minutes.")
}
```

Add `isLocked` to the `EvalPeriod` model:

```prisma
model EvalPeriod {
  // ... existing fields
  isLocked    Boolean  @default(false)  // True while scoring engine is running
}
```

**Scenario 3: Two users upload evidence for the same KPI simultaneously**

**Solution:** No conflict — both uploads succeed. The `evidence_files` table allows multiple files per actual. The unique constraint is on `(assignmentId, evalPeriodId)` in `kpi_actuals`, not on evidence files.

**Scenario 4: Prisma transaction for multi-table writes**

All operations that write to multiple tables must use Prisma interactive transactions:

```typescript
await prisma.$transaction(async (tx) => {
  const actual = await tx.kpiActual.update({ ... })
  await tx.auditLog.create({ ... })
  await tx.notification.create({ ... })
  // If any step fails, all changes are rolled back
})
```

Transaction timeout: `prisma.$transaction(..., { timeout: 10000 })` (10 seconds max for scoring engine).

---

## 17. THIRD-PARTY SERVICES & API KEYS

### 17.1 Required Services (Must Have Before Development)

| # | Service | Role in the App | Keys / Tokens Required | Free Tier | Signup URL |
|---|---|---|---|---|---|
| 1 | **Supabase** | Hosted PostgreSQL database, connection pooling (PgBouncer), file storage (evidence uploads), Row Level Security | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` | Yes — 500 MB DB, 1 GB storage, 2 GB bandwidth, 2 projects | [supabase.com/dashboard](https://supabase.com/dashboard) |
| 2 | **AN Platform** (21st.dev) | Hosts the embedded AI KPI Assistant agent in sandboxed E2B environments, handles streaming relay | `AN_API_KEY` | Check [an.dev](https://an.dev) for current tiers | [an.dev](https://an.dev) |
| 3 | **Vercel** | Hosts the Next.js frontend + serverless API routes, auto-deploys from GitHub | None — uses GitHub OAuth for deploy | Yes — hobby tier (unlimited projects, 100 GB bandwidth) | [vercel.com](https://vercel.com) |

### 17.2 Self-Generated Secrets (No External Account Needed)

| Secret | Purpose | How to Generate |
|---|---|---|
| `NEXTAUTH_SECRET` | Signs and encrypts JWT session cookies | `openssl rand -base64 32` |

### 17.3 Development Tools & Libraries (No API Key Required)

| Tool | Purpose | Install |
|---|---|---|
| **Spec Kit** (github/spec-kit) | Spec-Driven Development workflow — slash commands for specify, plan, tasks, implement | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` |
| **AN SDK** (21st-dev/an-sdk) | Agent definition framework + React chat widget + Next.js integration + CLI for deploy | `pnpm add @an-sdk/agent @an-sdk/react @an-sdk/nextjs @an-sdk/node` |
| **Supabase CLI** | Local development instance (offline PostgreSQL + Storage) | `brew install supabase/tap/supabase` or `npm install -g supabase` |
| **Prisma** | ORM, schema management, migrations, type-safe queries | `pnpm add -D prisma && pnpm add @prisma/client` |
| **TanStack Query** | Client-side data fetching, caching, mutations | `pnpm add @tanstack/react-query` |
| **Zod** | Schema validation for API inputs and forms | `pnpm add zod` |
| **next-intl** | Internationalization (i18n) framework for Next.js App Router | `pnpm add next-intl` |
| **pino** | Structured JSON logging | `pnpm add pino pino-pretty` |
| **Vitest** | Unit + integration test runner | `pnpm add -D vitest @testing-library/react jsdom` |
| **Playwright** | End-to-end browser testing | `pnpm add -D playwright` |
| **Framer Motion** | Animations and page transitions | `pnpm add framer-motion` |

### 17.4 Optional Future Services (Not Needed for MVP)

| # | Service | When You'd Need It | Keys Required | Free Tier | Signup URL |
|---|---|---|---|---|---|
| 1 | **Sentry** | Production error tracking and performance monitoring | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Yes — 5K errors/month, 10K transactions | [sentry.io](https://sentry.io) |
| 2 | **Upstash Redis** | Serverless rate limiting (API protection) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Yes — 10K commands/day | [upstash.com](https://upstash.com) |
| 3 | **SendGrid** or **Resend** | Email notifications (deadline reminders, score published alerts) | API key | SendGrid: 100 emails/day free; Resend: 3,000 emails/month free | [sendgrid.com](https://sendgrid.com) / [resend.com](https://resend.com) |
| 4 | **Azure AD** | SSO login via Microsoft corporate accounts | OAuth Client ID + Client Secret + Tenant ID | Free with any Azure subscription | [portal.azure.com](https://portal.azure.com) → App Registrations |
| 5 | **Google Workspace** | SSO login via Google corporate accounts | OAuth Client ID + Client Secret | Free (OAuth consent screen) | [console.cloud.google.com](https://console.cloud.google.com) → APIs & Credentials |
| 6 | **Anthropic API** | Direct LLM access if replacing AN SDK with a self-hosted AI assistant | `ANTHROPIC_API_KEY` | No free tier — pay per token | [console.anthropic.com](https://console.anthropic.com) |
| 7 | **ClamAV** | Server-side virus scanning for uploaded evidence files | None (self-hosted) | Open source | [clamav.net](https://www.clamav.net) |
| 8 | **Codecov** | Test coverage reporting in CI | `CODECOV_TOKEN` | Yes — free for open source + small teams | [codecov.io](https://codecov.io) |

### 17.5 Where Each Key Goes

```
.env.local
├── Supabase ────────────── NEXT_PUBLIC_SUPABASE_URL
│                           NEXT_PUBLIC_SUPABASE_ANON_KEY
│                           SUPABASE_SERVICE_ROLE_KEY     ← server-only, never in client code
│                           DATABASE_URL                   ← pooled (port 6543)
│                           DIRECT_URL                     ← direct (port 5432, migrations only)
│
├── NextAuth ────────────── NEXTAUTH_URL
│                           NEXTAUTH_SECRET                ← self-generated
│
├── AN SDK ──────────────── AN_API_KEY
│                           AN_AGENT_SLUG
│                           NEXT_PUBLIC_AN_AGENT_SLUG
│
├── App Config ──────────── NEXT_PUBLIC_APP_NAME
│                           NEXT_PUBLIC_COMPANY_NAME
│
└── Future (optional) ───── SENDGRID_API_KEY
                            AZURE_AD_CLIENT_ID
                            AZURE_AD_CLIENT_SECRET
                            AZURE_AD_TENANT_ID
                            ANTHROPIC_API_KEY
                            NEXT_PUBLIC_SENTRY_DSN
                            SENTRY_AUTH_TOKEN
                            UPSTASH_REDIS_REST_URL
                            UPSTASH_REDIS_REST_TOKEN
                            CODECOV_TOKEN
```

### 17.6 Security Rules for Keys

- **`SUPABASE_SERVICE_ROLE_KEY`** bypasses all RLS — import ONLY in `src/lib/supabase/server.ts`, never in any file under `src/components/` or any file starting with `"use client"`
- **`NEXT_PUBLIC_*`** prefixed variables are exposed to the browser — only put non-sensitive values here (Supabase URL, anon key, app name, agent slug)
- **`AN_API_KEY`** should stay server-side — the agent handler in `src/app/api/agent/route.ts` uses it, not the React widget
- Never commit `.env.local` — the `.gitignore` must include it; use `.env.example` as the template
- On Vercel, add all keys via **Project Settings → Environment Variables** and scope them to the correct environment (Production / Preview / Development)

### 17.7 Quick Start Checklist

```
Before first `pnpm dev`:

□ 1. Create Supabase project          → Get URL + keys
□ 2. Copy .env.example → .env.local   → Paste Supabase keys
□ 3. Generate NEXTAUTH_SECRET         → openssl rand -base64 32
□ 4. Run prisma db push               → Creates tables in Supabase
□ 5. Run prisma db seed               → Loads 31 KPIs + targets + weights
□ 6. Sign up on an.dev                → Get AN_API_KEY
□ 7. Deploy agent: npx @an-sdk/cli deploy
□ 8. pnpm dev                         → App runs on localhost:3000
```

---

## 18. ENVIRONMENT VARIABLES

```env
# .env.example

# Supabase — Database
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase — Client Keys
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY=""       # Public anon key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=""           # Server-only — never expose to client

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# App
NEXT_PUBLIC_APP_NAME="CC KPI Tracker"
NEXT_PUBLIC_COMPANY_NAME="Elsewedy Electric"

# AN SDK (AI Assistant)
AN_API_KEY=""               # AN Platform API key
AN_AGENT_SLUG="cc-kpi-assistant"
NEXT_PUBLIC_AN_AGENT_SLUG="cc-kpi-assistant"
```

### 18.1 Supabase Connection Notes

- **`DATABASE_URL`** (pooled, port 6543): Used by Prisma Client at runtime — goes through Supabase's PgBouncer in **Transaction mode** for optimal connection pooling with serverless functions
- **`DIRECT_URL`** (direct, port 5432): Used by Prisma Migrate and `prisma db push` — requires a direct connection because migrations use features incompatible with PgBouncer
- **`SUPABASE_SERVICE_ROLE_KEY`**: Bypasses RLS — used server-side only for admin operations (generating signed Storage URLs, running scoring engine). **Never import this in client components.**
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: Safe for client-side — used with Supabase client for Storage uploads where RLS policies restrict access

---

## 19. SUPABASE PROJECT SETUP

### 19.1 Create the Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Set project name: `cc-kpi-tracker`
3. Set database password (save this — it goes in `DATABASE_URL`)
4. Select region closest to your team (e.g., `aws-eu-central-1` for MENA)
5. Wait for provisioning (~2 minutes)

### 19.2 Get Connection Strings

Go to **Project Settings → Database → Connection String**:

- Copy the **URI** tab → paste as `DATABASE_URL` (uses port `6543`, pooled)
- Copy the **URI** tab under "Direct connection" → paste as `DIRECT_URL` (uses port `5432`)

Go to **Project Settings → API**:

- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 19.3 Initialize Prisma Against Supabase

```bash
# Push schema to Supabase
npx prisma db push

# Seed the database
npx prisma db seed

# Generate Prisma Client
npx prisma generate
```

> **Important:** Use `prisma db push` for initial setup and prototyping. Switch to `prisma migrate dev` once the schema stabilizes, as it creates versioned migration files for production deployments.

### 19.4 Supabase Storage Setup

Create the evidence bucket via Supabase Dashboard → **Storage → New Bucket**:

- **Name**: `kpi-evidence`
- **Public**: OFF (private bucket)
- **File size limit**: 50 MB
- **Allowed MIME types**: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, application/vnd.openxmlformats-officedocument.presentationml.presentation, image/png, image/jpeg, application/zip`

Then apply the RLS policies from Section 8.3 via the **SQL Editor**.

### 19.5 Supabase Client Setup in Next.js

```typescript
// src/lib/supabase/server.ts
import { createClient } from "@supabase/supabase-js"

// Server-side client with service role (bypasses RLS)
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// src/lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js"

// Client-side with anon key (respects RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 19.6 File Upload Flow (via Supabase Storage)

```typescript
// src/lib/file-storage.ts
import { createServiceClient } from "./supabase/server"

export async function uploadEvidence(
  file: Buffer,
  fileName: string,
  userId: string,
  periodId: string,
  companyId: string
): Promise<string> {
  const supabase = createServiceClient()
  const path = `${companyId}/${userId}/${periodId}/${Date.now()}_${fileName}`

  const { data, error } = await supabase.storage
    .from("kpi-evidence")
    .upload(path, file, { upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)
  return data.path
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage
    .from("kpi-evidence")
    .createSignedUrl(storagePath, 3600) // 1 hour expiry

  if (error) throw new Error(`Signed URL failed: ${error.message}`)
  return data.signedUrl
}
```

### 19.7 Local Development Option

For offline development, use the Supabase CLI to run a local instance:

```bash
# Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# or: npm install -g supabase

# Initialize local Supabase
supabase init
supabase start

# Local connection string (auto-generated)
# DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
# DIRECT_URL same as above for local

# Stop when done
supabase stop
```

### 19.8 Dependencies

```bash
pnpm add @supabase/supabase-js
# Prisma is already in the project for ORM — Supabase is just the hosted PostgreSQL
```

> **Architecture note:** Prisma remains the primary ORM for all database operations. The Supabase JS client is used **only** for Storage (file uploads/downloads) and optionally for Realtime subscriptions (future enhancement). This keeps the data layer consistent and avoids mixing two query patterns.

---

## 20. KEY TECHNICAL DECISIONS & NOTES

### 20.1 Why Prisma over raw SQL?

Type-safe queries, auto-generated client, easy migrations, excellent Next.js integration. The schema acts as single source of truth for the database.

### 20.2 Why Supabase?

Supabase provides a managed PostgreSQL instance with built-in connection pooling (PgBouncer), a Storage API for file evidence uploads (eliminating the need for a separate S3 setup), Row Level Security for defense-in-depth, and a generous free tier for development. The Prisma + Supabase combination gives us type-safe queries with zero infrastructure management. Supabase's direct connection support ensures Prisma Migrate works seamlessly for schema versioning.

### 20.3 Scoring Engine Must Be Server-Side Only

All scoring calculations run server-side in `/api/kpis/scoring/run`. Never expose scoring logic to the client. Scores are stored as snapshots — the engine recalculates only when triggered by an admin.

### 20.4 File Evidence Best Practices

- Never serve uploaded files directly — always go through a Next.js API route that checks auth, then generates a Supabase Storage signed URL (1-hour expiry)
- Store file metadata in DB (`evidence_files` table), actual bytes in Supabase Storage bucket `kpi-evidence`
- Use the Supabase service role client server-side to generate signed URLs
- Client-side uploads use the anon key with RLS policies restricting to the user's own folder

### 20.5 Theme System

Use CSS custom properties mapped via Tailwind's `darkMode: "class"` strategy. The theme toggle sets a `dark` class on `<html>` and persists to `localStorage`.

### 20.6 Performance Considerations

- Use React Server Components for data-heavy pages (dashboard, team overview)
- Client Components only for interactive elements (forms, charts, theme toggle)
- Prisma queries: always use `select` to limit fields, `include` only needed relations
- Add database indexes on: `kpi_actuals(userId, evalPeriodId)`, `kpi_assignments(userId, evalPeriodId)`, `score_snapshots(userId, evalPeriodId)`
- Supabase connection pooling (PgBouncer via port 6543) handles serverless cold starts — no connection exhaustion on Vercel
- Use Supabase's built-in Realtime for future live score updates (subscribe to `score_snapshots` table changes)

### 20.7 Manager Alpha Calculation — Edge Cases

- If a TL/SH manages 0 team members → skip team component, use 100% personal score
- If a TL/SH manages multiple teams → team pillar % = weighted average by member count
- If some team members have no approved actuals for a KPI → exclude them from team average (don't penalize for missing data)

### 20.8 Why AN SDK for the AI Assistant

AN SDK provides the complete agent infrastructure (sandbox execution, streaming, React widget, Next.js integration) out of the box. Alternatives like building a raw LLM chat would require implementing streaming, tool calling, session management, and UI from scratch. AN SDK handles all of this and deploys the agent to a sandboxed E2B environment, keeping the main app server lean.

The agent uses **custom tools** (not RAG) to query the database — this ensures answers are always grounded in real, current data rather than embedding-based retrieval that can drift.

### 20.9 Why Spec Kit for Development Workflow

Building 31 KPIs with tier-specific weights, targets, and a multi-layer scoring engine is too complex for ad-hoc development. Spec Kit enforces:

- **Specification before code** — each feature's business rules are locked in `spec.md` before any implementation
- **Plan validation** — `/speckit.analyze` catches gaps between spec and plan before wasting implementation time
- **Task dependency ordering** — complex features like the scoring engine have 15+ interdependent tasks; Spec Kit's `tasks.md` ensures correct sequencing
- **Traceability** — every line of code traces back to a specification, critical for an enterprise system managing employee performance data
- **Constitution enforcement** — the governing principles (strict TypeScript, audit logging, server-side scoring) are consistently applied across all 12 features

---

## 21. DEMO CREDENTIALS (Seed Data)

```
Admin:    admin@elsewedy.com     / Admin@2025
Manager:  manager@elsewedy.com   / Manager@2025
User:     engineer@elsewedy.com  / User@2025
```

---

## 22. CODING STANDARDS

- **TypeScript strict mode** — no `any` types
- **Prisma**: use transactions for multi-table writes
- **API routes**: validate all inputs with Zod
- **Error handling**: consistent `{ error: string, code: string }` response shape
- **Naming**: camelCase for TS, snake_case for DB columns (Prisma handles mapping)
- **Components**: one component per file, co-locate styles and types
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`)
- **Spec Kit**: every feature starts with `/speckit.specify` — no code without a spec

---

## 23. FUTURE ENHANCEMENTS (Post-MVP)

- [ ] Automated data pull from Oracle ERP API
- [ ] AI-powered insights ("Your FU% trend suggests declining forecast accuracy")
- [ ] Email notifications via SendGrid/Resend
- [ ] SSO with Azure AD / Google Workspace
- [ ] Mobile-optimized PWA
- [ ] Historical trend analytics with drill-through
- [ ] Bulk CSV import for actuals
- [ ] Governance audit sheet generator
- [ ] Integration with HR attendance system
- [ ] Power BI embedded dashboards alongside native charts
- [ ] Supabase Realtime: live score updates on dashboard when admin publishes scores
- [ ] Supabase Edge Functions: automated deadline reminder notifications
- [ ] Supabase Auth migration: replace NextAuth with Supabase Auth for unified auth+storage RLS
- [ ] AN SDK agent enhancements: multi-language support (Arabic), voice input, proactive alerts
- [ ] AN SDK manager agent: separate agent for managers with team-level query tools
- [ ] Spec Kit CI integration: run `/speckit.analyze` in GitHub Actions on every PR to validate spec coverage
