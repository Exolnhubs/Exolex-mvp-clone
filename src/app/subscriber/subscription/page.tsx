'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logoutMember } from '@/lib/auth'
import { getUserId } from '@/lib/cookies'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'

interface User {
  id: string
  full_name: string
}

const packages = [
  {
    id: 'exo',
    name: 'إكسو',
    nameEn: 'Exo',
    price: 499,
    priceDaily: '1.37',
    tagline: 'لمن لديه احتياج محدود… ويريد حماية أساسية موثوقة عند اللزوم',
    description: [
      'نقطة دخول عملية لمن يتوقع استفسارات قليلة أو موضوعًا واحدًا خلال السنة.',
      'توجيه سريع وواضح يساعدك على اتخاذ الخطوة الصحيحة قبل أن تتفاقم المشكلة.',
      'تغطية أساسية بشروط شفافة وفق شبكة المنافع، مناسبة للبدء بثقة.',
    ],
    features: [
      { icon: '💬', label: 'الاستشارات', value: '3 سنوياً' },
      { icon: '⚖️', label: 'القضايا', value: '1 سنوياً' },
      { icon: '🤖', label: 'NOLEX AI', value: 'غير محدود' },
      { icon: '📚', label: 'بحث المكتبة', value: '30 شهرياً' },
      { icon: '⏱️', label: 'وقت الاستجابة (SLA)', value: '36 ساعة' },
    ],
    popular: false,
  },
  {
    id: 'plus',
    name: 'بلس',
    nameEn: 'Plus',
    price: 799,
    priceDaily: '2.19',
    tagline: 'لمن يريد توازنًا ذكيًا بين حماية قوية وتغطية مدروسة',
    description: [
      'مناسب للاحتياجات المتوسطة: دعم قانوني مستمر مع إمكانية التدرج عند الحاجة.',
      'يضمن قرارات أدق من البداية لتقليل التصعيد والأخطاء التي ترفع تكلفة النزاع.',
      'تجربة احترافية بحدود واضحة وفق شبكة المنافع دون تعقيد أو تشتت.',
    ],
    features: [
      { icon: '💬', label: 'الاستشارات', value: '6 سنوياً' },
      { icon: '⚖️', label: 'القضايا', value: '2 سنوياً' },
      { icon: '🤖', label: 'NOLEX AI', value: 'غير محدود' },
      { icon: '📚', label: 'بحث المكتبة', value: '60 شهرياً' },
      { icon: '⏱️', label: 'وقت الاستجابة (SLA)', value: '24 ساعة' },
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'برو',
    nameEn: 'Pro',
    price: 1499,
    priceDaily: '4.11',
    tagline: 'لأصحاب الملفات المتعددة… ولمن يريد أعلى مستوى من الأمان القانوني',
    description: [
      'تغطية شاملة لمن يتوقع احتياجًا قانونيًا متكررًا أو أكثر من نزاع خلال السنة.',
      'مسار واضح يبدأ بالتوجيه ثم يتصاعد إلى التمثيل ضمن نطاق محدد وشروط معلنة.',
      'أعلى درجة من الخصوصية والتنظيم لتجنّب المفاجآت وتخفيف عبء القرارات القانونية.',
    ],
    features: [
      { icon: '💬', label: 'الاستشارات', value: '10 سنوياً' },
      { icon: '⚖️', label: 'القضايا', value: '3 سنوياً' },
      { icon: '🤖', label: 'NOLEX AI', value: 'غير محدود' },
      { icon: '📚', label: 'بحث المكتبة', value: '100 شهرياً' },
      { icon: '⏱️', label: 'وقت الاستجابة (SLA)', value: '12 ساعة' },
      { icon: '⭐', label: 'أولوية قصوى', value: 'نعم' },
    ],
    popular: false,
  },
]

export default function SubscriptionPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    const userId = getUserId()
    
    if (!userId) {
      router.push('/auth/login')
      return
    }

    const fetchData = async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', userId)
        .single()

      if (userData) {
        setUser(userData)
      }

      // Fetch member first
      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()
      
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('member_id', memberData?.id)
        .eq('status', 'active')
        .single()

      if (subData) {
        setIsSubscribed(true)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [router])

  const handleLogout = () => {
    logoutMember()
  }


  const handleSubscribe = async (packageId: string) => {
    const userId = getUserId()
    if (!userId) return
    
    const { error } = await supabase.rpc('activate_subscription_free', {
      p_user_id: userId,
      p_package_name: packageId
    })
    
    if (error) {
      toast.error('حدث خطأ في تفعيل الاشتراك')
      console.error(error)
    } else {
      toast.success('تم تفعيل الاشتراك بنجاح!')
      router.push('/subscriber/dashboard')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        isSubscribed={isSubscribed} 
        userName={user?.full_name || ''} 
        onLogout={handleLogout}
      />

      <main className="flex-1 mr-64 p-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">اختر باقتك</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            حماية قانونية شاملة تبدأ من أقل من 1.5 ريال يومياً. اختر الباقة المناسبة لاحتياجاتك.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {packages.map((pkg) => (
            <div 
              key={pkg.id}
              className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                pkg.popular ? 'ring-2 ring-primary-500 scale-105' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary-600 text-white text-center py-2 text-sm font-medium">
                  ⭐ الأكثر طلباً
                </div>
              )}

              <div className={`p-6 ${pkg.popular ? 'pt-12' : ''}`}>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">{pkg.name}</h2>
                  <p className="text-sm text-gray-400">{pkg.nameEn}</p>
                </div>

                <div className="text-center mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-primary-600">{pkg.price.toLocaleString()}</span>
                    <span className="text-gray-500">ريال</span>
                  </div>
                  <p className="text-sm text-gray-400">سنوياً</p>
                  <p className="text-xs text-green-600 mt-1">≈ {pkg.priceDaily} ريال/يوم</p>
                </div>

                <p className="text-center text-sm text-gray-600 mb-6 min-h-[48px]">
                  {pkg.tagline}
                </p>

                <button
                  onClick={() => handleSubscribe(pkg.id)}
                  className={`w-full py-3 rounded-xl font-medium transition-colors mb-6 ${
                    pkg.popular 
                      ? 'bg-primary-600 text-white hover:bg-primary-700' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  اشترك الآن
                </button>

                <div className="space-y-3 mb-6">
                  {pkg.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{feature.icon}</span>
                        <span className="text-gray-600">{feature.label}</span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {feature.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-gray-400 mb-2">لماذا هذه الباقة؟</p>
                  <ul className="space-y-2">
                    {pkg.description.map((desc, idx) => (
                      <li key={idx} className="text-xs text-gray-500 flex gap-2">
                        <span className="text-green-500 flex-shrink-0">✓</span>
                        <span>{desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* جدول مقارنة الخدمات */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">مقارنة الخدمات والامتيازات</h2>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right p-4 font-medium text-gray-600">الخدمة / الامتياز</th>
                  <th className="text-center p-4 font-medium text-gray-600">إكسو<br/><span className="text-xs text-gray-400">499 ريال</span></th>
                  <th className="text-center p-4 font-medium text-primary-600 bg-primary-50">بلس<br/><span className="text-xs text-primary-400">799 ريال</span></th>
                  <th className="text-center p-4 font-medium text-gray-600">برو<br/><span className="text-xs text-gray-400">1,499 ريال</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr className="bg-blue-50/30">
                  <td colSpan={4} className="p-3 font-semibold text-gray-700">📋 الاستشارات والقضايا</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">💬 الاستشارات القانونية</td>
                  <td className="p-4 text-center font-medium">3 سنوياً</td>
                  <td className="p-4 text-center bg-primary-50 font-medium">6 سنوياً</td>
                  <td className="p-4 text-center font-medium">10 سنوياً</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">⚖️ القضايا (تمثيل قانوني)</td>
                  <td className="p-4 text-center font-medium">1 سنوياً</td>
                  <td className="p-4 text-center bg-primary-50 font-medium">2 سنوياً</td>
                  <td className="p-4 text-center font-medium">3 سنوياً</td>
                </tr>
                
                <tr className="bg-blue-50/30">
                  <td colSpan={4} className="p-3 font-semibold text-gray-700">🤖 الأدوات الرقمية</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">🤖 NOLEX AI (المساعد الذكي)</td>
                  <td className="p-4 text-center text-green-600">✓ غير محدود</td>
                  <td className="p-4 text-center bg-primary-50 text-green-600">✓ غير محدود</td>
                  <td className="p-4 text-center text-green-600">✓ غير محدود</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">📚 بحث المكتبة القانونية</td>
                  <td className="p-4 text-center">30 شهرياً</td>
                  <td className="p-4 text-center bg-primary-50 font-medium">60 شهرياً</td>
                  <td className="p-4 text-center font-medium">100 شهرياً</td>
                </tr>
                
                <tr className="bg-blue-50/30">
                  <td colSpan={4} className="p-3 font-semibold text-gray-700">⚡ مستوى الخدمة</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">⏱️ وقت الاستجابة (SLA)</td>
                  <td className="p-4 text-center">36 ساعة</td>
                  <td className="p-4 text-center bg-primary-50">24 ساعة</td>
                  <td className="p-4 text-center text-green-600 font-medium">12 ساعة</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">⭐ أولوية في التعيين</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center bg-primary-50 text-gray-400">—</td>
                  <td className="p-4 text-center text-green-600">✓</td>
                </tr>
                <tr>
                  <td className="p-4 text-gray-600">📞 خط دعم مخصص</td>
                  <td className="p-4 text-center text-gray-400">—</td>
                  <td className="p-4 text-center bg-primary-50 text-gray-400">—</td>
                  <td className="p-4 text-center text-green-600">✓</td>
                </tr>
                
                <tr className="bg-green-50">
                  <td className="p-4 font-semibold text-gray-700">💰 التكلفة اليومية</td>
                  <td className="p-4 text-center font-bold text-green-600">~1.37 ريال</td>
                  <td className="p-4 text-center bg-primary-100 font-bold text-primary-600">~2.19 ريال</td>
                  <td className="p-4 text-center font-bold text-green-600">~4.11 ريال</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ملاحظة مهمة */}
        <div className="mt-8 max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-800 mb-2">📌 ملاحظة مهمة</h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• الاستشارات والقضايا صالحة لمدة الاشتراك (سنة كاملة)</li>
            <li>• الرصيد غير المستخدم لا يُرحّل للسنة التالية</li>
            <li>• يمكن شراء استشارات أو قضايا إضافية بأسعار خاصة للمشتركين</li>
            <li>• جميع الباقات تشمل NOLEX AI بدون حدود</li>
          </ul>
        </div>

        {/* أسئلة شائعة */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">أسئلة شائعة</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-2">هل يمكنني ترقية باقتي لاحقاً؟</h3>
              <p className="text-gray-500 text-sm">خلال 30 يوم من الاشتراك في حال لم تستخدم أي من مميزات الباقة الحالية، يمكنك الترقية. بعد انقضاء الشهر لا تتم الترقية إلا في نهاية الاشتراك.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-2">ماذا يحدث إذا استهلكت رصيد الاستشارات؟</h3>
              <p className="text-gray-500 text-sm">يمكنك شراء استشارات إضافية بسعر مخفض للمشتركين.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-2">هل يمكنني استرداد المبلغ؟</h3>
              <p className="text-gray-500 text-sm">نعم، خلال 14 يوم من الاشتراك إذا لم تستخدم أي خدمة من خدمات ومميزات الباقة.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-2">ما الفرق بين الاستشارة والقضية؟</h3>
              <p className="text-gray-500 text-sm">الاستشارة هي جلسة توجيه قانوني لفهم موقفك وخياراتك. القضية تشمل التمثيل القانوني الكامل أمام الجهات المختصة.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
