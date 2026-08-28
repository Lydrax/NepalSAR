# NEPAL RESCUE (नेपाल उद्धार)
### Mobile-First Emergency Rescue Coordination Platform (MVP)

---

## 1. Project Overview

**NEPAL RESCUE** is a mobile-first emergency rescue coordination system for disaster-response operations in Nepal. It provides a structured communication channel connecting:

1. People requiring immediate emergency assistance
2. Verified search & rescue (SAR) responders
3. Dispatchers and coordinators orchestrating crisis operations

> **CRITICAL OPERATIONAL DISCLAIMER:**  
> This service is a prototype emergency coordination platform and is **not an official government emergency service**. Submitting a request **does not guarantee rescue**. Where connectivity and circumstances permit, individuals in life-threatening distress should contact official national emergency hotlines directly:
> * **Nepal Police:** `100`
> * **Fire Brigade (Damkal):** `101`
> * **Ambulance (EMS):** `102`
> * **Traffic Police:** `103`
> * **National Emergency Operation Centre (NEOC / MoHA Helpline):** `1155`

---

## 2. Architecture

```text
                    PUBLIC CLIENT
               (Mobile First Web App)
                         │
                         │ HTTPS
                         ▼
                 SERVER VALIDATION & API
              (/api/rescue/submit, /api/rescue/status)
                         │
                         ▼
             SUPABASE BACKEND (PostgreSQL)
        ┌────────────────┼────────────────┐
        │                │                │
     Database         Storage          (Future)
    (RLS Enabled)  (Private Bucket)   Realtime
        │
        ▼
   RESPONDER DASHBOARD
 (Role-Based: Responder / Dispatcher / Admin)
```

**Currently implemented:** public submission/tracking, responder operations dashboard, Leaflet maps, server-side validation, hashed verification tokens, audit logging, and 20-second polling for status updates.

**Future phases (not yet implemented):** service-worker offline sync, photo upload UI/API, Supabase Realtime subscriptions, external dispatch integrations.

---

## 3. Local Setup

### Prerequisites
* **Node.js**: >= 20.x / 22.x
* **npm**: >= 10.x
* **Supabase project** with migrations applied

### Installation
```bash
# Clone the repository
git clone https://github.com/org/nepal-rescue.git
cd NepalSAR

# Install dependencies
npm install

# Copy environment template and configure credentials
cp .env.example .env.local

# Run Next.js local development server
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 4. Supabase Setup

1. Create a new project in [Supabase](https://supabase.com).
2. Note your `Project URL`, `anon (public) key`, and `service_role (secret) key`.
3. Apply SQL migrations sequentially from `supabase/migrations/`.
4. Confirm the private storage bucket `rescue-photos` exists (created by migration).
5. Create at least one Supabase Auth user and matching `profiles` row for responder testing.

---

## 5. SQL Migrations

Database migrations are located in `supabase/migrations/`. Never apply manual schema modifications directly through the UI.

Core database tables:
* `profiles`: Authorized responder profiles, roles (`RESPONDER`, `DISPATCHER`, `ADMIN`), and agency affiliations.
* `rescue_requests`: Main emergency case table with database-assigned case numbers `NR-YYYY-XXXXXX` via `generate_case_number()`.
* `rescue_request_events`: Append-only, tamper-proof operational audit trail.
* `rescue_request_access`: Secure hashed token credentials for public case status verification.
* `rescue_request_photos`: Metadata table for future private photo support.

---

## 6. Environment Variables

Create `.env.local` using `.env.example`:

| Variable | Environment | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anonymous public API key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Only** | Administrative backend service key |

**Important:** The service role key must never be placed in a `NEXT_PUBLIC_*` variable or exposed to browser bundles. If credentials are missing at runtime, server APIs return a clear configuration error instead of attempting a silent placeholder connection.

---

## 7. Authentication Setup

* **Public Users:** Anonymous submissions through validated server APIs. No registration required. Public tracking uses high-entropy verification tokens generated at submission time and stored only as SHA-256 hashes in the database.
* **Responders:** Provisioned directly by administrators using Supabase Auth plus a `profiles` row. Public registration is disabled.

---

## 8. Storage Setup

* The migration creates a **private** Supabase bucket (`rescue-photos`).
* **Photo upload is not yet implemented in the application UI/API.** The schema and bucket exist for a future phase.

---

## 9. Row Level Security (RLS) Explanation

Row Level Security (RLS) is enabled across all tables:

1. **`rescue_requests`**:
   * Public/anonymous clients do **not** insert or select directly. Submissions go through `/api/rescue/submit` using the server-side service role.
   * Authenticated responders can `SELECT` and `UPDATE` through RLS helper functions.
2. **`rescue_request_access`**: No direct client access. Token verification is server-only.
3. **`rescue_request_events`**: Append-only; updates and deletes are blocked by trigger.

---

## 10. Running Tests

```bash
# Type checking
npx tsc --noEmit

# Lint
npm run lint

