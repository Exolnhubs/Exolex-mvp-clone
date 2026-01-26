// ═══════════════════════════════════════════════════════════════════════════════
// Request Validation Utilities
// Input validation and sanitization for API routes
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ValidationRule = {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'phone' | 'uuid'
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  enum?: readonly string[]
  custom?: (value: unknown) => boolean | string
}

export type ValidationSchema = Record<string, ValidationRule>

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
  sanitized: Record<string, unknown>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sanitization Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sanitize string input (trim, remove dangerous characters)
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 10000) // Limit length
}

/**
 * Sanitize HTML (for rich text fields)
 */
export function sanitizeHtml(input: unknown): string {
  if (typeof input !== 'string') return ''
  // Basic sanitization - remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .slice(0, 50000)
}

/**
 * Sanitize phone number (Saudi format)
 */
export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return ''
  // Remove all non-digits except leading +
  let phone = input.replace(/[^\d+]/g, '')

  // Normalize to +966 format
  if (phone.startsWith('00966')) {
    phone = '+966' + phone.slice(5)
  } else if (phone.startsWith('966')) {
    phone = '+' + phone
  } else if (phone.startsWith('05')) {
    phone = '+966' + phone.slice(1)
  } else if (phone.startsWith('5')) {
    phone = '+966' + phone
  }

  return phone
}

/**
 * Sanitize national ID / IQAMA
 */
export function sanitizeNationalId(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.replace(/[^\d]/g, '').slice(0, 10)
}

/**
 * Sanitize email
 */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.trim().toLowerCase().slice(0, 255)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate Saudi phone number
 */
export function isValidSaudiPhone(phone: string): boolean {
  // After sanitization, should be in format +9665xxxxxxxx
  return /^\+9665[0-9]{8}$/.test(phone)
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Validate Saudi National ID (starts with 1)
 */
export function isValidNationalId(id: string): boolean {
  return /^1[0-9]{9}$/.test(id)
}

/**
 * Validate IQAMA number (starts with 2)
 */
export function isValidIqama(id: string): boolean {
  return /^2[0-9]{9}$/.test(id)
}

/**
 * Validate either National ID or IQAMA
 */
export function isValidIdNumber(id: string): boolean {
  return isValidNationalId(id) || isValidIqama(id)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Schema Validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate a value against a rule
 */
function validateValue(value: unknown, rule: ValidationRule, fieldName: string): string | null {
  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`
  }

  // Skip further validation if value is empty and not required
  if (value === undefined || value === null || value === '') {
    return null
  }

  // Type validation
  if (rule.type) {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${fieldName} must be a number`
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${fieldName} must be a boolean`
        }
        break
      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`
        }
        break
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          return `${fieldName} must be an object`
        }
        break
      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          return `${fieldName} must be a valid email`
        }
        break
      case 'phone':
        if (typeof value !== 'string' || !isValidSaudiPhone(sanitizePhone(value))) {
          return `${fieldName} must be a valid Saudi phone number`
        }
        break
      case 'uuid':
        if (typeof value !== 'string' || !isValidUUID(value)) {
          return `${fieldName} must be a valid UUID`
        }
        break
    }
  }

  // String length validation
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return `${fieldName} must be at least ${rule.minLength} characters`
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return `${fieldName} must be at most ${rule.maxLength} characters`
    }
  }

  // Number range validation
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${fieldName} must be at least ${rule.min}`
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${fieldName} must be at most ${rule.max}`
    }
  }

  // Pattern validation
  if (rule.pattern && typeof value === 'string') {
    if (!rule.pattern.test(value)) {
      return `${fieldName} has an invalid format`
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value as string)) {
    return `${fieldName} must be one of: ${rule.enum.join(', ')}`
  }

  // Custom validation
  if (rule.custom) {
    const result = rule.custom(value)
    if (typeof result === 'string') {
      return result
    }
    if (result === false) {
      return `${fieldName} is invalid`
    }
  }

  return null
}

/**
 * Validate and sanitize request body against a schema
 */
export function validateBody(body: unknown, schema: ValidationSchema): ValidationResult {
  const errors: Record<string, string> = {}
  const sanitized: Record<string, unknown> = {}

  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: { _body: 'Request body must be a JSON object' },
      sanitized: {},
    }
  }

  const bodyObj = body as Record<string, unknown>

  for (const [fieldName, rule] of Object.entries(schema)) {
    let value = bodyObj[fieldName]

    // Sanitize based on type
    if (rule.type === 'string' || !rule.type) {
      if (typeof value === 'string') {
        value = sanitizeString(value)
      }
    } else if (rule.type === 'phone') {
      if (typeof value === 'string') {
        value = sanitizePhone(value)
      }
    } else if (rule.type === 'email') {
      if (typeof value === 'string') {
        value = sanitizeEmail(value)
      }
    }

    // Validate
    const error = validateValue(value, rule, fieldName)
    if (error) {
      errors[fieldName] = error
    } else if (value !== undefined) {
      sanitized[fieldName] = value
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Common Validation Schemas
// ═══════════════════════════════════════════════════════════════════════════════

export const OTP_SEND_SCHEMA: ValidationSchema = {
  phone: { required: true, type: 'phone' },
  national_id: { required: true, type: 'string', pattern: /^[12][0-9]{9}$/ },
}

export const OTP_VERIFY_SCHEMA: ValidationSchema = {
  phone: { required: true, type: 'phone' },
  otp_code: { required: true, type: 'string', minLength: 6, maxLength: 6, pattern: /^[0-9]{6}$/ },
}

export const SERVICE_REQUEST_SCHEMA: ValidationSchema = {
  request_type: { required: true, type: 'string', enum: ['consultation', 'case'] as const },
  category_id: { required: true, type: 'uuid' },
  title: { required: true, type: 'string', minLength: 5, maxLength: 200 },
  description: { required: true, type: 'string', minLength: 10, maxLength: 5000 },
  priority: { type: 'string', enum: ['normal', 'urgent'] as const },
}

export const QUOTE_SCHEMA: ValidationSchema = {
  service_request_id: { required: true, type: 'uuid' },
  amount: { required: true, type: 'number', min: 0 },
  payment_type: { required: true, type: 'string', enum: ['single', 'installment'] as const },
  description: { type: 'string', maxLength: 2000 },
  validity_days: { type: 'number', min: 1, max: 90 },
}

export const PROFILE_UPDATE_SCHEMA: ValidationSchema = {
  full_name: { type: 'string', minLength: 2, maxLength: 100 },
  full_name_en: { type: 'string', maxLength: 100 },
  email: { type: 'email' },
  city: { type: 'string', maxLength: 50 },
  address: { type: 'string', maxLength: 200 },
  date_of_birth: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ },
  gender: { type: 'string', enum: ['male', 'female'] as const },
  marital_status: { type: 'string', enum: ['single', 'married', 'divorced', 'widowed'] as const },
}

// ═══════════════════════════════════════════════════════════════════════════════
// XSS Prevention
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Escape HTML entities for safe display
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, char => htmlEntities[char])
}

/**
 * Check if string contains potential XSS
 */
export function containsXSS(str: string): boolean {
  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /expression\s*\(/i,
  ]
  return xssPatterns.some(pattern => pattern.test(str))
}
