'use client'

// ═══════════════════════════════════════════════════════════════
// OTP Channel Selector
// Lets the user pick how to receive the verification code:
//   1. SMS (Twilio)
//   2. WhatsApp (Meta Cloud API)
//   3. Dev test (toast notification / console)
// ═══════════════════════════════════════════════════════════════

type OtpChannel = 'sms' | 'whatsapp' | 'dev'

interface OtpChannelSelectorProps {
  value: OtpChannel
  onChange: (channel: OtpChannel) => void
  /** Accent color for the active state (tailwind class prefix). Default: 'primary' */
  accent?: string
}

const channels: { id: OtpChannel; label: string; icon: string; description: string }[] = [
  { id: 'sms',      label: 'رسالة SMS',       icon: '📱', description: 'رسالة نصية قصيرة' },
  { id: 'whatsapp', label: 'واتساب',          icon: '💬', description: 'رسالة عبر واتساب' },
  { id: 'dev',      label: 'وضع التجربة',     icon: '🧪', description: 'إشعار على الشاشة فقط' },
]

export default function OtpChannelSelector({ value, onChange, accent = 'primary' }: OtpChannelSelectorProps) {
  // Map accent to tailwind classes
  const activeClasses: Record<string, string> = {
    primary: 'border-blue-500 bg-blue-50',
    purple:  'border-purple-500 bg-purple-50',
    blue:    'border-blue-500 bg-blue-50',
  }
  const activeRadioClasses: Record<string, string> = {
    primary: 'text-blue-600',
    purple:  'text-purple-600',
    blue:    'text-blue-600',
  }

  const activeBorder = activeClasses[accent] || activeClasses.primary
  const activeRadio = activeRadioClasses[accent] || activeRadioClasses.primary

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        طريقة استلام رمز التحقق
      </label>
      {channels.map((ch) => (
        <label
          key={ch.id}
          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            value === ch.id ? activeBorder : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="otp_channel"
            value={ch.id}
            checked={value === ch.id}
            onChange={() => onChange(ch.id)}
            className={`w-4 h-4 ${activeRadio}`}
          />
          <span className="text-lg">{ch.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 text-sm">{ch.label}</p>
            <p className="text-xs text-gray-500">{ch.description}</p>
          </div>
        </label>
      ))}
    </div>
  )
}
