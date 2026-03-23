# ExoLex Database Schema (Inferred)

> **Note**: This schema was inferred from codebase analysis, not from the actual database.
> Some columns may be missing or have different types in production.
> Generated: 2026-03-23

---

## Table of Contents

1. [Core User Tables](#core-user-tables)
2. [Service & Case Tables](#service--case-tables)
3. [Financial Tables](#financial-tables)
4. [Communication Tables](#communication-tables)
5. [Organization Tables](#organization-tables)
6. [Reference Tables](#reference-tables)
7. [Authentication Tables](#authentication-tables)
8. [Calendar & Scheduling](#calendar--scheduling)
9. [Knowledge Base (NOLEX)](#knowledge-base-nolex)
10. [All Tables List](#all-tables-list)

---

## Core User Tables

### users
Primary user identity table for all user types.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_type | ENUM | NO | 'member', 'lawyer', 'partner', 'partner_employee', 'admin', 'staff' |
| full_name | TEXT | YES | Arabic full name |
| full_name_en | TEXT | YES | English full name |
| name_native | TEXT | YES | Native language name |
| phone | TEXT | NO | Phone number (+966...) |
| email | TEXT | YES | Email address |
| national_id | TEXT | NO | National ID / Iqama number |
| id_type | ENUM | NO | 'national_id', 'iqama', 'passport', 'gcc_id' |
| nationality | TEXT | YES | Country code |
| gender | ENUM | YES | 'male', 'female' |
| date_of_birth | DATE | YES | Birth date |
| national_id_expiry | DATE | YES | ID expiry date |
| marital_status | ENUM | YES | 'single', 'married', 'divorced', 'widowed' |
| profession | TEXT | YES | Job title |
| city | TEXT | YES | City of residence |
| address | TEXT | YES | Full address |
| native_language | ENUM | YES | 'ar', 'en', 'tl', 'ur', 'hi', 'bn', 'id', 'other' |
| preferred_language | ENUM | NO | 'ar', 'en', 'tl', 'ur' |
| status | ENUM | NO | 'pending', 'active', 'suspended', 'deactivated' |
| is_profile_complete | BOOLEAN | NO | Profile completion flag |
| phone_verified | BOOLEAN | NO | Phone verification status |
| email_verified | BOOLEAN | NO | Email verification status |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### members
Subscriber/client accounts linked to users.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | FK to users.id |
| member_code | TEXT | NO | Unique member code (e.g., MEM-XXXXX) |
| subscription_status | ENUM | NO | 'active', 'expired', 'cancelled', 'pending' |
| current_package_id | UUID | YES | FK to packages.id |
| subscription_start_date | TIMESTAMP | YES | Subscription start |
| subscription_end_date | TIMESTAMP | YES | Subscription end |
| free_searches_remaining | INTEGER | NO | Remaining free NOLEX searches |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### lawyers
Lawyer profiles (independent or legal arm affiliated).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | NO | FK to users.id |
| lawyer_type | ENUM | NO | 'independent', 'legal_arm' |
| legal_arm_id | UUID | YES | FK to legal_arms.id (if affiliated) |
| legal_entity_id | UUID | YES | FK to legal_entities.id |
| full_name | TEXT | NO | Arabic full name |
| full_name_en | TEXT | YES | English full name |
| national_id | TEXT | NO | National ID |
| national_id_expiry | DATE | NO | ID expiry date |
| license_number | TEXT | NO | Saudi Bar license number |
| license_expiry | DATE | YES | License expiry date |
| phone | TEXT | NO | Phone number |
| email | TEXT | NO | Email address |
| city | TEXT | NO | City of practice |
| years_of_experience | INTEGER | NO | Experience in years |
| supported_languages | TEXT[] | NO | Languages spoken |
| bank_name | TEXT | YES | Bank name for payments |
| iban | TEXT | NO | IBAN for payments |
| account_holder_name | TEXT | NO | Bank account holder name |
| status | ENUM | NO | 'pending', 'active', 'inactive', 'suspended' |
| activation_status | TEXT | NO | Activation workflow status |
| admin_approval_status | TEXT | NO | Admin approval status |
| is_available | BOOLEAN | NO | Currently accepting work |
| current_workload | INTEGER | NO | Current active requests |
| max_workload | INTEGER | NO | Maximum concurrent requests |
| specializations | TEXT[] | NO | Category IDs for specializations |
| rating | DECIMAL | YES | Overall rating (1-5) |
| avg_rating | DECIMAL | YES | Average rating |
| experience_years | INTEGER | NO | Years of experience |
| active_requests_count | INTEGER | NO | Current active request count |
| total_requests_completed | INTEGER | NO | Total completed requests |
| completed_requests | INTEGER | NO | Completed requests count |
| salary | DECIMAL | YES | Monthly salary (for legal arm) |
| department_id | UUID | YES | FK to legal_arm_departments.id |
| job_title_id | UUID | YES | FK to legal_arm_job_titles.id |
| role_id | UUID | YES | FK to legal_arm_roles.id |
| hire_date | DATE | YES | Date hired (for legal arm) |
| lawyer_code | TEXT | NO | Unique lawyer code |
| profile_image | TEXT | YES | Profile image URL |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### partners
Legal partner organizations (law firms, companies).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| partner_code | TEXT | NO | Unique partner code |
| entity_type | TEXT | NO | Organization type |
| company_name_ar | TEXT | NO | Arabic company name |
| commercial_reg_number | TEXT | NO | Commercial registration number |
| commercial_reg_expiry | DATE | NO | CR expiry date |
| commercial_reg_image | TEXT | NO | CR document URL |
| license_number | TEXT | NO | License number |
| license_expiry | DATE | NO | License expiry date |
| license_image | TEXT | NO | License document URL |
| manager_name | TEXT | NO | Manager full name |
| manager_national_id | TEXT | NO | Manager national ID |
| manager_national_id_expiry | DATE | NO | Manager ID expiry |
| manager_national_id_image | TEXT | NO | Manager ID document URL |
| manager_license_number | TEXT | YES | Manager's lawyer license |
| manager_license_expiry | DATE | YES | Manager license expiry |
| manager_phone | TEXT | NO | Manager phone number |
| manager_email | TEXT | NO | Manager email |
| manager_id | UUID | YES | FK to partner_employees.id |
| manager_user_id | UUID | YES | FK to users.id |
| address | TEXT | NO | Office address |
| phone | TEXT | NO | Office phone |
| email | TEXT | NO | Office email |
| logo_url | TEXT | YES | Company logo URL |
| status | ENUM | NO | 'pending', 'active', 'inactive' |
| is_available | BOOLEAN | NO | Accepting new work |
| receive_exolex_requests | BOOLEAN | NO | Accept platform requests |
| commission_rate | DECIMAL | NO | Platform commission rate |
| auto_accept | BOOLEAN | NO | Auto-accept requests |
| max_concurrent_cases | INTEGER | NO | Max concurrent cases |
| is_paused | BOOLEAN | NO | Temporarily paused |
| pause_reason | TEXT | YES | Reason for pause |
| pause_until | TIMESTAMP | YES | Pause end date |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### partner_employees
Employees working for partner organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| partner_id | UUID | NO | FK to partners.id |
| user_id | UUID | YES | FK to users.id |
| full_name | TEXT | NO | Arabic full name |
| full_name_en | TEXT | NO | English full name |
| email | TEXT | NO | Email address |
| phone | TEXT | NO | Phone number |
| national_id | TEXT | NO | National ID |
| department_id | UUID | YES | FK to partner_departments.id |
| job_title_id | UUID | YES | FK to partner_job_titles.id |
| license_number | TEXT | YES | Lawyer license (if applicable) |
| license_expiry | DATE | YES | License expiry |
| experience_years | INTEGER | YES | Years of experience |
| salary | DECIMAL | YES | Monthly salary |
| hire_date | DATE | NO | Hire date |
| is_available | BOOLEAN | NO | Currently available |
| status | ENUM | NO | 'active', 'inactive', 'terminated' |
| termination_date | DATE | YES | Termination date |
| avg_rating | DECIMAL | YES | Average rating |
| completed_requests | INTEGER | NO | Completed requests count |
| permissions | JSONB | YES | Permission settings |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### legal_arms
Internal legal department organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| arm_code | TEXT | NO | Unique arm code |
| arm_name | TEXT | NO | Organization name |
| name_ar | TEXT | NO | Arabic name |
| license_number | TEXT | NO | License number |
| license_expiry | DATE | NO | License expiry |
| license_image | TEXT | NO | License document URL |
| commercial_registration | TEXT | NO | CR number |
| commercial_registration_expiry | DATE | NO | CR expiry |
| commercial_registration_image | TEXT | NO | CR document URL |
| manager_national_id | TEXT | NO | Manager national ID |
| manager_national_id_expiry | DATE | NO | Manager ID expiry |
| manager_national_id_image | TEXT | NO | Manager ID document URL |
| manager_id | UUID | YES | FK to lawyers.id |
| manager_user_id | UUID | YES | FK to users.id |
| phone | TEXT | NO | Office phone |
| email | TEXT | NO | Office email |
| address | TEXT | NO | Office address |
| city | TEXT | NO | City |
| logo_url | TEXT | YES | Organization logo URL |
| status | ENUM | NO | 'pending', 'active' |
| auto_accept | BOOLEAN | NO | Auto-accept requests |
| max_concurrent_cases | INTEGER | NO | Max concurrent cases |
| payment_model | TEXT | YES | Payment model type |
| cost_plus_margin | DECIMAL | YES | Cost plus margin rate |
| fixed_monthly_amount | DECIMAL | YES | Fixed monthly amount |
| commission_rate | DECIMAL | YES | Commission rate |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

## Service & Case Tables

### service_requests
Main service request table for all request types.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| ticket_number | TEXT | NO | Unique ticket number (REQ-XXXXX) |
| member_id | UUID | NO | FK to members.id |
| request_type | ENUM | NO | 'consultation', 'case', 'extra_service' |
| source | TEXT | YES | Request source |
| extra_service_id | UUID | YES | FK to extra_services.id |
| category_id | UUID | NO | FK to categories.id |
| subcategory_id | UUID | YES | FK to subcategories.id |
| title | TEXT | NO | Request title |
| description | TEXT | NO | Request description |
| status | TEXT | NO | Request status (many values) |
| priority | ENUM | NO | 'normal', 'high', 'urgent' |
| base_price | DECIMAL | YES | Base price before VAT |
| vat_amount | DECIMAL | YES | VAT amount |
| total_amount | DECIMAL | YES | Total amount including VAT |
| sla_hours | INTEGER | YES | SLA in hours |
| sla_deadline | TIMESTAMP | YES | SLA deadline |
| is_sla_breached | BOOLEAN | NO | SLA breach flag |
| assigned_lawyer_id | UUID | YES | FK to lawyers.id |
| legal_arm_id | UUID | YES | FK to legal_arms.id |
| partner_id | UUID | YES | FK to partners.id |
| handler_type | ENUM | YES | 'legal_arm', 'independent', 'partner' |
| assigned_at | TIMESTAMP | YES | Assignment timestamp |
| completed_at | TIMESTAMP | YES | Completion timestamp |
| closed_at | TIMESTAMP | YES | Closure timestamp |
| delivered_at | TIMESTAMP | YES | Delivery timestamp |
| credit_consumed | BOOLEAN | NO | Credit consumed flag |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

### service_offers
Offers/quotes from lawyers for service requests.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| request_id | UUID | YES | FK to service_requests.id |
| service_name_ar | TEXT | YES | Service name in Arabic |
| price | DECIMAL | NO | Offered price |
| lawyer_commission_percentage | DECIMAL | YES | Commission percentage |
| lawyer_commission_amount | DECIMAL | YES | Commission amount |
| target_type | TEXT | YES | Target type |
| status | ENUM | NO | 'pending', 'accepted', 'rejected', 'expired' |
| priority | TEXT | YES | Offer priority |
| expires_at | TIMESTAMP | YES | Offer expiry |
| required_category_id | UUID | YES | FK to categories.id |
| lawyer_id | UUID | YES | FK to lawyers.id |
| legal_arm_id | UUID | YES | FK to legal_arms.id |
| partner_id | UUID | YES | FK to partners.id |
| extra_service_id | UUID | YES | FK to extra_services.id |
| accepted_by | UUID | YES | User who accepted |
| accepted_at | TIMESTAMP | YES | Acceptance timestamp |
| created_by | UUID | YES | Creator user ID |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### case_management
Court case management records.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| case_number | TEXT | NO | Internal case number |
| request_id | UUID | YES | FK to service_requests.id |
| member_id | UUID | YES | FK to members.id |
| power_of_attorney_id | UUID | YES | FK to power_of_attorneys.id |
| assigned_lawyer_id | UUID | YES | FK to lawyers.id |
| assigned_lawyer_type | TEXT | YES | Lawyer type |
| legal_arm_id | UUID | YES | FK to legal_arms.id |
| arm_id | UUID | YES | Alias for legal_arm_id |
| court_name | TEXT | YES | Court name |
| court_city | TEXT | YES | Court city |
| court_case_number | TEXT | YES | Official court case number |
| court_circuit | TEXT | YES | Court circuit |
| court_room | TEXT | YES | Court room |
| judge_name | TEXT | YES | Judge name |
| case_type | TEXT | YES | Case type |
| case_category | TEXT | YES | Case category |
| case_status | ENUM | NO | 'active', 'in_progress', 'pending', 'closed' |
| court_status | TEXT | YES | Court status |
| domain | TEXT | YES | Legal domain |
| plaintiff_name | TEXT | YES | Plaintiff name |
| plaintiff_type | ENUM | YES | 'individual', 'organization' |
| plaintiff_representative | TEXT | YES | Plaintiff representative |
| defendant_name | TEXT | YES | Defendant name |
| defendant_type | ENUM | YES | 'individual', 'organization' |
| defendant_representative | TEXT | YES | Defendant representative |
| claim_amount | DECIMAL | YES | Claim amount |
| claim_description | TEXT | YES | Claim description |
| filing_date | DATE | YES | Filing date |
| first_hearing_date | DATE | YES | First hearing date |
| next_session_date | TIMESTAMP | YES | Next session date |
| notes | TEXT | YES | Case notes |
| poa_verified | BOOLEAN | NO | POA verification status |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

## Financial Tables

### payments
Payment transaction records.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| payment_reference | TEXT | NO | Unique payment reference |
| member_id | UUID | NO | FK to members.id |
| request_id | UUID | YES | FK to service_requests.id |
| amount | DECIMAL | NO | Payment amount |
| payment_method | TEXT | NO | Payment method (e.g., 'moyasar') |
| status | ENUM | NO | 'pending', 'completed', 'failed', 'refunded' |
| metadata | JSONB | YES | Payment metadata (moyasar_id, card info, etc.) |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### subscriptions
Member subscription records.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| member_id | UUID | NO | FK to members.id |
| package_id | UUID | NO | FK to packages.id |
| status | ENUM | NO | 'active', 'expired', 'cancelled' |
| consultations_remaining | INTEGER | NO | Remaining consultations |
| cases_remaining | INTEGER | NO | Remaining cases |
| nolex_remaining | INTEGER | NO | Remaining NOLEX queries |
| library_remaining | INTEGER | NO | Remaining library searches |
| start_date | TIMESTAMP | NO | Subscription start |
| end_date | TIMESTAMP | NO | Subscription end |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### packages
Subscription package definitions.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name_ar | TEXT | NO | Arabic name |
| name_en | TEXT | NO | English name |
| code | TEXT | NO | Package code |
| price | DECIMAL | NO | Package price |
| duration_days | INTEGER | NO | Duration in days |
| consultations_limit | INTEGER | NO | Consultations included |
| cases_limit | INTEGER | NO | Cases included |
| nolex_queries_limit | INTEGER | NO | NOLEX queries included |
| library_searches_limit | INTEGER | NO | Library searches included |
| sla_hours | INTEGER | NO | SLA hours |
| is_active | BOOLEAN | NO | Active status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### extra_services
Additional purchasable services.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| name_ar | TEXT | NO | Arabic name |
| name_en | TEXT | NO | English name |
| description_ar | TEXT | YES | Arabic description |
| price | DECIMAL | NO | Service price |
| pricing_type | TEXT | NO | Pricing type |
| icon | TEXT | YES | Icon identifier |
| category_id | UUID | YES | FK to categories.id |
| is_active | BOOLEAN | NO | Active status |
| sort_order | INTEGER | NO | Display order |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

## Communication Tables

### notifications
System notifications for all user types.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | YES | FK to users.id |
| user_type | TEXT | YES | User type |
| recipient_id | UUID | YES | Recipient ID |
| recipient_type | TEXT | YES | Recipient type |
| notification_type | TEXT | NO | Notification type |
| title | TEXT | YES | Notification title |
| title_ar | TEXT | YES | Arabic title |
| title_en | TEXT | YES | English title |
| message | TEXT | YES | Message content |
| body | TEXT | YES | Body content |
| body_ar | TEXT | YES | Arabic body |
| body_en | TEXT | YES | English body |
| type | TEXT | YES | Type identifier |
| priority | ENUM | NO | 'high', 'normal', 'low' |
| link | TEXT | YES | Action link |
| action_url | TEXT | YES | Action URL |
| action_type | TEXT | YES | Action type |
| reference_type | TEXT | YES | Reference entity type |
| reference_id | UUID | YES | Reference entity ID |
| request_id | UUID | YES | FK to service_requests.id |
| data | JSONB | YES | Additional data |
| metadata | JSONB | YES | Metadata |
| send_push | BOOLEAN | NO | Send push notification |
| is_read | BOOLEAN | NO | Read status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### messages
Chat messages between members and lawyers.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| request_id | UUID | NO | FK to service_requests.id |
| sender_id | UUID | NO | Sender user ID |
| sender_type | TEXT | NO | Sender type |
| content | TEXT | NO | Message content |
| attachments | JSONB | YES | File attachments |
| is_read | BOOLEAN | NO | Read status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### request_client_messages
Client-facing messages on requests.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| request_id | UUID | NO | FK to service_requests.id |
| sender_id | UUID | NO | Sender ID |
| sender_type | TEXT | NO | Sender type |
| sender_name | TEXT | YES | Sender name |
| content | TEXT | NO | Message content |
| attachments | JSONB | YES | Attachments |
| is_read | BOOLEAN | NO | Read status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### request_internal_chat
Internal team chat on requests.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| request_id | UUID | NO | FK to service_requests.id |
| sender_id | UUID | NO | Sender ID |
| sender_type | TEXT | NO | Sender type |
| sender_name | TEXT | YES | Sender name |
| content | TEXT | NO | Message content |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

## Authentication Tables

### otp_verifications
OTP verification records for authentication.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| phone | TEXT | NO | Phone number |
| code | TEXT | NO | OTP code (6 digits) |
| purpose | ENUM | NO | 'login', 'register', 'verify', 'lawyer_login', 'legal_arm_login', 'partner_login', etc. |
| legal_arm_id | UUID | YES | FK to legal_arms.id |
| national_id | TEXT | YES | National ID for verification |
| requesting_lawyer_id | UUID | YES | FK to lawyers.id |
| channel | ENUM | NO | 'sms', 'whatsapp', 'dev' |
| status | ENUM | NO | 'pending', 'verified', 'expired' |
| attempts | INTEGER | NO | Verification attempts |
| max_attempts | INTEGER | NO | Maximum allowed attempts |
| expires_at | TIMESTAMP | NO | OTP expiry time |
| verified_at | TIMESTAMP | YES | Verification timestamp |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

## Calendar & Scheduling

### calendar_events
Calendar events for lawyers and organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| owner_type | ENUM | NO | 'lawyer', 'arm_lawyer', 'partner_lawyer', 'member', 'partner', 'arm' |
| owner_id | UUID | NO | Owner entity ID |
| owner_name | TEXT | YES | Owner name |
| title | TEXT | NO | Event title |
| description | TEXT | YES | Event description |
| event_type | ENUM | NO | 'court_session', 'consultation', 'client_meeting', 'phone_call', 'video_call', 'internal_meeting', 'deadline', 'reminder', 'personal', 'task', 'other' |
| start_datetime | TIMESTAMP | NO | Start date/time |
| end_datetime | TIMESTAMP | YES | End date/time |
| all_day | BOOLEAN | NO | All day event flag |
| location | TEXT | YES | Event location |
| location_type | ENUM | YES | 'physical', 'virtual' |
| meeting_link | TEXT | YES | Virtual meeting link |
| court_name | TEXT | YES | Court name (for sessions) |
| court_room | TEXT | YES | Court room |
| request_id | UUID | YES | FK to service_requests.id |
| case_id | UUID | YES | FK to case_management.id |
| ticket_number | TEXT | YES | Related ticket number |
| is_private | BOOLEAN | NO | Private event flag |
| notify_client | BOOLEAN | NO | Notify client flag |
| status | ENUM | NO | 'scheduled', 'completed', 'cancelled' |
| participants | JSONB | YES | Event participants |
| reminder_settings | JSONB | YES | Reminder configuration |
| court_requirements | JSONB | YES | Court requirements list |
| color | TEXT | YES | Event color |
| icon | TEXT | YES | Event icon |
| created_by | UUID | YES | Creator user ID |
| created_at | TIMESTAMP | NO | Creation timestamp |
| updated_at | TIMESTAMP | NO | Last update timestamp |

---

## Reference Tables

### categories
Service categories.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| code | TEXT | NO | Category code |
| name_ar | TEXT | NO | Arabic name |
| name_en | TEXT | NO | English name |
| color | TEXT | YES | Display color |
| icon | TEXT | YES | Icon identifier |
| form_fields | JSONB | YES | Custom form fields |
| is_active | BOOLEAN | NO | Active status |
| sort_order | INTEGER | NO | Display order |

---

### subcategories
Service subcategories.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| category_id | UUID | NO | FK to categories.id |
| code | TEXT | NO | Subcategory code |
| name_ar | TEXT | NO | Arabic name |
| name_en | TEXT | NO | English name |
| is_active | BOOLEAN | NO | Active status |

---

## Organization Tables

### legal_arm_roles
Roles within legal arm organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| legal_arm_id | UUID | NO | FK to legal_arms.id |
| name | TEXT | NO | Role name |
| permissions | JSONB | NO | Role permissions |
| is_active | BOOLEAN | NO | Active status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### legal_arm_departments
Departments within legal arm organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| legal_arm_id | UUID | NO | FK to legal_arms.id |
| name | TEXT | NO | Department name |
| is_active | BOOLEAN | NO | Active status |

---

### partner_roles
Roles within partner organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| partner_id | UUID | NO | FK to partners.id |
| name | TEXT | NO | Role name |
| permissions | JSONB | NO | Role permissions |
| is_active | BOOLEAN | NO | Active status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### partner_departments
Departments within partner organizations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| partner_id | UUID | NO | FK to partners.id |
| name | TEXT | NO | Department name |
| is_active | BOOLEAN | NO | Active status |

---

## Knowledge Base (NOLEX)

### nolex_conversations
AI conversation history.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| member_id | UUID | NO | FK to members.id |
| session_id | TEXT | NO | Session identifier |
| role | TEXT | NO | Message role (user/assistant) |
| content | TEXT | NO | Message content |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

### kb_documents
Knowledge base documents.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| category_id | UUID | YES | FK to kb_categories.id |
| title | TEXT | NO | Document title |
| content | TEXT | NO | Document content |
| is_active | BOOLEAN | NO | Active status |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

## Activity & Logging

### activity_logs
System activity audit logs.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | UUID | NO | Primary key |
| user_id | UUID | YES | Acting user ID |
| user_type | TEXT | YES | User type |
| user_name | TEXT | YES | User name |
| activity_type | TEXT | NO | Activity type |
| description | TEXT | NO | Activity description |
| entity_type | TEXT | YES | Related entity type |
| entity_id | UUID | YES | Related entity ID |
| partner_id | UUID | YES | FK to partners.id |
| legal_arm_id | UUID | YES | FK to legal_arms.id |
| metadata | JSONB | YES | Additional metadata |
| created_at | TIMESTAMP | NO | Creation timestamp |

---

## All Tables List (97 total)

### Core User Tables
- `users`
- `members`
- `lawyers`
- `partners`
- `partner_employees`
- `legal_arms`
- `admins`

### Service & Cases
- `service_requests`
- `service_offers`
- `service_quotes`
- `service_categories`
- `service_paths`
- `case_management`
- `cases`
- `case_documents`
- `case_parties`
- `case_sessions`
- `case_timeline`

### Request Management
- `request_client_messages`
- `request_internal_chat`
- `request_files`
- `request_appointments`
- `request_collaborators`
- `request_objections`
- `request_reviews`
- `request_transfers`
- `request_history`
- `request_logs`

### Communication
- `messages`
- `notifications`
- `support_tickets`
- `support_ticket_messages`

### Legal Arm Organization
- `legal_arm_roles`
- `legal_arm_departments`
- `legal_arm_job_titles`
- `legal_arm_notification_settings`
- `legal_arm_reminder_preferences`

### Partner Organization
- `partner_roles`
- `partner_permissions`
- `partner_departments`
- `partner_job_titles`
- `partner_notification_settings`
- `partner_reminder_preferences`
- `partner_contracts`
- `partner_quotes`
- `partner_requests`

### Lawyer Settings
- `lawyer_categories`
- `lawyer_notification_settings`
- `lawyer_reminder_preferences`
- `lawyer_responses`
- `lawyer_time_logs`

### Financial
- `payments`
- `subscriptions`
- `packages`
- `extra_services`
- `extra_service_requests`
- `quote_installments`
- `points_subscription_redemptions`
- `points_withdrawal_requests`
- `user_points`

### Knowledge Base (NOLEX)
- `kb_categories`
- `kb_documents`
- `kb_projects`
- `kb_questions`
- `kb_quota_packages`
- `kb_search_history`
- `kb_user_quotas`
- `nolex_conversations`

### Reference Tables
- `categories`
- `subcategories`
- `ref_departments`
- `ref_job_titles`
- `ref_roles`

### Authentication
- `otp_verifications`

### Calendar & Reminders
- `calendar_events`
- `session_reminders`

### Other Tables
- `activity_logs`
- `admin_requests`
- `affiliates`
- `referrals`
- `referral_clicks`
- `ratings`
- `power_of_attorneys`
- `team_invitations`
- `user_settings`
- `user_devices`
- `user_personal_documents`
- `legal_entities`
- `legal_partners`
- `legal_services`
- `provider_services`

---

## Notes

1. **This schema is inferred from code analysis** - actual database may differ
2. **UUID** is used for all primary keys
3. **TIMESTAMP** columns use ISO 8601 format with timezone
4. **ENUM** types are implemented as TEXT with CHECK constraints
5. **JSONB** is used for flexible/nested data structures
6. All tables have RLS (Row Level Security) enabled - see `supabase/rls-policies.sql`

---

## Required Migration

The `otp_verifications` table needs the `channel` column added:

```sql
ALTER TABLE otp_verifications
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sms'
  CHECK (channel IN ('sms', 'whatsapp', 'dev'));
```
