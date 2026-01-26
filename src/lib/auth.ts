// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Utilities
// Shared functions for login/logout across all portals
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All auth-related cookie names used in the system
 */
const AUTH_COOKIES = [
  'exolex_user_id',
  'exolex_user_type',
  'exolex_member_id',
  'exolex_lawyer_id',
  'exolex_partner_id',
  'exolex_arm_id',
  'exolex_employee_id',
  'exolex_session',
]

/**
 * All auth-related localStorage keys used in the system
 */
const AUTH_STORAGE_KEYS = [
  'exolex_user_id',
  'exolex_user_type',
  'exolex_phone',
  'exolex_member_id',
  'exolex_lawyer_id',
  'exolex_lawyer_code',
  'exolex_lawyer_name',
  'exolex_partner_id',
  'exolex_partner_name',
  'exolex_arm_id',
  'exolex_arm_name',
  'exolex_legal_arm_id',
  'exolex_employee_id',
  'exolex_employee_code',
]

/**
 * Clear all authentication cookies
 */
export function clearAuthCookies(): void {
  AUTH_COOKIES.forEach(name => {
    // Clear cookie by setting it to empty with max-age=0
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
    // Also try with domain variations for safety
    document.cookie = `${name}=; path=/; max-age=0`
  })
}

/**
 * Clear all authentication data from localStorage
 */
export function clearAuthStorage(): void {
  AUTH_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * Complete logout - clears all auth data and redirects to login
 * @param redirectTo - The login page to redirect to (default: /auth/login)
 */
export function logout(redirectTo: string = '/auth/login'): void {
  // Clear all cookies
  clearAuthCookies()

  // Clear all localStorage
  clearAuthStorage()

  // Full page redirect to ensure clean state
  window.location.href = redirectTo
}

/**
 * Logout for subscriber/member users
 */
export function logoutMember(): void {
  logout('/auth/login')
}

/**
 * Logout for lawyer users (independent or legal-arm)
 */
export function logoutLawyer(): void {
  logout('/auth/lawyer-login')
}

/**
 * Logout for legal arm managers
 */
export function logoutLegalArm(): void {
  logout('/auth/legal-arm-login')
}

/**
 * Logout for partner users
 */
export function logoutPartner(): void {
  logout('/auth/partner-login')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cookie Setters (for login pages)
// ═══════════════════════════════════════════════════════════════════════════════

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

/**
 * Set authentication cookies for member/subscriber
 */
export function setMemberAuthCookies(userId: string, memberId?: string): void {
  document.cookie = `exolex_user_id=${userId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_user_type=member; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  if (memberId) {
    document.cookie = `exolex_member_id=${memberId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }
}

/**
 * Set authentication cookies for lawyer
 */
export function setLawyerAuthCookies(lawyerId: string, legalArmId?: string): void {
  document.cookie = `exolex_user_id=${lawyerId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_lawyer_id=${lawyerId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_user_type=lawyer; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  if (legalArmId) {
    document.cookie = `exolex_arm_id=${legalArmId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }
}

/**
 * Set authentication cookies for legal arm manager
 */
export function setLegalArmAuthCookies(legalArmId: string): void {
  document.cookie = `exolex_user_id=${legalArmId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_arm_id=${legalArmId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_user_type=legal_arm; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/**
 * Set authentication cookies for partner
 */
export function setPartnerAuthCookies(partnerId: string): void {
  document.cookie = `exolex_user_id=${partnerId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_partner_id=${partnerId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_user_type=partner; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

/**
 * Set authentication cookies for partner employee
 */
export function setPartnerEmployeeAuthCookies(employeeId: string, partnerId?: string): void {
  document.cookie = `exolex_user_id=${employeeId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_employee_id=${employeeId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  document.cookie = `exolex_user_type=partner_employee; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  if (partnerId) {
    document.cookie = `exolex_partner_id=${partnerId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }
}
