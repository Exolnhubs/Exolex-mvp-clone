// ═══════════════════════════════════════════════════════════════════════════════
// ExoLex Database Types - متوافق مع قاعدة البيانات
// ═══════════════════════════════════════════════════════════════════════════════

// نوع الهوية
export type IdType = 'national_id' | 'iqama' | 'passport' | 'gcc_id'

// نوع المستخدم
export type UserType = 'member' | 'lawyer' | 'partner' | 'partner_employee' | 'admin' | 'staff'

// حالة المستخدم
export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated'

// الجنس
export type Gender = 'male' | 'female'

// الحالة الاجتماعية
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'

// اللغات المدعومة
export type SupportedLanguage = 'ar' | 'en' | 'tl' | 'ur'

// اللغة الأم
export type NativeLanguage = 'ar' | 'en' | 'tl' | 'ur' | 'hi' | 'bn' | 'id' | 'other'

// ═══════════════════════════════════════════════════════════════════════════════
// User Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: string
  user_type: UserType
  full_name: string | null
  full_name_en: string | null
  name_native: string | null
  phone: string
  email: string | null
  national_id: string
  id_type: IdType
  nationality: string | null
  gender: Gender | null
  date_of_birth: string | null
  national_id_expiry: string | null
  marital_status: MaritalStatus | null
  profession: string | null
  city: string | null
  address: string | null
  native_language: NativeLanguage | null
  preferred_language: SupportedLanguage
  status: UserStatus
  is_profile_complete: boolean
  phone_verified: boolean
  email_verified: boolean
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP Interface
// ═══════════════════════════════════════════════════════════════════════════════

export type OtpPurpose = 'login' | 'phone_change_old' | 'phone_change_new' | 'email_verification'

export interface OtpVerification {
  id: string
  phone: string
  otp_code: string
  purpose: OtpPurpose
  expires_at: string
  verified: boolean
  attempts: number
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Member Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface Member {
  id: string
  user_id: string
  member_code: string
  subscription_status: 'active' | 'expired' | 'cancelled' | 'pending'
  current_package_id: string | null
  subscription_start_date: string | null
  subscription_end_date: string | null
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Package Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface Package {
  id: string
  name_ar: string
  name_en: string
  code: string
  price: number
  duration_days: number
  consultations_limit: number
  cases_limit: number
  nolex_queries_limit: number
  library_searches_limit: number
  sla_hours: number
  is_active: boolean
  created_at: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth State
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  needsProfileCompletion: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Response Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface OtpSendResponse {
  success: boolean
  message: string
  expires_at?: string
}

export interface OtpVerifyResponse {
  success: boolean
  user?: User
  isNewUser?: boolean
  needsProfileCompletion?: boolean
  token?: string
}
