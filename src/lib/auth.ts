// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Utilities
// Shared functions for login/logout across all portals
// ═══════════════════════════════════════════════════════════════════════════════

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
 * Clear all authentication data from localStorage
 */
export function clearAuthStorage(): void {
  AUTH_STORAGE_KEYS.forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * Clear all authentication cookies via server API (httpOnly cookies)
 */
export async function clearAuthCookies(): Promise<void> {
  try {
    await fetch('/api/auth/clear-cookies', { method: 'POST' })
  } catch (error) {
    console.error('Failed to clear auth cookies:', error)
  }
}

/**
 * Complete logout - clears all auth data and redirects to login
 * @param redirectTo - The login page to redirect to (default: /auth/login)
 */
export async function logout(redirectTo: string = '/auth/login'): Promise<void> {
  // Clear all cookies via server API
  await clearAuthCookies()

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
// Cookie Setters (via server API for httpOnly security)
// ═══════════════════════════════════════════════════════════════════════════════

interface SetCookiesParams {
  userType: string
  userId?: string
  memberId?: string
  lawyerId?: string
  partnerId?: string
  employeeId?: string
  legalArmId?: string
}

/**
 * Set authentication cookies via server API (httpOnly)
 */
async function setAuthCookiesViaAPI(params: SetCookiesParams): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/set-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return response.ok
  } catch (error) {
    console.error('Failed to set auth cookies:', error)
    return false
  }
}

/**
 * Set authentication cookies for member/subscriber
 */
export async function setMemberAuthCookies(userId: string, memberId?: string): Promise<void> {
  await setAuthCookiesViaAPI({
    userType: 'member',
    userId,
    memberId,
  })
}

/**
 * Set authentication cookies for lawyer
 */
export async function setLawyerAuthCookies(lawyerId: string, legalArmId?: string): Promise<void> {
  await setAuthCookiesViaAPI({
    userType: 'lawyer',
    userId: lawyerId,
    lawyerId,
    legalArmId,
  })
}

/**
 * Set authentication cookies for legal arm manager
 */
export async function setLegalArmAuthCookies(legalArmId: string): Promise<void> {
  await setAuthCookiesViaAPI({
    userType: 'legal_arm',
    userId: legalArmId,
    legalArmId,
  })
}

/**
 * Set authentication cookies for partner
 */
export async function setPartnerAuthCookies(partnerId: string): Promise<void> {
  await setAuthCookiesViaAPI({
    userType: 'partner',
    userId: partnerId,
    partnerId,
  })
}

/**
 * Set authentication cookies for partner employee
 */
export async function setPartnerEmployeeAuthCookies(employeeId: string, partnerId?: string): Promise<void> {
  await setAuthCookiesViaAPI({
    userType: 'partner_employee',
    userId: employeeId,
    employeeId,
    partnerId,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generic Cookie Setter (for custom auth scenarios)
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthCookieData {
  lawyerId?: string
  userType?: string
  legalArmId?: string
  employeeId?: string
  partnerId?: string
  memberId?: string
  userId?: string
}

/**
 * Generic function to set auth cookies based on provided data
 * Used by login pages that handle multiple auth scenarios
 */
export async function setAuthCookies(data: AuthCookieData): Promise<void> {
  const params: SetCookiesParams = {
    userType: data.userType || 'member',
    userId: data.userId || data.lawyerId || data.memberId || data.employeeId || data.partnerId,
    memberId: data.memberId,
    lawyerId: data.lawyerId,
    partnerId: data.partnerId,
    employeeId: data.employeeId,
    legalArmId: data.legalArmId,
  }
  await setAuthCookiesViaAPI(params)
}
