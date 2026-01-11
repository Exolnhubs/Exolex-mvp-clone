'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import toast from 'react-hot-toast'
import SearchHistory from '@/components/library/SearchHistory'

// ═══════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════
interface User {
  id: string
  full_name: string
}

interface Category {
  id: string
  code: string
  name_ar: string
  icon: string
  color: string
}

interface Document {
  id: string
  title_ar: string
  description_ar: string
  doc_type: string
  document_number: string
  issue_date: string
  authority?: {
    name_ar: string
  }
  category?: {
    name_ar: string
    color: string
    icon: string
  }
  view_count: number
}

interface QuotaPackage {
  id: string
  code: string
  name_ar: string
  searches_limit: number
  price: number
  is_recurring: boolean
}

interface UserQuota {
  id: string
  searches_used: number
  searches_remaining: number
  period_end: string
}

interface SearchResult {
  answer: string
  sources: {
    title: string
    article: string
    content: string
  }[]
  documents: Document[]
}

export default function LibraryPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  // البيانات
  const [categories, setCategories] = useState<Category[]>([])
  const [popularDocs, setPopularDocs] = useState<Document[]>([])
  const [recentDocs, setRecentDocs] = useState<Document[]>([])
  const [quotaPackages, setQuotaPackages] = useState<QuotaPackage[]>([])
  const [userQuota, setUserQuota] = useState<UserQuota | null>(null)
  
  // البحث
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  // Modals
  const [showQuotaModal, setShowQuotaModal] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)

  // ═══════════════════════════════════════════════════════════════
  // جلب البيانات
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    if (!userId) { router.push('/auth/login'); return }

    const fetchData = async () => {
      // جلب المستخدم
      const { data: userData } = await supabase
        .from('users').select('id, full_name').eq('id', userId).single()
      if (userData) setUser(userData)

      // جلب member أولاً
      const { data: memberData } = await supabase.from('members').select('id').eq('user_id', userId).single()

      // جلب الاشتراك
      const { data: subData } = await supabase
        .from('subscriptions').select('id, status')
        .eq('member_id', memberData?.id).eq('status', 'active').single()
      if (subData) setIsSubscribed(true)

      // جلب التصنيفات
      const { data: categoriesData } = await supabase
        .from('kb_categories')
        .select('id, code, name_ar, icon, color')
        .eq('is_active', true)
        .order('sort_order')
      if (categoriesData) setCategories(categoriesData)

      // جلب الوثائق الأكثر بحثاً
      const { data: popularData } = await supabase
        .from('kb_documents')
        .select('*, authority:kb_issuing_authorities(name_ar), category:kb_categories(name_ar, color, icon)')
        .eq('is_published', true)
        .order('search_count', { ascending: false })
        .limit(5)
      if (popularData) setPopularDocs(popularData)

      // جلب الوثائق المضافة حديثاً
      const { data: recentData } = await supabase
        .from('kb_documents')
        .select('*, authority:kb_issuing_authorities(name_ar), category:kb_categories(name_ar, color, icon)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5)
      if (recentData) setRecentDocs(recentData)

      // جلب باقات الحصص
      const { data: packagesData } = await supabase
        .from('kb_quota_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (packagesData) setQuotaPackages(packagesData)

      // جلب حصة المستخدم
      const { data: quotaData } = await supabase
        .from('kb_user_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()
      
      if (quotaData) {
        setUserQuota(quotaData)
      } else {
        // إنشاء حصة مجانية جديدة
        const freePackage = packagesData?.find(p => p.code === 'free')
        if (freePackage) {
          const { data: newQuota } = await supabase
            .from('kb_user_quotas')
            .insert({
              user_id: userId,
              package_id: freePackage.id,
              searches_remaining: freePackage.searches_limit,
              period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select()
            .single()
          if (newQuota) setUserQuota(newQuota)
        }
      }

      setIsLoading(false)
    }
    fetchData()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('exolex_user_id')
    localStorage.removeItem('exolex_phone')
    router.push('/auth/login')
  }

  // ═══════════════════════════════════════════════════════════════
  // البحث
  // ═══════════════════════════════════════════════════════════════
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('الرجاء كتابة سؤال أو كلمة بحث')
      return
    }

    // التحقق من الحصة
    if (!userQuota || userQuota.searches_remaining <= 0) {
      toast.error('انتهت حصة البحث! اشترِ باقة جديدة')
      setShowQuotaModal(true)
      return
    }

    setIsSearching(true)
    setSearchResult(null)

    try {
      // خصم من الحصة
      await supabase
        .from('kb_user_quotas')
        .update({ 
          searches_used: (userQuota.searches_used || 0) + 1,
          searches_remaining: userQuota.searches_remaining - 1 
        })
        .eq('id', userQuota.id)

      // تحديث الحصة محلياً
      setUserQuota({
        ...userQuota,
        searches_used: (userQuota.searches_used || 0) + 1,
        searches_remaining: userQuota.searches_remaining - 1
      })

      // حفظ السؤال
      await supabase
        .from('kb_questions')
        .insert({
          user_id: user?.id,
          question_text: searchQuery,
          language: 'ar',
          source_page: 'library'
        })

      // TODO: ربط مع OpenAI API للإجابة الحقيقية
      // للآن نستخدم Mock Response
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: searchQuery }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "حدث خطأ");

      const mockResult: SearchResult = {
        answer: data.answer ||
          `هذه إجابة تجريبية. سيتم ربط النظام مع NOLEX AI قريباً للحصول على إجابات دقيقة من المكتبة القانونية.\n\n` +
          `⚠️ هذه معلومات عامة ولا تغني عن استشارة محامٍ مختص.`,
        sources: [
          { title: 'نظام العمل', article: 'المادة 84', content: 'نص المادة التجريبي...' },
          { title: 'نظام العمل', article: 'المادة 77', content: 'نص المادة التجريبي...' },
        ],
        documents: popularDocs.slice(0, 3)
      }

      setSearchResult(mockResult)

      // حفظ في سجل البحث
      await supabase.from('kb_search_history').insert({
        user_id: user?.id,
        question_text: searchQuery,
        answer_text: data.answer,
        is_out_of_scope: data.isOutOfScope || false,
        tokens_used: data.tokens || 0
      })

    } catch (error) {
      console.error('Search error:', error)
      toast.error('حدث خطأ في البحث')
    } finally {
      setIsSearching(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // عرض الوثيقة
  // ═══════════════════════════════════════════════════════════════
  const openDocument = (doc: Document) => {
    setSelectedDocument(doc)
    setShowDocumentModal(true)
    
    // زيادة عداد المشاهدات
    supabase
      .from('kb_documents')
      .update({ view_count: (doc.view_count || 0) + 1 })
      .eq('id', doc.id)
  }

  // ═══════════════════════════════════════════════════════════════
  // تحميل الوثيقة
  // ═══════════════════════════════════════════════════════════════
  const downloadDocument = async (doc: Document) => {
    toast.success('جاري تجهيز رابط التحميل...')
    setTimeout(() => {
      toast.success('سيتم إضافة خاصية التحميل قريباً')
    }, 1000)
  }

  // ═══════════════════════════════════════════════════════════════
  // شراء باقة
  // ═══════════════════════════════════════════════════════════════
  const purchasePackage = async (pkg: QuotaPackage) => {
    if (pkg.price === 0) {
      toast.error('أنت تستخدم الباقة المجانية بالفعل')
      return
    }
    toast.success('سيتم إضافة الدفع قريباً')
  }

  // تنسيق التاريخ
  const handleSelectHistory = (item: any) => {
    setSearchQuery(item.question_text)
    setSearchResult({
      answer: item.answer_text,
      sources: [],
      documents: []
    })
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ar-SA')
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
      <Sidebar isSubscribed={isSubscribed} userName={user?.full_name || ''} onLogout={handleLogout} />

      <main className="flex-1 mr-64 flex flex-row-reverse">
        {/* المحتوى الرئيسي */}
        {showHistory && user && (
          <div className="w-72 bg-white border-l h-screen sticky top-0 overflow-hidden">
            <SearchHistory userId={user.id} onSelectSearch={handleSelectHistory} />
          </div>
        )}
        
        <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-4xl">📚</span>
              <h1 className="text-3xl font-bold text-gray-800">المكتبة القانونية الرقمية</h1>
            </div>
            <p className="text-gray-500">اسأل أي سؤال قانوني واحصل على إجابة مدعومة بالمصادر</p>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="اسأل سؤالاً قانونياً أو ابحث عن نظام..."
                className="flex-1 text-lg border-2 border-gray-200 rounded-xl px-5 py-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-primary-600 text-white px-8 py-4 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري البحث...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>بحث</span>
                  </>
                )}
              </button>
            </div>

            {/* Quota Badge */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">📊 رصيدك:</span>
                <span className={`font-bold ${userQuota && userQuota.searches_remaining > 3 ? 'text-green-600' : 'text-red-600'}`}>
                  {userQuota?.searches_remaining || 0} من {(userQuota?.searches_remaining || 0) + (userQuota?.searches_used || 0)} بحث
                </span>
              </div>
              <button
                onClick={() => setShowQuotaModal(true)}
                className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
              >
                <span>🛒</span>
                <span>شراء باقة بحث</span>
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex gap-3 mb-6 flex-wrap justify-center">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${
                selectedCategory === 'all'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >
              <span>📋</span>
              <span>الكل</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.code}
                onClick={() => setSelectedCategory(cat.code)}
                className={`px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 border-2 ${
                  selectedCategory === cat.code
                    ? 'text-white'
                    : 'bg-white hover:bg-gray-50'
                }`}
                style={{
                  backgroundColor: selectedCategory === cat.code ? cat.color : undefined,
                  borderColor: cat.color
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name_ar}</span>
              </button>
            ))}
          </div>

          {/* Search Results */}
          {searchResult && (
            <div className="mb-8">
              {/* NOLEX Answer */}
              <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl p-6 mb-6 border border-primary-100">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🤖</span>
                  <h3 className="font-bold text-lg text-gray-800">إجابة NOLEX</h3>
                </div>
                <div className="bg-white rounded-xl p-5">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {searchResult.answer}
                  </p>
                  
                  {/* Sources */}
                  {searchResult.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500 mb-2">📎 المصادر:</p>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.sources.map((source, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                            {source.title} - {source.article}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="flex gap-2">
                      <button className="text-gray-400 hover:text-green-600 p-2 rounded-lg hover:bg-green-50">
                        👍 مفيد
                      </button>
                      <button className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50">
                        👎 غير دقيق
                      </button>
                    </div>
                    <button 
                      onClick={() => router.push('/subscriber/nolex')}
                      className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1"
                    >
                      <span>📞</span>
                      <span>استمر مع نولكس</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Related Documents */}
              {searchResult.documents.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📄</span>
                    <span>الوثائق ذات الصلة</span>
                  </h3>
                  <div className="space-y-3">
                    {searchResult.documents.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        className="bg-white rounded-xl p-4 hover:shadow-md transition-all cursor-pointer border-r-4"
                        style={{ borderRightColor: doc.category?.color || '#6B7280' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-800">{doc.title_ar}</h4>
                            <p className="text-sm text-gray-500">
                              {doc.authority?.name_ar} | {formatDate(doc.issue_date)}
                            </p>
                          </div>
                          <span className="text-2xl">{doc.category?.icon || '📄'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Default View (when no search) */}
          {!searchResult && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Popular */}
              <div className="bg-white rounded-2xl p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🔥</span>
                  <span>الأكثر بحثاً</span>
                </h3>
                {popularDocs.length > 0 ? (
                  <div className="space-y-3">
                    {popularDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
                      >
                        <span className="text-xl">{doc.category?.icon || '📄'}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">{doc.title_ar}</p>
                          <p className="text-xs text-gray-400">{doc.authority?.name_ar}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <span className="text-4xl block mb-2">📭</span>
                    <p>لا توجد وثائق بعد</p>
                  </div>
                )}
              </div>

              {/* Recent */}
              <div className="bg-white rounded-2xl p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📅</span>
                  <span>المضاف حديثاً</span>
                </h3>
                {recentDocs.length > 0 ? (
                  <div className="space-y-3">
                    {recentDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        className="p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors flex items-center gap-3"
                      >
                        <span className="text-xl">{doc.category?.icon || '📄'}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 text-sm">{doc.title_ar}</p>
                          <p className="text-xs text-gray-400">{formatDate(doc.issue_date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <span className="text-4xl block mb-2">📭</span>
                    <p>لا توجد وثائق بعد</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </main>

      {/* Document Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div 
              className="p-5 text-white"
              style={{ backgroundColor: selectedDocument.category?.color || '#3B82F6' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedDocument.category?.icon || '📄'}</span>
                  <div>
                    <h3 className="font-bold text-xl">{selectedDocument.title_ar}</h3>
                    <p className="text-sm opacity-90">{selectedDocument.category?.name_ar}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">الجهة المصدرة</p>
                  <p className="font-medium">{selectedDocument.authority?.name_ar || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">تاريخ الإصدار</p>
                  <p className="font-medium">{formatDate(selectedDocument.issue_date)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">رقم الوثيقة</p>
                  <p className="font-medium">{selectedDocument.document_number || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400">نوع الوثيقة</p>
                  <p className="font-medium">{selectedDocument.doc_type || '-'}</p>
                </div>
              </div>

              {selectedDocument.description_ar && (
                <div className="mb-6">
                  <p className="text-xs text-gray-400 mb-2">الوصف</p>
                  <p className="text-gray-700">{selectedDocument.description_ar}</p>
                </div>
              )}

              <div className="bg-amber-50 rounded-lg p-4 text-amber-800 text-sm">
                <p>📌 محتوى الوثيقة متاح للبحث والاستعلام عبر NOLEX.</p>
                <p className="mt-1">يمكنك طرح سؤال محدد للحصول على المعلومات المطلوبة.</p>
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowDocumentModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300"
              >
                إغلاق
              </button>
              <button
                onClick={() => downloadDocument(selectedDocument)}
                className="flex-1 bg-primary-600 text-white py-3 rounded-xl hover:bg-primary-700 flex items-center justify-center gap-2"
              >
                <span>📥</span>
                <span>طلب تحميل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Packages Modal */}
      {showQuotaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-primary-600 to-blue-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">🛒 باقات البحث</h3>
                  <p className="text-sm opacity-90">اختر الباقة المناسبة لك</p>
                </div>
                <button
                  onClick={() => setShowQuotaModal(false)}
                  className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {quotaPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      pkg.code === 'free' 
                        ? 'border-gray-200 bg-gray-50' 
                        : 'border-primary-200 hover:border-primary-400 hover:shadow-md'
                    }`}
                    onClick={() => purchasePackage(pkg)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-800">{pkg.name_ar}</h4>
                        <p className="text-sm text-gray-500">
                          {pkg.searches_limit} عملية بحث
                          {pkg.is_recurring && ' • يتجدد شهرياً'}
                        </p>
                      </div>
                      <div className="text-left">
                        {pkg.price === 0 ? (
                          <span className="text-green-600 font-bold">مجاني</span>
                        ) : (
                          <span className="text-primary-600 font-bold text-lg">
                            {pkg.price} ر.س
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {userQuota && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-500 text-center">
                    رصيدك الحالي: <span className="font-bold text-gray-800">{userQuota.searches_remaining} بحث</span>
                    {userQuota.period_end && (
                      <span> • ينتهي {formatDate(userQuota.period_end)}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
