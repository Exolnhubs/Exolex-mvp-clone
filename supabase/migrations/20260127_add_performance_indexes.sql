-- ═══════════════════════════════════════════════════════════════════════════════
-- Performance Indexes Migration
-- Date: 2026-01-27
-- Purpose: Add indexes for frequently queried columns to improve query performance
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- SERVICE_REQUESTS INDEXES (Most queried table - 106 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Status + created_at for sorted listing and status filtering
CREATE INDEX IF NOT EXISTS idx_service_requests_status_created
  ON service_requests(status, created_at DESC);

-- Member lookups with status filtering
CREATE INDEX IF NOT EXISTS idx_service_requests_member_status
  ON service_requests(member_id, status);

-- Assigned lawyer lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_lawyer
  ON service_requests(assigned_lawyer_id, status)
  WHERE assigned_lawyer_id IS NOT NULL;

-- Partner employee assignments
CREATE INDEX IF NOT EXISTS idx_service_requests_assigned_employee
  ON service_requests(assigned_partner_employee_id, status)
  WHERE assigned_partner_employee_id IS NOT NULL;

-- Request type + status + acceptance filtering
CREATE INDEX IF NOT EXISTS idx_service_requests_type_status
  ON service_requests(request_type, status, is_accepted);

-- User ID for owner lookups
CREATE INDEX IF NOT EXISTS idx_service_requests_user_id
  ON service_requests(user_id);

-- Date range queries (reports, analytics)
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at
  ON service_requests(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWYERS INDEXES (83 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Partner-specific lawyer lookups
CREATE INDEX IF NOT EXISTS idx_lawyers_partner_active
  ON lawyers(partner_id, is_active)
  WHERE partner_id IS NOT NULL;

-- Legal arm lawyer lookups
CREATE INDEX IF NOT EXISTS idx_lawyers_legal_arm_type
  ON lawyers(legal_arm_id, lawyer_type)
  WHERE legal_arm_id IS NOT NULL;

-- User ID relationship
CREATE INDEX IF NOT EXISTS idx_lawyers_user_id
  ON lawyers(user_id);

-- Active lawyers by type
CREATE INDEX IF NOT EXISTS idx_lawyers_type_active
  ON lawyers(lawyer_type, is_active);

-- Created at for sorting
CREATE INDEX IF NOT EXISTS idx_lawyers_created_at
  ON lawyers(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS INDEXES (58 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- User notifications with sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Recipient-based lookups
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_id, recipient_type, created_at DESC)
  WHERE recipient_id IS NOT NULL;

-- Unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- OTP_VERIFICATIONS INDEXES (24 queries - Auth critical)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Phone + status for verification lookups
CREATE INDEX IF NOT EXISTS idx_otp_phone_status
  ON otp_verifications(phone, status, created_at DESC);

-- Expiration checking
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose_expires
  ON otp_verifications(phone, purpose, expires_at DESC);

-- Cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires_at
  ON otp_verifications(expires_at)
  WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════
-- CALENDAR_EVENTS INDEXES (26 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Date range + status for calendar views
CREATE INDEX IF NOT EXISTS idx_calendar_datetime_status
  ON calendar_events(start_datetime, status);

-- Lawyer calendar lookups
CREATE INDEX IF NOT EXISTS idx_calendar_lawyer_datetime
  ON calendar_events(lawyer_id, start_datetime);

-- Case-linked events
CREATE INDEX IF NOT EXISTS idx_calendar_case_id
  ON calendar_events(case_id)
  WHERE case_id IS NOT NULL;

-- Request-linked events
CREATE INDEX IF NOT EXISTS idx_calendar_request_id
  ON calendar_events(request_id)
  WHERE request_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MEMBERS INDEXES (29 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- User ID relationship (most common lookup)
CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON members(user_id);

-- Created at for sorting
CREATE INDEX IF NOT EXISTS idx_members_created_at
  ON members(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- USERS INDEXES (28 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Phone lookups (login/verification)
CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone);

-- National ID lookups
CREATE INDEX IF NOT EXISTS idx_users_national_id
  ON users(national_id);

-- User type filtering
CREATE INDEX IF NOT EXISTS idx_users_type_status
  ON users(user_type, status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTNER_EMPLOYEES INDEXES (29 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Partner employee lookups
CREATE INDEX IF NOT EXISTS idx_partner_employees_partner_active
  ON partner_employees(partner_id, is_active);

-- User ID relationship
CREATE INDEX IF NOT EXISTS idx_partner_employees_user_id
  ON partner_employees(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CASE_MANAGEMENT INDEXES (24 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lawyer case assignments
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_id
  ON case_management(lawyer_id);

-- Member cases
CREATE INDEX IF NOT EXISTS idx_cases_member_id
  ON case_management(member_id);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_cases_status
  ON case_management(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ACTIVITY_LOGS INDEXES (25 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- User activity lookups
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created
  ON activity_logs(user_id, created_at DESC);

-- Entity-specific activity
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON activity_logs(entity_type, entity_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REQUEST_INTERNAL_CHAT INDEXES (20 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Chat messages by request
CREATE INDEX IF NOT EXISTS idx_internal_chat_request
  ON request_internal_chat(request_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REQUEST_CLIENT_MESSAGES INDEXES (16 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Client messages by request
CREATE INDEX IF NOT EXISTS idx_client_messages_request
  ON request_client_messages(request_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Member subscription status
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_status
  ON subscriptions(member_id, status);

-- Active subscriptions by end date (expiration checks)
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date
  ON subscriptions(end_date)
  WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════════
-- SERVICE_QUOTES INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Quotes by request
CREATE INDEX IF NOT EXISTS idx_quotes_request_id
  ON service_quotes(request_id);

-- Lawyer quotes
CREATE INDEX IF NOT EXISTS idx_quotes_lawyer_status
  ON service_quotes(lawyer_id, status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REQUEST_COLLABORATORS INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Collaborators by request
CREATE INDEX IF NOT EXISTS idx_collaborators_request
  ON request_collaborators(request_id);

-- Lawyer collaborations
CREATE INDEX IF NOT EXISTS idx_collaborators_lawyer
  ON request_collaborators(lawyer_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEGAL_ARMS INDEXES (17 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Partner legal arms
CREATE INDEX IF NOT EXISTS idx_legal_arms_partner
  ON legal_arms(partner_id)
  WHERE partner_id IS NOT NULL;

-- Active legal arms
CREATE INDEX IF NOT EXISTS idx_legal_arms_status
  ON legal_arms(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWYER_TIME_LOGS INDEXES (16 queries)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Time logs by lawyer
CREATE INDEX IF NOT EXISTS idx_time_logs_lawyer
  ON lawyer_time_logs(lawyer_id, created_at DESC);

-- Time logs by request
CREATE INDEX IF NOT EXISTS idx_time_logs_request
  ON lawyer_time_logs(request_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWYER_REMINDER_PREFERENCES INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lawyer preferences lookup (used in batch queries)
CREATE INDEX IF NOT EXISTS idx_reminder_prefs_lawyer
  ON lawyer_reminder_preferences(lawyer_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SESSION_REMINDERS INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Existing reminders check (prevent duplicates)
CREATE INDEX IF NOT EXISTS idx_session_reminders_session_type
  ON session_reminders(session_id, reminder_type);

-- User reminders
CREATE INDEX IF NOT EXISTS idx_session_reminders_user
  ON session_reminders(user_id, scheduled_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOLEX_CONVERSATIONS INDEXES (AI chat history)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Lawyer conversation history
CREATE INDEX IF NOT EXISTS idx_nolex_lawyer
  ON nolex_conversations(lawyer_id, created_at DESC)
  WHERE lawyer_id IS NOT NULL;

-- Request-linked conversations
CREATE INDEX IF NOT EXISTS idx_nolex_request
  ON nolex_conversations(request_ticket)
  WHERE request_ticket IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Analyze tables after index creation
-- ═══════════════════════════════════════════════════════════════════════════════
ANALYZE service_requests;
ANALYZE lawyers;
ANALYZE notifications;
ANALYZE otp_verifications;
ANALYZE calendar_events;
ANALYZE members;
ANALYZE users;
ANALYZE partner_employees;
ANALYZE case_management;
ANALYZE activity_logs;
