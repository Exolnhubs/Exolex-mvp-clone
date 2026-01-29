# ExoLex MVP - Comprehensive Codebase Assessment

**Date:** January 29, 2026
**Assessed by:** Automated Code Review
**Branch:** `claude/assess-codebase-security-D43cs`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Codebase Paradigm & Architecture](#2-codebase-paradigm--architecture)
3. [Data Security Assessment](#3-data-security-assessment)
4. [Feature Maturity Evaluation](#4-feature-maturity-evaluation)
5. [Critical Gaps Identified](#5-critical-gaps-identified)
6. [PLAN 1: Current Project Improvements](#6-plan-1-current-project-improvements)
7. [PLAN 2: Missing Features Implementation](#7-plan-2-missing-features-implementation-payment--twilio-sms-otp)

---

## 1. Executive Summary

ExoLex is a **multi-portal legal services platform** built with Next.js 14 (App Router), React 18, TypeScript, Supabase (PostgreSQL), and Tailwind CSS. The platform serves six distinct user roles (Member, Independent Lawyer, Legal Arm, Legal Arm Lawyer, Partner, Admin) with AI-powered legal assistance via OpenAI.

### Overall Scores

| Category | Score | Status |
|---|---|---|
| Architecture & Code Quality | **80/100** | Good |
| Data Security | **68/100** | Needs Attention |
| Feature Maturity (Core) | **75/100** | Good for MVP |
| Test Coverage | **0/100** | CRITICAL GAP |
| Payment Integration | **15/100** | UI Only - No Gateway |
| SMS/OTP Delivery | **20/100** | Database Only - No Twilio |
| Production Readiness | **45/100** | Not Ready |

### Verdict

The codebase has a **solid architectural foundation** with well-structured multi-role authentication, comprehensive input validation, and proper rate limiting. However, **three critical gaps** prevent production deployment: (1) zero test coverage, (2) no actual payment gateway integration, and (3) Twilio SMS is installed but not wired up for OTP delivery.

---

## 2. Codebase Paradigm & Architecture

### 2.1 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| UI Library | React | 18 |
| Language | TypeScript | 5 |
| CSS | Tailwind CSS | 3.4.1 |
| Database | Supabase (PostgreSQL) | Client 2.89.0 |
| AI | OpenAI | 6.15.0 |
| SMS | Twilio (installed, unused) | 5.11.2 |
| Deployment | Vercel | With cron jobs |

### 2.2 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # 9 API routes
│   │   ├── auth/set-cookies/     # Cookie-based auth
│   │   ├── auth/clear-cookies/   # Logout
│   │   ├── send-otp/             # OTP generation (no SMS delivery)
│   │   ├── verify-otp/           # OTP verification
│   │   ├── chat/                 # NOLEX AI for subscribers
│   │   ├── nolex/                # NOLEX AI for lawyers
│   │   ├── health/               # System health check
│   │   ├── referral/click/       # Referral tracking
│   │   └── reminders/process/    # Cron: reminder processing
│   ├── auth/                     # Login/register pages
│   ├── subscriber/               # Member portal (~20 pages)
│   ├── independent/              # Independent lawyer portal
│   ├── legal-arm/                # Legal arm admin portal
│   ├── legal-arm-lawyer/         # Legal arm lawyer portal
│   ├── partner/                  # Partner portal
│   └── marketplace/              # Public marketplace
├── components/                   # Reusable React components
├── lib/                          # Core utilities
│   ├── supabase-server.ts        # Session management (HMAC-SHA256)
│   ├── validate.ts               # Input validation & sanitization
│   ├── rate-limit.ts             # Rate limiting (memory + Redis)
│   ├── api-guard.ts              # Auth guards for API routes
│   ├── permissions.ts            # RBAC permission system
│   ├── cors.ts                   # CORS configuration
│   ├── logger.ts                 # Structured logging
│   └── error-tracker.ts          # Sentry integration
├── types/                        # TypeScript definitions
└── middleware.ts                  # Auth routing middleware
```

### 2.3 Architecture Pattern Assessment

**Strengths:**
- Clean separation between API routes and UI pages
- Utility libraries (`lib/`) encapsulate cross-cutting concerns
- Role-based middleware routing is well-structured
- TypeScript provides type safety throughout
- Supabase RLS policies add database-level security

**Weaknesses:**
- No service layer between API routes and database (direct Supabase calls)
- No repository pattern - database queries scattered across components
- Client-side components make direct Supabase calls (bypasses API guards)
- No dependency injection or IoC container
- Missing API documentation (no OpenAPI/Swagger)

### 2.4 Database Schema

20+ tables covering:
- `users` - Core user accounts with multi-role support
- `members` - Subscriber/member profiles
- `lawyers` - Lawyer profiles with specialization/workload
- `legal_arms` - Legal arm organizations
- `partners` / `partner_employees` - Partner organizations
- `service_requests` - Core service tickets
- `otp_verifications` - OTP codes with expiry
- `calendar_events` / `session_reminders` - Scheduling
- `notifications` - User notifications
- `packages` - Subscription packages
- `referral_clicks` - Referral tracking

---

## 3. Data Security Assessment

### 3.1 CRITICAL Vulnerabilities (Fix Immediately)

#### CRITICAL-1: Hardcoded Default Session Secret
- **File:** `src/lib/supabase-server.ts:104`
- **Code:** `const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production-min-32-chars'`
- **Risk:** If `SESSION_SECRET` env var is missing in production, anyone can forge session tokens using the known default string
- **Impact:** Complete authentication bypass
- **Fix:** Throw error on startup if `SESSION_SECRET` is not set in production

#### CRITICAL-2: OTP Code Leaked in Development Logs and Response
- **File:** `src/app/api/send-otp/route.ts:121-136`
- **Code:** OTP code logged to console AND returned in `debug_code` field
- **Risk:** OTP codes visible in server logs; `debug_code` could accidentally be left in production
- **Impact:** Authentication bypass via OTP interception
- **Fix:** Remove all OTP console logging; ensure `debug_code` is strictly gated

#### CRITICAL-3: Known Dependency Vulnerabilities
- **Package:** `next@14.2.35` has 2 known HIGH severity DoS vulnerabilities
- **Package:** `glob@10.x` has command injection vulnerability
- **Impact:** Denial of Service, potential command injection
- **Fix:** Upgrade Next.js and run `npm audit fix`

### 3.2 HIGH Severity Issues

#### HIGH-1: Auth Cookies Not httpOnly
- **File:** `src/app/api/auth/set-cookies/route.ts:26`
- **Code:** `httpOnly: false` on `exolex_user_id`, `exolex_user_type`, and all role cookies
- **Risk:** Any XSS vulnerability would allow cookie theft
- **Fix:** Make all auth cookies httpOnly; use server-side session for client-side routing needs

#### HIGH-2: OTP Generated with Math.random()
- **File:** `src/app/api/send-otp/route.ts:87`
- **Code:** `Math.floor(100000 + Math.random() * 900000).toString()`
- **Risk:** `Math.random()` is not cryptographically secure; OTP codes could be predictable
- **Fix:** Use `crypto.randomInt(100000, 999999)` from Node.js crypto module

#### HIGH-3: Session Secret Not Validated for Minimum Length
- **File:** `src/lib/supabase-server.ts:104`
- **Risk:** Weak secrets reduce HMAC-SHA256 effectiveness
- **Fix:** Validate SECRET is >= 32 characters at startup

### 3.3 MEDIUM Severity Issues

| Issue | File | Description |
|---|---|---|
| String interpolation in queries | `src/lib/permissions.ts:331` | `.or(\`assigned_lawyer_id.eq.${userId}\`)` - potential filter injection |
| No CSRF token verification | Middleware | CSRF header allowed but never validated |
| VAT rate hardcoded | `checkout/[id]/page.tsx:50` | `vatRate = 0.15` should be configurable |
| Cookie secure flag conditional | Multiple files | Only `secure: true` in production |
| Rate limit inconsistency | `src/lib/rate-limit.ts` | Sync and async versions coexist |
| Health endpoint leaks info | `src/app/api/health/route.ts` | Exposes environment and version without auth |

### 3.4 What's Done Well (Positive Security)

- HMAC-SHA256 session signing with timing-safe comparison
- Comprehensive input validation and sanitization (`validate.ts`)
- XSS detection and prevention (`containsXSS()`, `sanitizeHtml()`)
- Rate limiting on OTP sending (3/hour), verification (5/10min), and chat (30/min)
- Phone blocking after repeated failures
- CORS environment-aware origin allowlist
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Structured logging with sensitive data exclusion
- Supabase Row-Level Security policies
- Role-based middleware routing with proper redirects
- Sentry error tracking with data sanitization

### 3.5 Security Score Breakdown

| Security Area | Score | Notes |
|---|---|---|
| Authentication | 70/100 | Good design, weak secret handling |
| Authorization | 85/100 | Strong RBAC, middleware enforcement |
| Input Validation | 90/100 | Excellent sanitization library |
| Rate Limiting | 85/100 | Well implemented, async inconsistency |
| Session Management | 65/100 | httpOnly only on session cookie |
| Cryptography | 60/100 | Math.random() for OTP is weak |
| Dependencies | 40/100 | Known vulnerabilities unpatched |
| CORS | 80/100 | Proper origin allowlist |
| Logging | 90/100 | Structured, excludes sensitive data |
| Error Handling | 80/100 | Good, some console.error in prod |

---

## 4. Feature Maturity Evaluation

### 4.1 Fully Implemented Features (Production-Ready)

| Feature | Status | Quality |
|---|---|---|
| Multi-role authentication (OTP-based) | Complete | High |
| Session management (HMAC-SHA256) | Complete | High |
| Role-based middleware routing | Complete | High |
| NOLEX AI assistant (subscribers) | Complete | High |
| NOLEX AI assistant (lawyers) | Complete | High |
| Emergency keyword detection | Complete | High |
| Service request management | Complete | Medium |
| Calendar event scheduling | Complete | Medium |
| Reminder system (cron-based) | Complete | Medium |
| Notification system | Complete | Medium |
| Referral tracking | Complete | Medium |
| Rate limiting infrastructure | Complete | High |
| Input validation framework | Complete | High |
| Health monitoring endpoint | Complete | Medium |
| RBAC permissions system | Complete | High |

### 4.2 Partially Implemented Features

| Feature | What Exists | What's Missing |
|---|---|---|
| **OTP SMS Delivery** | DB storage, rate limiting, verification | Twilio integration (TODO at line 118) |
| **Payment/Checkout** | Full UI with Moyasar/Tabby/Tamara options | Actual gateway integration; payment is simulated |
| **Document Library Search** | UI with search bar | OpenAI integration for real answers (TODO) |
| **NOLEX Balance** | UI displays balance field | Actual balance calculation from packages |
| **Legal Arm Profile** | Form exists | Full data persistence flow |
| **Quote Payment Terms** | UI for single/installment | Backend processing of installments |

### 4.3 Missing Features (Not Implemented at All)

| Feature | Impact | Priority |
|---|---|---|
| **Automated Tests** | CRITICAL - No confidence in deployments | P0 |
| **Payment Gateway** | BLOCKING - Cannot monetize | P0 |
| **Twilio SMS OTP** | BLOCKING - Cannot authenticate in production | P0 |
| Document upload/download | HIGH - Core legal workflow | P1 |
| Invoice generation (PDF) | HIGH - Billing requirement | P1 |
| WebSocket real-time updates | MEDIUM - Better UX | P2 |
| API documentation | MEDIUM - Developer productivity | P2 |
| Subscription lifecycle (renewal/cancel) | HIGH - Revenue management | P1 |
| Audit logging | HIGH - Compliance requirement | P1 |
| Database seed data | LOW - Developer productivity | P3 |

### 4.4 Dead Code & Technical Debt

| Item | Location | Action Needed |
|---|---|---|
| Backup page file | `src/app/partner/requests/page_fixed4.tsx` | Delete |
| Duplicate page file | `src/app/partner/requests/[id]/page copy.tsx` | Delete |
| Console.log in production | `src/app/api/send-otp/route.ts:121-127` | Remove |
| Debug response field | `src/app/api/send-otp/route.ts:136` | Remove |
| Build skip flags | `next.config.mjs` | Remove SKIP_LINT / SKIP_TYPE_CHECK |

---

## 5. Critical Gaps Identified

### Gap 1: Zero Test Coverage
- No test framework configured (no Jest, Vitest, Playwright)
- No unit tests, integration tests, or E2E tests
- No CI/CD pipeline running tests
- **Risk:** Every deployment is a gamble; regressions go undetected

### Gap 2: No Payment Gateway Integration
- Checkout UI is fully built (`src/app/subscriber/extra-services/checkout/[id]/page.tsx`)
- Payment method UI supports Moyasar, Tabby, Tamara
- `handlePayment()` creates a service request and payment record BUT marks it `status: 'completed'` immediately without any actual payment processing
- No payment webhook handling
- No refund capability
- **Risk:** Revenue collection is impossible; fake "completed" payments in DB

### Gap 3: Twilio SMS Not Connected
- `twilio@5.11.2` is installed in `package.json`
- `src/app/api/send-otp/route.ts:118` has explicit TODO: "إرسال SMS فعلي عبر Twilio أو غيره"
- OTP is generated and stored in DB but never actually sent via SMS
- In development, OTP is printed to console and returned in response body
- **Risk:** Users cannot receive OTP codes in production; authentication is broken

---

## 6. PLAN 1: Current Project Improvements

### Phase 1: Critical Security Fixes (Highest Priority)

#### 1.1 Enforce Session Secret in Production
**File:** `src/lib/supabase-server.ts`
```
- Remove default fallback for SESSION_SECRET
- Throw startup error if not set in production
- Validate minimum 32 characters
- Add to deployment checklist
```

#### 1.2 Fix OTP Security
**File:** `src/app/api/send-otp/route.ts`
```
- Replace Math.random() with crypto.randomInt(100000, 999999)
- Remove console.log of OTP codes entirely
- Remove debug_code from response body
- Ensure OTP is ONLY stored in database, never exposed
```

#### 1.3 Secure All Auth Cookies
**File:** `src/app/api/auth/set-cookies/route.ts`
```
- Change httpOnly: false to httpOnly: true for all auth cookies
- Refactor client-side routing to use the signed session cookie only
- Or: Use a separate non-sensitive "role hint" cookie for client routing
```

#### 1.4 Update Vulnerable Dependencies
```
- Upgrade next from 14.2.35 to latest stable (15.x or 16.x)
- Run npm audit fix
- Test all features after upgrade
- Set up Dependabot or Renovate for automated updates
```

#### 1.5 Add CSRF Token Verification
**File:** `src/middleware.ts` + new utility
```
- Generate CSRF token per session
- Validate X-CSRF-Token header on all state-changing requests (POST/PUT/DELETE)
- Return 403 on CSRF mismatch
```

### Phase 2: Testing Infrastructure (Critical Gap)

#### 2.1 Set Up Test Framework
```
- Install and configure Vitest (fast, Vite-compatible)
- Install @testing-library/react for component tests
- Install Playwright for E2E tests
- Configure test scripts in package.json
- Create test directory structure
```

#### 2.2 Priority Test Coverage
```
Tests to write (ordered by impact):

Unit Tests:
├── lib/validate.ts          - All validation functions (sanitize, phone, XSS)
├── lib/supabase-server.ts   - Session create/parse/verify
├── lib/rate-limit.ts        - Rate limiter logic
├── lib/permissions.ts       - Permission checking
└── lib/cookies.ts           - Cookie helpers

API Integration Tests:
├── api/send-otp             - OTP generation, rate limiting, phone blocking
├── api/verify-otp           - Verification, timing-safe comparison, expiry
├── api/auth/set-cookies     - Cookie setting with DB verification
├── api/auth/clear-cookies   - Logout flow
├── api/chat                 - Chat with auth, emergency detection
└── api/health               - Health check response format

E2E Tests (Playwright):
├── Login flow               - OTP request → verify → dashboard redirect
├── Service request           - Create request → assign → complete
├── Checkout flow             - Select service → payment → confirmation
└── Role-based access         - Verify each role reaches correct portal
```

#### 2.3 CI/CD Pipeline
```
- GitHub Actions workflow for PR checks
- Run lint → type-check → unit tests → integration tests
- Block merge on test failure
- Run E2E tests on staging deployment
```

### Phase 3: Code Quality Improvements

#### 3.1 Remove Dead Code
```
- Delete: src/app/partner/requests/page_fixed4.tsx
- Delete: src/app/partner/requests/[id]/page copy.tsx
- Remove SKIP_LINT and SKIP_TYPE_CHECK build bypass flags
- Clean up any unused imports
```

#### 3.2 Extract Configuration Constants
```
Create: src/lib/config.ts
- Move VAT_RATE (0.15) to env var
- Move OTP_EXPIRY_MINUTES (5) to config
- Move SESSION_EXPIRY_DAYS (7) to config
- Move RATE_LIMIT values to config
- Move OpenAI model name to config
- Move REMINDER_TIMES to config
- Move cookie MAX_AGE to config
```

#### 3.3 Introduce Service Layer
```
Create: src/services/
├── auth.service.ts           - Login, logout, session management
├── otp.service.ts            - OTP generation, sending, verification
├── request.service.ts        - Service request CRUD
├── notification.service.ts   - Notification dispatch
├── payment.service.ts        - Payment processing (future)
└── sms.service.ts            - SMS sending via Twilio (future)

Benefits:
- Single source of truth for business logic
- Testable without HTTP layer
- Reusable across API routes
- Clear separation of concerns
```

#### 3.4 Add API Documentation
```
- Add OpenAPI/Swagger spec file
- Document all 9 API endpoints
- Include request/response schemas
- Add authentication requirements
- Generate from TypeScript types where possible
```

### Phase 4: Production Hardening

#### 4.1 Error Handling Improvements
```
- Add circuit breaker pattern for external services (Supabase, OpenAI)
- Add retry logic with exponential backoff for transient failures
- Add request timeout configuration
- Ensure all error paths return consistent response format
```

#### 4.2 Health Check Enhancement
```
- Add Supabase connection health check
- Add OpenAI API health check
- Add Redis connection health check (if configured)
- Restrict health endpoint details to authenticated admin requests
- Keep basic "up/down" public
```

#### 4.3 Logging & Monitoring
```
- Remove all console.log/console.error in favor of structured logger
- Add request/response logging for all API routes
- Add performance timing for database queries
- Configure Sentry error boundaries for React components
- Add custom Sentry contexts for user roles
```

#### 4.4 Database Improvements
```
- Create seed data scripts for development
- Add database backup automation
- Review and strengthen RLS policies
- Add missing foreign key constraints
- Add check constraints for enum fields
```

### Phase 1-4 Priority Matrix

| Task | Priority | Effort | Impact | Phase |
|---|---|---|---|---|
| Fix SESSION_SECRET | P0 | Low | Critical | 1 |
| Fix OTP crypto | P0 | Low | Critical | 1 |
| Secure cookies | P0 | Medium | Critical | 1 |
| Update dependencies | P0 | Medium | High | 1 |
| Set up Vitest | P0 | Medium | Critical | 2 |
| Write unit tests (lib/) | P0 | High | Critical | 2 |
| Write API integration tests | P1 | High | High | 2 |
| CI/CD pipeline | P1 | Medium | High | 2 |
| Remove dead code | P2 | Low | Low | 3 |
| Extract config | P2 | Medium | Medium | 3 |
| Service layer | P2 | High | High | 3 |
| API docs | P3 | Medium | Medium | 3 |
| Error handling patterns | P2 | Medium | High | 4 |
| Health check enhancement | P3 | Low | Medium | 4 |
| Logging cleanup | P2 | Medium | Medium | 4 |
| Database improvements | P2 | Medium | Medium | 4 |

---

## 7. PLAN 2: Missing Features Implementation (Payment & Twilio SMS OTP)

### Feature A: Twilio SMS OTP Integration

#### A.1 Overview
The OTP system is 80% complete. Database storage, rate limiting, verification, and phone blocking all work. The only missing piece is the actual SMS delivery via Twilio.

**Current state:** `src/app/api/send-otp/route.ts:118` - TODO comment marks where Twilio should be called.

#### A.2 Implementation Steps

**Step 1: Create SMS Service**
```
File: src/services/sms.service.ts

Purpose:
- Abstract SMS sending behind a service interface
- Support Twilio as primary provider
- Support future providers (e.g., Unifonic for Saudi Arabia)
- Include fallback/retry logic
- Log all SMS attempts (without exposing OTP)

Interface:
  sendOTP(phone: string, code: string, language: 'ar' | 'en'): Promise<{success, messageId?, error?}>

Configuration:
  - TWILIO_ACCOUNT_SID (env var)
  - TWILIO_AUTH_TOKEN (env var)
  - TWILIO_PHONE_NUMBER (env var, Saudi sender ID)
  - SMS_PROVIDER (env var, default: 'twilio')
```

**Step 2: Configure Twilio Client**
```
File: src/lib/twilio.ts

Purpose:
- Initialize Twilio client with credentials
- Validate credentials exist at startup
- Export configured client instance
- Handle connection errors gracefully

Environment Variables:
  TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  TWILIO_PHONE_NUMBER=+966xxxxxxxxx (or alphanumeric sender ID)
```

**Step 3: Integrate into OTP Route**
```
File: src/app/api/send-otp/route.ts

Changes:
1. Import sms.service
2. After OTP is stored in DB (line 115), call sms.sendOTP()
3. Handle SMS delivery failure:
   - If Twilio fails, mark OTP as 'failed' in DB
   - Return error to user: "Failed to send SMS, try again"
   - Log error with Sentry
4. Remove console.log of OTP code (lines 121-127)
5. Remove debug_code from response (line 136)
6. Add delivery status tracking to otp_verifications table

Message Templates (bilingual):
  Arabic: "رمز التحقق الخاص بك في إكسولكس هو: {code}. صالح لمدة 5 دقائق."
  English: "Your ExoLex verification code is: {code}. Valid for 5 minutes."
```

**Step 4: Add Delivery Status Tracking**
```
Database Migration: add_sms_delivery_tracking.sql

ALTER TABLE otp_verifications ADD COLUMN delivery_status text DEFAULT 'pending';
ALTER TABLE otp_verifications ADD COLUMN delivery_message_id text;
ALTER TABLE otp_verifications ADD COLUMN delivery_error text;
ALTER TABLE otp_verifications ADD COLUMN delivered_at timestamptz;

-- delivery_status values: 'pending', 'sent', 'delivered', 'failed', 'undelivered'
```

**Step 5: Add Twilio Webhook for Delivery Status**
```
File: src/app/api/webhooks/twilio-status/route.ts

Purpose:
- Receive SMS delivery status callbacks from Twilio
- Update otp_verifications.delivery_status
- Log delivery failures for monitoring
- Validate webhook signature (Twilio request validation)
```

**Step 6: Testing**
```
Tests to write:
- Unit: sms.service with mocked Twilio client
- Unit: OTP route with mocked SMS service
- Integration: Full OTP flow (send → deliver → verify)
- E2E: Login flow with test phone number
```

#### A.3 Twilio Configuration Checklist

```
1. Create Twilio account at twilio.com
2. Purchase Saudi Arabia phone number or configure Alphanumeric Sender ID
3. Register for A2P 10DLC (required for SMS in Saudi Arabia)
4. Set up messaging service with:
   - Sender Pool: Saudi number
   - Compliance: Legal services category
   - Opt-out management
5. Configure webhook URL for delivery status callbacks
6. Set environment variables in Vercel:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - TWILIO_MESSAGING_SERVICE_SID (optional)
7. Test with sandbox numbers before going live
8. Set up Twilio monitoring alerts
```

#### A.4 Cost Estimation
```
Twilio SMS to Saudi Arabia:
- Outbound SMS: ~$0.0675 per message
- Phone number: ~$1.00/month
- Estimated volume: 1,000 OTPs/day = ~$67.50/day
- Monthly estimate: ~$2,025 at 1,000 users/day
```

---

### Feature B: Payment Gateway Integration

#### B.1 Overview
The checkout UI is complete (`src/app/subscriber/extra-services/checkout/[id]/page.tsx`) with support for three payment methods: Moyasar (credit/debit), Tabby (4 installments), Tamara (3 installments). Currently, `handlePayment()` creates a service request and immediately marks payment as "completed" without any actual payment processing.

**Current state:** Payment UI complete, zero backend payment logic.

#### B.2 Recommended Payment Provider: Moyasar

Moyasar is the recommended primary provider because:
- Saudi Arabia-based, SAMA-regulated
- Supports Mada, Visa, Mastercard, Apple Pay
- Simple REST API with webhook support
- Built-in tokenization for PCI compliance
- Arabic language support
- Can integrate with Tabby/Tamara as sub-providers

#### B.3 Implementation Steps

**Step 1: Create Payment Service Architecture**
```
Files to create:
  src/services/payment.service.ts    - Core payment orchestration
  src/lib/moyasar.ts                 - Moyasar API client
  src/lib/tabby.ts                   - Tabby API client (BNPL)
  src/lib/tamara.ts                  - Tamara API client (BNPL)

Environment Variables:
  MOYASAR_API_KEY=sk_live_xxxxxxxxxxxx
  MOYASAR_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
  TABBY_API_KEY=sk_live_xxxxxxxxxxxx
  TAMARA_API_URL=https://api.tamara.co
  TAMARA_API_TOKEN=xxxxxxxxxxxx
  PAYMENT_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
```

**Step 2: Create Payment API Routes**
```
File: src/app/api/payments/initiate/route.ts
Purpose: Create payment session with selected provider
Flow:
  1. Validate user authentication
  2. Validate service exists and price is correct
  3. Create payment record in DB with status 'pending'
  4. Call Moyasar/Tabby/Tamara API to create payment session
  5. Return payment URL/token for client redirect
  6. Handle provider-specific flows:
     - Moyasar: Return payment form token (embedded or redirect)
     - Tabby: Return checkout session URL
     - Tamara: Return checkout URL

File: src/app/api/payments/callback/route.ts
Purpose: Handle redirect after payment completion
Flow:
  1. Receive callback from payment provider
  2. Verify payment status with provider API
  3. Update payment record in DB
  4. Create service request if payment successful
  5. Redirect user to confirmation page

File: src/app/api/webhooks/payment/route.ts
Purpose: Handle async payment status updates
Flow:
  1. Validate webhook signature
  2. Parse payment event (paid, failed, refunded)
  3. Update payment record
  4. Trigger appropriate notifications
  5. Handle edge cases (duplicate events, delayed webhooks)
```

**Step 3: Database Schema for Payments**
```
Migration: add_payment_tables.sql

-- Core payments table (enhance existing)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT UNIQUE NOT NULL,

  -- User info
  member_id UUID NOT NULL REFERENCES members(id),
  user_id UUID NOT NULL REFERENCES users(id),

  -- Amount
  base_amount DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',

  -- Provider
  payment_method TEXT NOT NULL, -- 'moyasar', 'tabby', 'tamara'
  provider_payment_id TEXT,     -- ID from payment provider
  provider_session_id TEXT,     -- Session/checkout ID

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'expired'

  -- Related entities
  request_id UUID REFERENCES service_requests(id),
  package_id UUID REFERENCES packages(id),
  extra_service_id UUID,

  -- Metadata
  payment_type TEXT DEFAULT 'single', -- 'single', 'installment'
  installment_count INTEGER DEFAULT 1,
  description TEXT,

  -- Timestamps
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment events log (webhook events, status changes)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  event_type TEXT NOT NULL, -- 'initiated', 'processing', 'paid', 'failed', 'refunded', 'webhook_received'
  provider_event_id TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refunds table
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  refund_reference TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  provider_refund_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_provider ON payments(provider_payment_id);
CREATE INDEX idx_payment_events_payment ON payment_events(payment_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
```

**Step 4: Refactor Checkout Page**
```
File: src/app/subscriber/extra-services/checkout/[id]/page.tsx

Changes:
1. Replace handlePayment() simulated flow with real API call:
   - POST /api/payments/initiate with {serviceId, paymentMethod, memberId}
   - Receive payment URL/token from response
   - Redirect to provider checkout OR embed payment form

2. For Moyasar (credit/debit):
   - Option A: Embed Moyasar payment form using their JS SDK
   - Option B: Redirect to Moyasar hosted checkout page

3. For Tabby (BNPL - 4 installments):
   - Redirect to Tabby checkout session URL
   - Handle return callback

4. For Tamara (BNPL - 3 installments):
   - Redirect to Tamara checkout URL
   - Handle return callback

5. Create return/callback pages:
   - src/app/subscriber/extra-services/checkout/success/page.tsx
   - src/app/subscriber/extra-services/checkout/failure/page.tsx
```

**Step 5: Payment Confirmation & Receipt**
```
File: src/app/subscriber/extra-services/checkout/success/page.tsx

Purpose:
- Display payment confirmation details
- Show generated service request ticket number
- Provide download receipt button
- Display next steps information
- Handle edge case where user arrives before webhook confirms payment
```

**Step 6: Subscription Payment Flow**
```
File: src/app/api/payments/subscribe/route.ts

Purpose: Handle subscription package purchases
Flow:
  1. User selects package
  2. Create payment for package price
  3. On payment success:
     - Update member.subscription_status = 'active'
     - Set member.current_package_id
     - Set member.subscription_start_date
     - Calculate and set member.subscription_end_date
  4. Create subscription_history record
  5. Send welcome/activation notification
```

**Step 7: Refund Processing**
```
File: src/app/api/payments/refund/route.ts

Purpose: Process refunds for cancelled/disputed services
Auth: Admin/Staff only
Flow:
  1. Validate refund request (amount, reason)
  2. Call payment provider refund API
  3. Create refund record
  4. Update payment status to 'refunded' or 'partially_refunded'
  5. Notify user of refund
  6. Update service request status if applicable
```

**Step 8: Payment Admin Dashboard**
```
Files:
  src/app/admin/payments/page.tsx         - Payment listing with filters
  src/app/admin/payments/[id]/page.tsx    - Payment detail view

Features:
  - View all payments with status filters
  - Search by reference number, user, amount
  - Process refunds
  - View payment events timeline
  - Export payment reports (CSV)
  - Daily/weekly/monthly revenue summary
```

**Step 9: Testing**
```
Unit Tests:
  - Payment service: initiate, callback, webhook handling
  - Moyasar client: API calls, signature verification
  - Amount calculations: VAT, installments

Integration Tests:
  - Full payment flow: initiate → provider → callback → confirmation
  - Webhook processing: idempotency, signature validation
  - Refund flow: request → process → update

E2E Tests:
  - Checkout page: select method → pay → confirmation
  - Subscription purchase flow
  - Failed payment recovery
```

#### B.4 Payment Security Requirements

```
1. PCI DSS Compliance:
   - NEVER store raw card numbers (use Moyasar tokenization)
   - All payment pages served over HTTPS
   - Payment form embedded from provider (not self-hosted)

2. Webhook Security:
   - Validate webhook signatures from all providers
   - Idempotent processing (handle duplicate webhooks)
   - Log all webhook events for audit

3. Amount Validation:
   - Server-side price verification (never trust client amounts)
   - VAT calculation on server, not client
   - Currency consistency checks

4. Fraud Prevention:
   - Rate limit payment attempts per user
   - Flag unusual patterns (multiple failures, large amounts)
   - Log all payment events with IP and user agent

5. Data Protection:
   - Encrypt sensitive payment metadata at rest
   - Mask card numbers in logs (show last 4 digits only)
   - Separate payment logs from application logs
```

#### B.5 Moyasar Integration Checklist

```
1. Create Moyasar merchant account at moyasar.com
2. Complete KYC/KYB verification
3. Configure payment methods (Mada, Visa, Mastercard, Apple Pay)
4. Set up webhook URL: https://exolex.sa/api/webhooks/payment
5. Configure callback URL: https://exolex.sa/subscriber/extra-services/checkout/callback
6. Set environment variables:
   - MOYASAR_API_KEY (secret key)
   - MOYASAR_PUBLISHABLE_KEY (public key)
   - MOYASAR_WEBHOOK_SECRET
7. Test in sandbox mode
8. Complete Moyasar production review
9. Go live with monitoring
```

#### B.6 Cost Estimation
```
Moyasar Fees:
- Mada: 1.5% + 1 SAR per transaction
- Visa/MC: 2.65% + 1 SAR per transaction
- Monthly minimum: 0 SAR

Tabby Fees:
- Merchant fee: 5-8% per transaction
- No setup fee
- Settlement: Next business day

Tamara Fees:
- Similar to Tabby (5-8%)
- Monthly fee may apply
```

---

### Implementation Timeline

#### Sprint 1: Twilio SMS Integration
```
Tasks:
1. Create src/services/sms.service.ts
2. Create src/lib/twilio.ts
3. Integrate into send-otp route
4. Add delivery status tracking migration
5. Create Twilio webhook endpoint
6. Write unit tests for SMS service
7. Write integration tests for OTP flow
8. Configure Twilio account and test numbers
```

#### Sprint 2: Payment Foundation
```
Tasks:
1. Create database migration for payment tables
2. Create src/services/payment.service.ts
3. Create src/lib/moyasar.ts
4. Create POST /api/payments/initiate
5. Create POST /api/payments/callback
6. Create POST /api/webhooks/payment
7. Refactor checkout page to use real payment flow
8. Create success/failure pages
```

#### Sprint 3: Payment Completion + BNPL
```
Tasks:
1. Create src/lib/tabby.ts
2. Create src/lib/tamara.ts
3. Implement subscription payment flow
4. Implement refund processing
5. Build admin payment dashboard
6. Write comprehensive payment tests
7. Security audit of payment flow
8. End-to-end testing in sandbox
```

#### Sprint 4: Hardening & Go-Live
```
Tasks:
1. Complete all test coverage (target: 70%)
2. Security penetration testing
3. Performance load testing
4. Production environment setup
5. Payment provider production approval
6. Twilio production number activation
7. Monitoring and alerting setup
8. Go-live with staged rollout
```

---

## Appendix: File Reference

### Files Requiring Immediate Changes (Plan 1 - Phase 1)

| File | Line | Change |
|---|---|---|
| `src/lib/supabase-server.ts` | 104 | Remove default SESSION_SECRET |
| `src/app/api/send-otp/route.ts` | 87 | Use crypto.randomInt() |
| `src/app/api/send-otp/route.ts` | 121-127 | Remove console.log of OTP |
| `src/app/api/send-otp/route.ts` | 136 | Remove debug_code |
| `src/app/api/auth/set-cookies/route.ts` | 26 | Set httpOnly: true |
| `package.json` | 16 | Upgrade next version |

### Files Requiring New Feature Implementation (Plan 2)

| File | Purpose |
|---|---|
| `src/services/sms.service.ts` | NEW - SMS delivery abstraction |
| `src/lib/twilio.ts` | NEW - Twilio client configuration |
| `src/services/payment.service.ts` | NEW - Payment orchestration |
| `src/lib/moyasar.ts` | NEW - Moyasar API client |
| `src/lib/tabby.ts` | NEW - Tabby BNPL client |
| `src/lib/tamara.ts` | NEW - Tamara BNPL client |
| `src/app/api/payments/initiate/route.ts` | NEW - Payment creation |
| `src/app/api/payments/callback/route.ts` | NEW - Payment return handler |
| `src/app/api/webhooks/payment/route.ts` | NEW - Payment webhooks |
| `src/app/api/webhooks/twilio-status/route.ts` | NEW - SMS delivery status |
| `src/app/subscriber/extra-services/checkout/[id]/page.tsx` | MODIFY - Real payment flow |
| `supabase/migrations/xxx_add_payment_tables.sql` | NEW - Payment DB schema |
| `supabase/migrations/xxx_add_sms_tracking.sql` | NEW - SMS delivery tracking |

---

*End of Assessment*
