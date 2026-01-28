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
    const [cookieName, ...rest] = cookie.trim().split('=')
    if (cookieName === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

/**
 * Delete a cookie by name (client-side)
 */
export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth Cookie Getters
// ═══════════════════════════════════════════════════════════════════════════════

export function getUserId(): string | null {
  return getCookie('exolex_user_id')
}

export function getUserType(): string | null {
  return getCookie('exolex_user_type')
}

export function getMemberId(): string | null {
  return getCookie('exolex_member_id')
}

export function getLawyerId(): string | null {
  return getCookie('exolex_lawyer_id')
}

export function getPartnerId(): string | null {
  return getCookie('exolex_partner_id')
}

export function getEmployeeId(): string | null {
  return getCookie('exolex_employee_id')
}

/**
 * Get legal arm ID - checks both cookie names for compatibility
 * (some pages used exolex_arm_id, others used exolex_legal_arm_id)
 */
export function getLegalArmId(): string | null {
  return getCookie('exolex_arm_id') || getCookie('exolex_legal_arm_id')
}

/**
 * Get lawyer display name from cookie (may be null if not set)
 */
export function getLawyerName(): string | null {
  return getCookie('exolex_lawyer_name')
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
