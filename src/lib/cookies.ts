// ═══════════════════════════════════════════════════════════════════════════════
// Client-Side Cookie Utilities
// Read authentication cookies set by the server
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a cookie value by name (client-side)
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (cookieName === name) {
      return decodeURIComponent(cookieValue)
    }
  }
  return null
}

/**
 * Get the current user ID from cookies
 */
export function getUserId(): string | null {
  return getCookie('exolex_user_id')
}

/**
 * Get the current user type from cookies
 */
export function getUserType(): string | null {
  return getCookie('exolex_user_type')
}

/**
 * Get the current member ID from cookies
 */
export function getMemberId(): string | null {
  return getCookie('exolex_member_id')
}

/**
 * Get the current lawyer ID from cookies
 */
export function getLawyerId(): string | null {
  return getCookie('exolex_lawyer_id')
}

/**
 * Get the current partner ID from cookies
 */
export function getPartnerId(): string | null {
  return getCookie('exolex_partner_id')
}

/**
 * Get the current employee ID from cookies
 */
export function getEmployeeId(): string | null {
  return getCookie('exolex_employee_id')
}

/**
 * Get the current legal arm ID from cookies
 */
export function getLegalArmId(): string | null {
  return getCookie('exolex_arm_id')
}

/**
 * Check if user is authenticated (has valid cookies)
 */
export function isAuthenticated(): boolean {
  return !!getUserId() && !!getUserType()
}

/**
 * Get all auth data from cookies
 */
export function getAuthData() {
  return {
    userId: getUserId(),
    userType: getUserType(),
    memberId: getMemberId(),
    lawyerId: getLawyerId(),
    partnerId: getPartnerId(),
    employeeId: getEmployeeId(),
    legalArmId: getLegalArmId(),
  }
}
