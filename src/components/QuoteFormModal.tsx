'use client'

import { useState, useEffect } from 'react'
import { X, Send, Plus, Trash2, AlertCircle, CheckCircle, Calculator } from 'lucide-react'

interface Installment {
  id: number
  stage: string
  valueType: 'percentage' | 'amount'
  value: number
  description: string
  calculatedAmount: number
}

interface QuoteFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: QuoteFormData) => Promise<void>
  request: {
    id: string
    ticket_number: string
    title: string
  } | null
  submitting?: boolean
}

export interface QuoteFormData {
  service_description: string
  total_price: number
  estimated_days: number
  payment_type: 'single' | 'multiple'
  single_payment_timing: 'advance' | 'on_completion' | 'custom'
  single_payment_custom_event?: string
  installments: Installment[]
  // الحسابات
  vat_amount: number
  total_with_vat: number
  platform_commission: number
  lawyer_amount: number
}

const VAT_RATE = 0.15
const PLATFORM_COMMISSION_RATE = 0.30

const stageNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة']

export default function QuoteFormModal({ isOpen, onClose, onSubmit, request, submitting = false }: QuoteFormModalProps) {
  const [formData, setFormData] = useState<QuoteFormData>({
    service_description: '',
    total_price: 0,
    estimated_days: 7,
    payment_type: 'single',
    single_payment_timing: 'advance',
    single_payment_custom_event: '',
    installments: [],
    vat_amount: 0,
    total_with_vat: 0,
    platform_commission: 0,
    lawyer_amount: 0
  })

  const [valueType, setValueType] = useState<'percentage' | 'amount'>('percentage')
  const [errors, setErrors] = useState<string[]>([])

  // إعادة تعيين النموذج عند الفتح
  useEffect(() => {
    if (isOpen) {
      setFormData({
        service_description: '',
        total_price: 0,
        estimated_days: 7,
        payment_type: 'single',
        single_payment_timing: 'advance',
        single_payment_custom_event: '',
        installments: [],
        vat_amount: 0,
        total_with_vat: 0,
        platform_commission: 0,
        lawyer_amount: 0
      })
      setErrors([])
    }
  }, [isOpen])

  // حساب الضريبة والعمولات
  useEffect(() => {
    const price = formData.total_price || 0
    const vat = price * VAT_RATE
    const commission = price * PLATFORM_COMMISSION_RATE
    const lawyerAmount = price - commission

    setFormData(prev => ({
      ...prev,
      vat_amount: vat,
      total_with_vat: price + vat,
      platform_commission: commission,
      lawyer_amount: lawyerAmount
    }))

    // تحديث مبالغ الدفعات
    if (formData.installments.length > 0) {
      updateInstallmentAmounts(price)
    }
  }, [formData.total_price])

  // تحديث مبالغ الدفعات بناءً على النسب
  const updateInstallmentAmounts = (totalPrice: number) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.map(inst => ({
        ...inst,
        calculatedAmount: inst.valueType === 'percentage' 
          ? (totalPrice * inst.value / 100)
          : inst.value
      }))
    }))
  }

  // إضافة دفعة جديدة
  const addInstallment = () => {
    if (formData.installments.length >= 6) return

    const newInstallment: Installment = {
      id: Date.now(),
      stage: stageNames[formData.installments.length],
      valueType: valueType,
      value: 0,
      description: formData.installments.length === 0 ? 'عند قبول العرض' : '',
      calculatedAmount: 0
    }

    setFormData(prev => ({
      ...prev,
      installments: [...prev.installments, newInstallment]
    }))
  }

  // حذف دفعة
  const removeInstallment = (id: number) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments
        .filter(inst => inst.id !== id)
        .map((inst, index) => ({ ...inst, stage: stageNames[index] }))
    }))
  }

  // تحديث دفعة
  const updateInstallment = (id: number, field: keyof Installment, value: any) => {
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.map(inst => {
        if (inst.id !== id) return inst
        
        const updated = { ...inst, [field]: value }
        
        // حساب المبلغ تلقائياً
        if (field === 'value' || field === 'valueType') {
          updated.calculatedAmount = updated.valueType === 'percentage'
            ? (formData.total_price * updated.value / 100)
            : updated.value
        }
        
        return updated
      })
    }))
  }

  // حساب مجموع النسب أو المبالغ
  const calculateTotal = () => {
    if (formData.installments.length === 0) return 0
    
    const firstType = formData.installments[0]?.valueType
    return formData.installments.reduce((sum, inst) => sum + inst.value, 0)
  }

  // التحقق من صحة الدفعات
  const validateInstallments = (): string[] => {
    const errs: string[] = []
    
    if (formData.payment_type === 'multiple') {
      if (formData.installments.length < 2) {
        errs.push('يجب إضافة دفعتين على الأقل')
      }

      const total = calculateTotal()
      const firstType = formData.installments[0]?.valueType

      if (firstType === 'percentage' && Math.abs(total - 100) > 0.01) {
        errs.push(`مجموع النسب يجب أن يساوي 100% (الحالي: ${total.toFixed(1)}%)`)
      }

      if (firstType === 'amount' && Math.abs(total - formData.total_price) > 0.01) {
        errs.push(`مجموع المبالغ يجب أن يساوي ${formData.total_price.toLocaleString()} ر.س (الحالي: ${total.toLocaleString()} ر.س)`)
      }

      // التحقق من وجود وصف لكل دفعة
      const emptyDescriptions = formData.installments.filter(inst => !inst.description.trim())
      if (emptyDescriptions.length > 0) {
        errs.push('يجب تحديد معيار/وصف لكل دفعة')
      }
    }

    return errs
  }

  // إرسال النموذج
  const handleSubmit = async () => {
    const validationErrors: string[] = []

    if (!formData.service_description.trim()) {
      validationErrors.push('يرجى كتابة وصف الخدمة')
    }

    if (formData.total_price <= 0) {
      validationErrors.push('يرجى تحديد السعر الإجمالي')
    }

    if (formData.payment_type === 'single' && formData.single_payment_timing === 'custom' && !formData.single_payment_custom_event?.trim()) {
      validationErrors.push('يرجى تحديد موعد السداد')
    }

    const installmentErrors = validateInstallments()
    validationErrors.push(...installmentErrors)

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    await onSubmit(formData)
  }

  // تبديل نوع القيمة لجميع الدفعات
  const switchValueType = (type: 'percentage' | 'amount') => {
    setValueType(type)
    setFormData(prev => ({
      ...prev,
      installments: prev.installments.map(inst => ({
        ...inst,
        valueType: type,
        value: 0,
        calculatedAmount: 0
      }))
    }))
  }

  if (!isOpen || !request) return null

  const totalInstallments = calculateTotal()
  const isValidTotal = formData.installments.length === 0 || 
    (formData.installments[0]?.valueType === 'percentage' 
      ? Math.abs(totalInstallments - 100) < 0.01
      : Math.abs(totalInstallments - formData.total_price) < 0.01)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">📝 تقديم عرض سعر</h2>
              <p className="text-amber-100 text-sm mt-1">{request.ticket_number} - {request.title}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1 space-y-6">
          
          {/* الأخطاء */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <ul className="text-sm text-red-700 space-y-1">
                  {errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* وصف الخدمة */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">وصف الخدمة المقدمة *</label>
            <textarea
              value={formData.service_description}
              onChange={(e) => setFormData(prev => ({ ...prev, service_description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="اشرح بالتفصيل ما ستقدمه للعميل..."
            />
          </div>

          {/* السعر والمدة */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">السعر الإجمالي (ر.س) *</label>
              <input
                type="number"
                min="0"
                value={formData.total_price || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, total_price: Number(e.target.value) }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-lg font-bold focus:ring-2 focus:ring-amber-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">المدة المتوقعة</label>
              <select
                value={formData.estimated_days}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_days: Number(e.target.value) }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                <option value={1}>يوم واحد</option>
                <option value={3}>3 أيام</option>
                <option value={7}>أسبوع</option>
                <option value={14}>أسبوعين</option>
                <option value={30}>شهر</option>
                <option value={60}>شهرين</option>
                <option value={90}>3 أشهر</option>
              </select>
            </div>
          </div>

          {/* ملخص الحسابات */}
          {formData.total_price > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-700">ملخص العرض</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">السعر الأساسي</span>
                  <span className="font-medium">{formData.total_price.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">الضريبة (15%)</span>
                  <span className="font-medium">{formData.vat_amount.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-800">الإجمالي مع الضريبة</span>
                  <span className="font-bold text-lg text-amber-600">{formData.total_with_vat.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 text-xs">
                  <span className="text-gray-500">عمولة المنصة (30%)</span>
                  <span className="text-red-600">- {formData.platform_commission.toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">صافي لك</span>
                  <span className="text-emerald-600 font-semibold">{formData.lawyer_amount.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>
          )}

          {/* نوع الدفع */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">طريقة الدفع *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, payment_type: 'single', installments: [] }))}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  formData.payment_type === 'single'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold mb-1">💰 دفعة واحدة</div>
                <div className="text-xs text-gray-500">المبلغ كاملاً مرة واحدة</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, payment_type: 'multiple' }))
                  if (formData.installments.length === 0) {
                    addInstallment()
                    setTimeout(() => addInstallment(), 100)
                  }
                }}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  formData.payment_type === 'multiple'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold mb-1">📊 دفعات متعددة</div>
                <div className="text-xs text-gray-500">تقسيم على مراحل</div>
              </button>
            </div>
          </div>

          {/* دفعة واحدة */}
          {formData.payment_type === 'single' && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">موعد السداد</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="timing"
                    checked={formData.single_payment_timing === 'advance'}
                    onChange={() => setFormData(prev => ({ ...prev, single_payment_timing: 'advance' }))}
                    className="w-4 h-4 text-amber-500"
                  />
                  <span className="text-sm">مقدم (عند قبول العرض)</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="timing"
                    checked={formData.single_payment_timing === 'on_completion'}
                    onChange={() => setFormData(prev => ({ ...prev, single_payment_timing: 'on_completion' }))}
                    className="w-4 h-4 text-amber-500"
                  />
                  <span className="text-sm">عند اكتمال العمل</span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="timing"
                    checked={formData.single_payment_timing === 'custom'}
                    onChange={() => setFormData(prev => ({ ...prev, single_payment_timing: 'custom' }))}
                    className="w-4 h-4 text-amber-500"
                  />
                  <span className="text-sm">عند حدث معين</span>
                </label>
                {formData.single_payment_timing === 'custom' && (
                  <input
                    type="text"
                    value={formData.single_payment_custom_event || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, single_payment_custom_event: e.target.value }))}
                    className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="مثال: عند رفع الدعوى، عند صدور الحكم..."
                  />
                )}
              </div>
            </div>
          )}

          {/* دفعات متعددة */}
          {formData.payment_type === 'multiple' && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-gray-700">جدول الدفعات</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">نوع القيمة:</span>
                  <div className="flex bg-white rounded-lg border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => switchValueType('percentage')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        valueType === 'percentage' ? 'bg-purple-500 text-white' : 'text-gray-600'
                      }`}
                    >
                      نسبة %
                    </button>
                    <button
                      type="button"
                      onClick={() => switchValueType('amount')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        valueType === 'amount' ? 'bg-purple-500 text-white' : 'text-gray-600'
                      }`}
                    >
                      مبلغ
                    </button>
                  </div>
                </div>
              </div>

              {/* جدول الدفعات */}
              <div className="space-y-3">
                {formData.installments.map((inst, index) => (
                  <div key={inst.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-purple-700">الدفعة {inst.stage}</span>
                      {formData.installments.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeInstallment(inst.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          {inst.valueType === 'percentage' ? 'النسبة %' : 'المبلغ (ر.س)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={inst.valueType === 'percentage' ? 100 : formData.total_price}
                          value={inst.value || ''}
                          onChange={(e) => updateInstallment(inst.id, 'value', Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">المبلغ المحسوب</label>
                        <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700">
                          {inst.calculatedAmount.toLocaleString()} ر.س
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">المعيار / المخرج المطلوب *</label>
                      <input
                        type="text"
                        value={inst.description}
                        onChange={(e) => updateInstallment(inst.id, 'description', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        placeholder={index === 0 ? 'مثال: عند قبول العرض' : 'مثال: عند رفع الدعوى، عند صدور الحكم...'}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* إضافة دفعة */}
              {formData.installments.length < 6 && (
                <button
                  type="button"
                  onClick={addInstallment}
                  className="w-full mt-3 py-2 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 text-sm font-medium hover:bg-purple-50 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  إضافة دفعة
                </button>
              )}

              {/* مجموع الدفعات */}
              <div className={`mt-4 p-3 rounded-lg flex items-center justify-between ${
                isValidTotal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <div className="flex items-center gap-2">
                  {isValidTotal ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">
                    مجموع {valueType === 'percentage' ? 'النسب' : 'المبالغ'}:
                  </span>
                </div>
                <span className="font-bold">
                  {totalInstallments.toLocaleString()}{valueType === 'percentage' ? '%' : ' ر.س'}
                  {valueType === 'percentage' && ' / 100%'}
                  {valueType === 'amount' && ` / ${formData.total_price.toLocaleString()} ر.س`}
                </span>
              </div>
            </div>
          )}

          {/* تنبيه */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            ⚠️ العرض صالح لمدة أسبوع من تاريخ الإرسال
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || formData.total_price <= 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Send className="w-5 h-5" />
                إرسال العرض
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
