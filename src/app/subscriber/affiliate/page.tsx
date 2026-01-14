'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

interface LoyaltySettings {
  points_to_sar_ratio: number
  min_withdrawal_points: number
  referral_registration_points: number
  referral_subscription_points: number
  referral_renewal_points: number
  referral_subscription_percentage: number
  subscription_redemption_ratio: number
}

const DEFAULT_SETTINGS: LoyaltySettings = {
  points_to_sar_ratio: 10,
  min_withdrawal_points: 1000,
  referral_registration_points: 10,
  referral_subscription_points: 50,
  referral_renewal_points: 25,
  referral_subscription_percentage: 5,
  subscription_redemption_ratio: 10,
}

const SAUDI_BANKS = [
  'البنك الأهلي السعودي',
  'بنك الراجحي',
  'بنك الرياض',
  'البنك السعودي الفرنسي',
  'البنك السعودي البريطاني (ساب)',
  'بنك الجزيرة',
  'البنك العربي الوطني',
  'بنك البلاد',
  'بنك الإنماء',
]

export default function AffiliatePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [member, setMember] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'rewards' | 'history'>('overview')
  
  // Settings
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS)
  
  // Data
  const [referralCode, setReferralCode] = useState('')
  const [stats, setStats] = useState({ total_clicks: 0, total_registrations: 0, total_subscriptions: 0 })
  const [totalPoints, setTotalPoints] = useState(0)
  const [pointsHistory, setPointsHistory] = useState<any[]>([])
  const [referralHistory, setReferralHistory] = useState<any[]>([])

  // Modals
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  
  // Withdraw Form
  const [withdrawPoints, setWithdrawPoints] = useState(1000)
  const [bankName, setBankName] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [iban, setIban] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Subscription Form
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  // الباقات (تحسب ديناميكياً من الإعدادات)
  const getSubscriptionPlans = () => [
    { id: 'exo', name: 'إكسو', price: 449, points: Math.round(449 * settings.subscription_redemption_ratio), icon: '🔵' },
    { id: 'plus', name: 'بلس', price: 799, points: Math.round(799 * settings.subscription_redemption_ratio), icon: '🟣' },
    { id: 'pro', name: 'برو', price: 1499, points: Math.round(1499 * settings.subscription_redemption_ratio), icon: '🟡' },
  ]

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      try {
        // Fetch loyalty settings
        const { data: loyaltyData } = await supabase
          .from('loyalty_settings')
          .select('*')
          .eq('is_active', true)
          .single()
        
        if (loyaltyData) {
          setSettings({
            points_to_sar_ratio: loyaltyData.points_to_sar_ratio || 10,
            min_withdrawal_points: loyaltyData.min_withdrawal_points || 1000,
            referral_registration_points: loyaltyData.referral_registration_points || 10,
            referral_subscription_points: loyaltyData.referral_subscription_points || 50,
            referral_renewal_points: loyaltyData.referral_renewal_points || 25,
            referral_subscription_percentage: loyaltyData.referral_subscription_percentage || 5,
            subscription_redemption_ratio: loyaltyData.subscription_redemption_ratio || 10,
          })
          setWithdrawPoints(loyaltyData.min_withdrawal_points || 1000)
        }

        // Fetch user
        const { data: userData } = await supabase.from('users').select('*').eq('id', userId).single()
        if (userData) setUser(userData)

        // Fetch member
        const { data: memberData } = await supabase.from('members').select('*').eq('user_id', userId).single()
        
        if (memberData) {
          setMember(memberData)
          setTotalPoints(memberData.total_points || 0)
          
          if (!memberData.referral_code) {
            const { data: newCode } = await supabase.rpc('generate_unique_referral_code', {
              user_name: userData?.full_name || 'USER'
            })
            if (newCode) {
              await supabase.from('members').update({ referral_code: newCode }).eq('id', memberData.id)
              setReferralCode(newCode)
            }
          } else {
            setReferralCode(memberData.referral_code)
          }
        }

        
        // Fetch subscription
        const { data: subData } = await supabase.from('subscriptions').select('*').eq('member_id', memberData?.id).eq('status', 'active').single()
        if (subData) setIsSubscribed(true)

        // Fetch affiliate stats
        const { data: affiliateData } = await supabase.from('affiliates').select('*').eq('user_id', userId).single()
        if (affiliateData) {
          setStats({
            total_clicks: affiliateData.total_clicks || 0,
            total_registrations: affiliateData.total_registrations || 0,
            total_subscriptions: affiliateData.total_subscriptions || 0,
          })
          if (affiliateData.affiliate_code) setReferralCode(affiliateData.affiliate_code)
        }

        // Fetch click stats
        if (memberData?.referral_code) {
          const { count } = await supabase
            .from('referral_clicks')
            .select('*', { count: 'exact', head: true })
            .eq('referral_code', memberData.referral_code)
          if (count) setStats(prev => ({ ...prev, total_clicks: count }))
        }

        // Fetch points history
        const { data: pointsData } = await supabase
          .from('user_points')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
        if (pointsData) setPointsHistory(pointsData)

        // Fetch referral history
        if (memberData?.referral_code) {
          const { data: referralsData } = await supabase
            .from('referrals')
            .select('id, status, registered_at, subscribed_at')
            .eq('affiliate_code_used', memberData.referral_code)
            .order('created_at', { ascending: false })
          
          if (referralsData) {
            setReferralHistory(referralsData)
            setStats(prev => ({
              ...prev,
              total_registrations: referralsData.length,
              total_subscriptions: referralsData.filter(r => r.status === 'subscribed').length
            }))
          }
        }

      } catch (err) {
        console.error('Error:', err)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const getReferralLink = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://exolex.sa'
    return `${baseUrl}/auth/register?ref=${referralCode}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink())
      setCopied(true)
      toast.success('تم نسخ الرابط!')
      setTimeout(() => setCopied(false), 3000)
    } catch { toast.error('فشل نسخ الرابط') }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode)
      toast.success('تم نسخ الكود!')
    } catch { toast.error('فشل نسخ الكود') }
  }

  const handleShare = (platform: string) => {
    const link = getReferralLink()
    const text = 'انضم لمنصة ExoLex للحماية القانونية واحصل على استشارات قانونية بأسعار مناسبة!'
    let shareUrl = ''
    switch (platform) {
      case 'whatsapp': shareUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n' + link)}`; break
      case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`; break
      case 'telegram': shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`; break
      case 'email': shareUrl = `mailto:?subject=${encodeURIComponent('دعوة للانضمام لـ ExoLex')}&body=${encodeURIComponent(text + '\n\n' + link)}`; break
    }
    if (shareUrl) window.open(shareUrl, '_blank')
  }

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    router.push('/auth/login')
  }

  // ═══════════════════════════════════════════════════════════════
  // فتح Modal السحب مع التحقق
  // ═══════════════════════════════════════════════════════════════
  const handleOpenWithdrawModal = () => {
    const minSar = settings.min_withdrawal_points / settings.points_to_sar_ratio
    
    if (totalPoints < settings.min_withdrawal_points) {
      const needed = settings.min_withdrawal_points - totalPoints
      toast.error(
        `عذراً، لا يمكنك السحب حالياً.\nالحد الأدنى للسحب هو ${minSar} ر.س (${settings.min_withdrawal_points.toLocaleString()} نقطة)\nتحتاج ${needed.toLocaleString()} نقطة إضافية`,
        { duration: 5000 }
      )
      return
    }
    
    setWithdrawPoints(settings.min_withdrawal_points)
    setShowWithdrawModal(true)
  }

  // ═══════════════════════════════════════════════════════════════
  // فتح Modal الاشتراك مع التحقق
  // ═══════════════════════════════════════════════════════════════
  const handleOpenSubscriptionModal = () => {
    const plans = getSubscriptionPlans()
    const cheapestPlan = plans.reduce((min, p) => p.points < min.points ? p : min, plans[0])
    
    if (totalPoints < cheapestPlan.points) {
      const needed = cheapestPlan.points - totalPoints
      toast.error(
        `عذراً، رصيد نقاطك غير كافٍ.\nأقل باقة (${cheapestPlan.name}) تحتاج ${cheapestPlan.points.toLocaleString()} نقطة\nرصيدك الحالي: ${totalPoints.toLocaleString()} نقطة\nتحتاج ${needed.toLocaleString()} نقطة إضافية`,
        { duration: 5000 }
      )
      return
    }
    
    setShowSubscriptionModal(true)
  }

  // ═══════════════════════════════════════════════════════════════
  // سحب الرصيد
  // ═══════════════════════════════════════════════════════════════
  const handleWithdraw = async () => {
    if (!user || !member) return
    
    if (withdrawPoints < settings.min_withdrawal_points) {
      toast.error(`الحد الأدنى للسحب ${settings.min_withdrawal_points} نقطة`)
      return
    }
    if (withdrawPoints > totalPoints) {
      toast.error('رصيدك غير كافٍ')
      return
    }
    if (!bankName || !accountHolderName || !iban) {
      toast.error('يرجى تعبئة جميع البيانات البنكية')
      return
    }
    if (!iban.startsWith('SA') || iban.length !== 24) {
      toast.error('رقم IBAN غير صحيح. يجب أن يبدأ بـ SA ويتكون من 24 حرف')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const cashAmount = withdrawPoints / settings.points_to_sar_ratio
      
      await supabase.from('points_withdrawal_requests').insert({
        user_id: user.id,
        member_id: member.id,
        points_amount: withdrawPoints,
        cash_amount: cashAmount,
        bank_name: bankName,
        account_holder_name: accountHolderName,
        iban: iban.toUpperCase(),
        status: 'pending'
      })
      
      await supabase.from('user_points').insert({
        user_id: user.id,
        member_id: member.id,
        points: -withdrawPoints,
        type: 'redeemed',
        reason: 'withdrawal',
        description: `سحب ${cashAmount} ر.س`
      })
      
      await supabase.from('members').update({
        total_points: totalPoints - withdrawPoints
      }).eq('id', member.id)
      
      setTotalPoints(prev => prev - withdrawPoints)
      toast.success('تم إرسال طلب السحب بنجاح! سيتم التحويل خلال 3-5 أيام عمل')
      setShowWithdrawModal(false)
      resetWithdrawForm()
      
    } catch (err) {
      console.error('Withdraw error:', err)
      toast.error('حدث خطأ في إرسال الطلب')
    }
    
    setIsSubmitting(false)
  }

  const resetWithdrawForm = () => {
    setWithdrawPoints(settings.min_withdrawal_points)
    setBankName('')
    setAccountHolderName('')
    setIban('')
  }

  // ═══════════════════════════════════════════════════════════════
  // تحويل للاشتراك
  // ═══════════════════════════════════════════════════════════════
  const handleSubscriptionRedemption = async () => {
    if (!user || !member || !selectedPlan) return
    
    const plans = getSubscriptionPlans()
    const plan = plans.find(p => p.id === selectedPlan)
    if (!plan) return
    
    if (totalPoints < plan.points) {
      toast.error(`تحتاج ${plan.points.toLocaleString()} نقطة للاشتراك في باقة ${plan.name}`)
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const startDate = new Date()
      const endDate = new Date()
      endDate.setFullYear(endDate.getFullYear() + 1)
      
      const { data: newSub } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan_type: plan.id,
        status: 'active',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        amount_paid: 0,
        payment_method: 'points_redemption',
        is_auto_renew: false
      }).select().single()
      
      await supabase.from('points_subscription_redemptions').insert({
        user_id: user.id,
        member_id: member.id,
        points_used: plan.points,
        plan_type: plan.id,
        plan_name: plan.name,
        plan_value: plan.price,
        subscription_id: newSub?.id,
        status: 'completed'
      })
      
      await supabase.from('user_points').insert({
        user_id: user.id,
        member_id: member.id,
        points: -plan.points,
        type: 'redeemed',
        reason: 'subscription_redemption',
        description: `استبدال باشتراك باقة ${plan.name}`
      })
      
      await supabase.from('members').update({
        total_points: totalPoints - plan.points
      }).eq('id', member.id)
      
      setTotalPoints(prev => prev - plan.points)
      setIsSubscribed(true)
      
      toast.success(`🎉 تم الاشتراك في باقة ${plan.name} بنجاح!`)
      setShowSubscriptionModal(false)
      setSelectedPlan(null)
      
    } catch (err) {
      console.error('Subscription error:', err)
      toast.error('حدث خطأ في عملية الاستبدال')
    }
    
    setIsSubmitting(false)
  }

  const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('ar-SA') : '-'

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'registration_referral': 'تسجيل صديق',
      'subscription_referral': 'اشتراك صديق',
      'renewal_referral': 'تجديد صديق',
      'welcome_bonus': 'مكافأة ترحيبية',
      'withdrawal': 'سحب رصيد',
      'subscription_redemption': 'تحويل لاشتراك',
    }
    return labels[reason] || reason
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const REWARDS = [
    { icon: '👤', title: 'عند تسجيل صديق', reward: `${settings.referral_registration_points} نقاط`, description: 'تحصل على نقاط فور تسجيل صديقك' },
    { icon: '💎', title: 'عند اشتراك صديق', reward: `${settings.referral_subscription_points} نقطة + ${settings.referral_subscription_percentage}%`, description: 'مكافأة عند اشتراك صديقك' },
    { icon: '🔄', title: 'عند تجديد الاشتراك', reward: `${settings.referral_renewal_points} نقطة`, description: 'نقاط مع كل تجديد لصديقك' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64">
        {/* Header */}
        <header className="bg-gradient-to-l from-green-600 to-emerald-700 text-white">
          <div className="max-w-5xl mx-auto px-8 py-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">🎁</div>
              <div>
                <h1 className="text-3xl font-bold">مشاركة التطبيق</h1>
                <p className="text-green-100 mt-1">شارك ExoLex مع أصدقائك واكسب مكافآت!</p>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-8">
            <div className="flex gap-8">
              {[
                { id: 'overview', label: '📊 نظرة عامة' },
                { id: 'rewards', label: '🎁 المكافآت' },
                { id: 'history', label: '📜 السجل' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8">
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* رابط الإحالة */}
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🔗 رابط الإحالة الخاص بك</h2>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-500">كود الإحالة:</span>
                    <span onClick={handleCopyCode} className="font-mono font-bold text-lg text-green-600 bg-green-50 px-3 py-1 rounded cursor-pointer hover:bg-green-100">{referralCode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={getReferralLink()} readOnly className="flex-1 bg-white border rounded-lg px-4 py-2 text-sm text-gray-600" dir="ltr" />
                    <button onClick={handleCopyLink} className={`px-4 py-2 rounded-lg font-medium transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                      {copied ? '✓ تم النسخ' : '📋 نسخ'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-3">شارك عبر:</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleShare('whatsapp')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600">💬 واتساب</button>
                    <button onClick={() => handleShare('twitter')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600">🐦 تويتر</button>
                    <button onClick={() => handleShare('telegram')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">✈️ تليجرام</button>
                    <button onClick={() => handleShare('email')} className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600">📧 بريد</button>
                  </div>
                </div>
              </section>

              {/* إحصائيات */}
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📊 إحصائياتك</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{stats.total_clicks}</p>
                    <p className="text-sm text-gray-600 mt-1">نقرات على الرابط</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{stats.total_registrations}</p>
                    <p className="text-sm text-gray-600 mt-1">تسجيلات جديدة</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-purple-600">{stats.total_subscriptions}</p>
                    <p className="text-sm text-gray-600 mt-1">اشتراكات</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-amber-600">{totalPoints.toLocaleString()}</p>
                    <p className="text-sm text-gray-600 mt-1">نقاطك الحالية</p>
                  </div>
                </div>
              </section>

              {/* رصيدك - الأزرار دائماً تعمل */}
              <section className="bg-gradient-to-l from-amber-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">رصيدك من النقاط</p>
                    <p className="text-4xl font-bold mt-1">{totalPoints.toLocaleString()} نقطة</p>
                    <p className="text-amber-100 text-sm mt-2">≈ {(totalPoints / settings.points_to_sar_ratio).toLocaleString()} ر.س</p>
                  </div>
                  <div className="text-6xl opacity-50">🎁</div>
                </div>
                <div className="mt-4 flex gap-3">
                  <button 
                    onClick={handleOpenWithdrawModal}
                    className="flex-1 py-2.5 rounded-lg font-medium bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
                  >
                    💰 سحب الرصيد
                  </button>
                  <button 
                    onClick={handleOpenSubscriptionModal}
                    className="flex-1 py-2.5 rounded-lg font-medium bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
                  >
                    🔄 تحويل لاشتراك
                  </button>
                </div>
                <p className="text-amber-200 text-xs mt-3 text-center">
                  الحد الأدنى للسحب: {(settings.min_withdrawal_points / settings.points_to_sar_ratio).toLocaleString()} ر.س ({settings.min_withdrawal_points.toLocaleString()} نقطة)
                </p>
              </section>

              {/* كيف يعمل */}
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🤔 كيف يعمل البرنامج؟</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">1️⃣</div>
                    <h3 className="font-bold text-gray-800 mb-2">شارك رابطك</h3>
                    <p className="text-sm text-gray-600">انسخ رابط الإحالة وشاركه مع أصدقائك</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">2️⃣</div>
                    <h3 className="font-bold text-gray-800 mb-2">صديقك يسجل</h3>
                    <p className="text-sm text-gray-600">عند تسجيل صديقك عبر رابطك تحصل على نقاط</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">3️⃣</div>
                    <h3 className="font-bold text-gray-800 mb-2">اكسب المكافآت</h3>
                    <p className="text-sm text-gray-600">نقاط إضافية عند اشتراكه وتجديده</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-6">
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">🎁 نظام المكافآت</h2>
                <div className="space-y-4">
                  {REWARDS.map((reward, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm">{reward.icon}</div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{reward.title}</h3>
                        <p className="text-sm text-gray-500">{reward.description}</p>
                      </div>
                      <span className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">{reward.reward}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">💱 تحويل النقاط للاشتراك</h2>
                <div className="space-y-3">
                  {getSubscriptionPlans().map(plan => (
                    <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{plan.icon}</span>
                        <div>
                          <p className="font-bold text-gray-800">باقة {plan.name}</p>
                          <p className="text-sm text-gray-500">{plan.price} ر.س / سنة</p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className={`font-bold ${totalPoints >= plan.points ? 'text-green-600' : 'text-gray-400'}`}>
                          {plan.points.toLocaleString()} نقطة
                        </p>
                        {totalPoints < plan.points && (
                          <p className="text-xs text-red-500">تحتاج {(plan.points - totalPoints).toLocaleString()} إضافية</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">📜 سجل الإحالات</h2>
                {referralHistory.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">تاريخ التسجيل</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">الحالة</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500">تاريخ الاشتراك</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {referralHistory.map(ref => (
                        <tr key={ref.id}>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(ref.registered_at)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${ref.status === 'subscribed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                              {ref.status === 'subscribed' ? 'مشترك' : 'مسجل'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{ref.subscribed_at ? formatDate(ref.subscribed_at) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12">
                    <span className="text-6xl">📭</span>
                    <p className="text-gray-500 mt-4">لا توجد إحالات بعد</p>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">💰 سجل النقاط</h2>
                {pointsHistory.length > 0 ? (
                  <div className="space-y-3">
                    {pointsHistory.map(point => (
                      <div key={point.id} className={`flex items-center justify-between p-3 rounded-lg ${point.type === 'earned' ? 'bg-green-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{point.type === 'earned' ? '➕' : '➖'}</span>
                          <div>
                            <p className="font-medium text-gray-800">{getReasonLabel(point.reason)}</p>
                            <p className="text-xs text-gray-500">{formatDate(point.created_at)}</p>
                          </div>
                        </div>
                        <span className={`font-bold ${point.type === 'earned' ? 'text-green-600' : 'text-red-600'}`}>
                          {point.type === 'earned' ? '+' : ''}{point.points}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">لا توجد عمليات نقاط بعد</div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Modal سحب الرصيد */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-xl font-bold">💰 سحب الرصيد</h2>
              <button onClick={() => { setShowWithdrawModal(false); resetWithdrawForm() }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <p className="text-sm text-amber-700">رصيدك الحالي</p>
                <p className="text-3xl font-bold text-amber-600">{totalPoints.toLocaleString()} نقطة</p>
                <p className="text-sm text-amber-600">≈ {(totalPoints / settings.points_to_sar_ratio).toLocaleString()} ر.س</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">عدد النقاط للسحب</label>
                <input
                  type="number"
                  value={withdrawPoints}
                  onChange={(e) => setWithdrawPoints(Math.max(settings.min_withdrawal_points, Math.min(totalPoints, parseInt(e.target.value) || 0)))}
                  min={settings.min_withdrawal_points}
                  max={totalPoints}
                  step={100}
                  className="w-full border rounded-lg px-4 py-3 text-lg font-bold text-center"
                />
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-gray-500">الحد الأدنى: {settings.min_withdrawal_points.toLocaleString()} نقطة</span>
                  <span className="text-green-600 font-bold">= {(withdrawPoints / settings.points_to_sar_ratio).toLocaleString()} ر.س</span>
                </div>
              </div>

              <div className="border-t pt-5">
                <h3 className="font-semibold text-gray-800 mb-3">🏦 البيانات البنكية</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">البنك</label>
                    <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full border rounded-lg px-4 py-2">
                      <option value="">اختر البنك</option>
                      {SAUDI_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم صاحب الحساب</label>
                    <input type="text" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="كما هو مسجل في البنك" className="w-full border rounded-lg px-4 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الآيبان (IBAN)</label>
                    <input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="SA0000000000000000000000" maxLength={24} className="w-full border rounded-lg px-4 py-2 font-mono text-left" dir="ltr" />
                    <p className="text-xs text-gray-500 mt-1">يبدأ بـ SA ويتكون من 24 حرف</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                ⏱️ سيتم تحويل المبلغ خلال 3-5 أيام عمل بعد الموافقة
              </div>

              <div className="flex gap-3">
                <button onClick={() => { setShowWithdrawModal(false); resetWithdrawForm() }} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">إلغاء</button>
                <button onClick={handleWithdraw} disabled={isSubmitting || !bankName || !accountHolderName || !iban} className="flex-1 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'جاري الإرسال...' : 'تأكيد السحب'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal تحويل لاشتراك */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">🔄 تحويل النقاط لاشتراك</h2>
              <button onClick={() => { setShowSubscriptionModal(false); setSelectedPlan(null) }} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <p className="text-sm text-amber-700">رصيدك الحالي</p>
                <p className="text-3xl font-bold text-amber-600">{totalPoints.toLocaleString()} نقطة</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-3">اختر الباقة</h3>
                <div className="space-y-3">
                  {getSubscriptionPlans().map(plan => {
                    const canAfford = totalPoints >= plan.points
                    return (
                      <div
                        key={plan.id}
                        onClick={() => canAfford && setSelectedPlan(plan.id)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedPlan === plan.id ? 'border-green-500 bg-green-50' : canAfford ? 'border-gray-200 hover:border-gray-300 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{plan.icon}</span>
                            <div>
                              <p className="font-bold text-gray-800">باقة {plan.name}</p>
                              <p className="text-sm text-gray-500">{plan.price} ر.س / سنة</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className={`font-bold ${canAfford ? 'text-green-600' : 'text-gray-400'}`}>{plan.points.toLocaleString()} نقطة</p>
                            {!canAfford && <p className="text-xs text-red-500">تحتاج {(plan.points - totalPoints).toLocaleString()} إضافية</p>}
                          </div>
                        </div>
                        {selectedPlan === plan.id && <div className="mt-2 text-green-600 text-sm">✓ تم الاختيار</div>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedPlan && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-700">ملخص العملية:</p>
                  <p className="font-bold text-green-800">
                    سيتم خصم {getSubscriptionPlans().find(p => p.id === selectedPlan)?.points.toLocaleString()} نقطة
                    وتفعيل باقة {getSubscriptionPlans().find(p => p.id === selectedPlan)?.name} لمدة سنة
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setShowSubscriptionModal(false); setSelectedPlan(null) }} className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">إلغاء</button>
                <button onClick={handleSubscriptionRedemption} disabled={isSubmitting || !selectedPlan} className="flex-1 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'جاري التحويل...' : 'تأكيد الاشتراك'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
