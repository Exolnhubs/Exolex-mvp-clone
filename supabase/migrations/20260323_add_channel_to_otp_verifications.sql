-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Add channel column to otp_verifications
-- Date: 2026-03-23
-- Purpose: Support multi-channel OTP delivery (sms, whatsapp, dev)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE otp_verifications
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sms'
  CHECK (channel IN ('sms', 'whatsapp', 'dev'));

COMMENT ON COLUMN otp_verifications.channel IS 'OTP delivery channel: sms (Twilio), whatsapp (Meta Cloud API), dev (console only)';