# Unit and security tests (Vitest)
npm test

# Production build
npm run build
```

---

## 11. Connectivity & Mobile UX

* The header shows an **ONLINE / OFFLINE** badge based on browser connectivity.
* The request flow is mobile-first with large touch targets, GPS acquisition, map pin fallback, and manual location description.
* If submission fails due to network or server error, the UI clearly states that the request has **not** reached the rescue coordination server.
* **There is no offline submission queue yet.** Requests are not treated as submitted unless the backend confirms success.

---

## 12. Idempotent Submission & Credential Recovery

* Each submission carries a persistent `client_request_id` (UUID) stored in `sessionStorage` during the active draft.
* On first successful submission, the browser stores the case number and verification token locally.
* If the same `client_request_id` is submitted again, the server returns the existing case without creating a duplicate.
* The server cannot recover the original plaintext verification token because only its hash is stored.
* If the browser still has the saved credentials, they are restored automatically. Otherwise the UI explains that the verification credential cannot be recovered.

---

## 13. Deployment

Target platforms:
* **Frontend/API:** Vercel / Cloudflare Pages
* **Database & Storage:** Supabase / Managed PostgreSQL
* **Edge Protection:** Cloudflare or platform WAF rate-limiting on `/api/rescue/*`

The current rate limiter is in-memory and suitable for MVP/single-instance testing. Distributed rate limiting (e.g. Redis/Upstash) is a future deployment upgrade.

---

## 14. Security Model & Defensive Controls

* **Zero Public Enumeration:** Public endpoints never expose case lists or personal identifiers.
* **Database Case Numbers:** Assigned by PostgreSQL sequence via `generate_case_number()`; the API does not generate case numbers client-side.
* **Deterministic Priority Engine:** Server-side rules only:
  * `CRITICAL`: Life-threatening injury OR trapped + serious injury.
  * `HIGH`: Trapped OR serious injury.
  * `NORMAL`: Stranded / evacuation with minor or no injury.
* **Immutable Audit Trails:** Every status transition records timestamp, author, previous state, and action.
* **Assignment Concurrency:** Responder self-assignment uses optimistic locking on case status in the database/API layer.

---

## 15. Emergency-Service Disclaimer

Nepal Rescue is engineered as a prototype for coordination in crisis scenarios. It does not claim government affiliation or guarantee official rescue response. All public views explicitly mandate checking official channels.

---

## 16. Known Limitations

* Geolocation accuracy depends on device hardware and conditions; manual location descriptions remain essential.
* No offline rescue submission queue.
* No photo upload workflow yet.
* No Supabase Realtime integration yet; public tracking and responder queue use polling.
* Map tiles require network access; offline tile caching is a future enhancement.

---

## 17. Public API Contract & Specifications

### 1. Submit Rescue Request
* **Endpoint:** `POST /api/rescue/submit`
* **Authentication:** Public (Rate limited to 15 req/min per IP)
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "client_request_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "latitude": 27.7172,
  "longitude": 85.3240,
  "location_accuracy": 15,
  "location_source": "GPS",
  "manual_location": "",
  "people_count": 3,
  "immediate_danger": "trapped",
  "injury_level": "serious",
  "disaster_type": "flood",
  "disaster_other": "",
  "description": "Trapped on second floor. Water rising.",
  "phone_number": "9812345678"
}
```
* **Success Response (201 / 200 for idempotent duplicate):**
```json
{
  "success": true,
  "caseNumber": "NR-2026-000184",
  "verificationToken": "nrt_v1_7f8a9b...",
  "status": "SUBMITTED",
  "createdAt": "2026-08-28T05:30:00.000Z"
}
```
* **Idempotent duplicate response (200):**
```json
{
  "success": true,
  "caseNumber": "NR-2026-000184",
  "status": "SUBMITTED",
  "createdAt": "2026-08-28T05:30:00.000Z",
  "isExisting": true
}
```
* **Error Response (422 Validation Error / 429 Rate Limit / 503 Server Not Configured):**
```json
{
  "error": "Validation failed.",
  "details": ["peopleCount must be an integer between 1 and 100."]
}
```

### 2. Check Case Status
* **Endpoint:** `POST /api/rescue/status`
* **Authentication:** Public with Dual Credentials (`caseNumber` + `verificationToken`)
* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "caseNumber": "NR-2026-000184",
  "verificationToken": "nrt_v1_7f8a9b..."
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "caseNumber": "NR-2026-000184",
  "status": "SUBMITTED",
  "submittedAt": "2026-08-28T05:30:00.000Z",
  "lastUpdatedAt": "2026-08-28T05:30:00.000Z"
}
```
* **Security Behavior:**
  * If the case does not exist, or if the token hash does not match, the endpoint returns a uniform `404` error (`"Unable to verify this request. Please check your Case ID and Verification Token."`) to prevent case number enumeration.
  * Sensitive data (exact coordinates, phone number, responder name, internal triage notes) is strictly excluded from public responses.
