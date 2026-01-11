# 📚 ExoLex - الدليل التقني المرجعي
## Technical Reference Guide v1.0
### تاريخ الإنشاء: 5 يناير 2026

---

# 📑 فهرس المحتويات

1. [حقول الربط والتحقق](#1-حقول-الربط-والتحقق)
2. [سياسات RLS والتعديلات](#2-سياسات-rls-والتعديلات)
3. [الإصلاحات المُنفذة](#3-الإصلاحات-المُنفذة)
4. [توزيع الطلبات](#4-توزيع-الطلبات)
5. [أنماط الكود الموحدة](#5-أنماط-الكود-الموحدة)
6. [استكشاف الأخطاء](#6-استكشاف-الأخطاء)

---

# 1. حقول الربط والتحقق

## 1.1 المشتركين (Subscribers)

### سلسلة الربط الصحيحة:
```
localStorage(exolex_user_id) → users.id → members.user_id → members.id → subscriptions.member_id
```

| الجدول | الحقل الأساسي | الربط مع | ملاحظات |
|--------|---------------|----------|---------|
| `users` | `id` (UUID) | - | المعرف الرئيسي للمستخدم |
| `members` | `id` (UUID) | - | المعرف الرئيسي للعضوية |
| `members` | `user_id` | `users.id` | ربط العضوية بالمستخدم |
| `members` | `member_code` | - | `SUB-XXXXXXXX` (للعرض فقط) |
| `subscriptions` | `member_id` | `members.id` | ⚠️ **ليس user_id** |
| `service_requests` | `member_id` | `members.id` | ⚠️ **ليس user_id** |

### ⚠️ تحذير مهم:
```
❌ خطأ: subscriptions.user_id أو service_requests.user_id
✅ صحيح: subscriptions.member_id و service_requests.member_id
```

---

## 1.2 المحامين (Lawyers)

| الجدول | الحقل | الوصف | القيم المتاحة |
|--------|-------|-------|---------------|
| `lawyers` | `id` | المعرف الفريد | UUID |
| `lawyers` | `lawyer_type` | نوع المحامي | `independent` / `legal_arm` |
| `lawyers` | `legal_arm_id` | الذراع القانوني | UUID أو `null` |
| `lawyers` | `status` | الحالة العامة | `active` / `inactive` / `suspended` |
| `lawyers` | `is_available` | متاح للطلبات الجديدة | `true` / `false` |
| `lawyers` | `admin_approval_status` | موافقة الإدارة | `approved` / `pending` / `rejected` |
| `lawyers` | `active_requests_count` | عدد الطلبات الحالية | رقم |

### التحقق من محامي نشط ويستقبل طلبات:
```sql
SELECT * FROM lawyers 
WHERE status = 'active' 
  AND is_available = true 
  AND admin_approval_status = 'approved';
```

---

## 1.3 الذراع القانوني (Legal Arms)

| الجدول | الحقل | الربط مع | ملاحظات |
|--------|-------|----------|---------|
| `legal_arms` | `id` | - | المعرف الفريد |
| `legal_arms` | `status` | - | `active` / `inactive` |
| `lawyers` | `legal_arm_id` | `legal_arms.id` | محامي الذراع |
| `lawyers` | `lawyer_type` | - | يجب أن يكون `legal_arm` |

### جلب محامي الذراع النشطين:
```sql
SELECT * FROM lawyers 
WHERE lawyer_type = 'legal_arm'
  AND legal_arm_id = '[ARM_UUID]'
  AND status = 'active'
  AND is_available = true;
```

---

## 1.4 الشركاء (Partners)

| الجدول | الحقل | الوصف | القيم |
|--------|-------|-------|-------|
| `partners` | `id` | المعرف الفريد | UUID |
| `partners` | `status` | الحالة | `active` / `inactive` / `suspended` |
| `partners` | `receive_exolex_requests` | يستقبل طلبات من المنصة | `true` / `false` |
| `partner_employees` | `id` | معرف الموظف | UUID |
| `partner_employees` | `partner_id` | الشريك | `partners.id` |
| `partner_employees` | `can_receive_platform_requests` | يستقبل طلبات | `true` / `false` |
| `partner_employees` | `status` | الحالة | `active` / `inactive` |

### التحقق من شريك نشط يستقبل طلبات:
```sql
SELECT * FROM partners 
WHERE status = 'active' 
  AND receive_exolex_requests = true;
```

---

## 1.5 طلبات الخدمة (Service Requests)

| الحقل | الربط مع | الوصف |
|-------|----------|-------|
| `member_id` | `members.id` | ⚠️ المشترك (ليس user_id) |
| `ticket_number` | - | `SVC-YY-XXXXXX` (للعرض) |
| `assigned_lawyer_id` | `lawyers.id` | محامي مستقل أو ذراع |
| `assigned_partner_id` | `partners.id` | الشريك |
| `assigned_partner_employee_id` | `partner_employees.id` | موظف الشريك |
| `handler_type` | - | `legal_arm` / `partner` / `independent` |
| `source` | - | `package` / `extra_services_page` / `nolex` |

---

## 1.6 localStorage Keys

| البوابة | المفتاح | الجدول | الحقل |
|---------|---------|--------|-------|
| المشترك | `exolex_user_id` | `users` | `id` |
| المحامي المستقل | `exolex_lawyer_id` | `lawyers` | `id` |
| الذراع القانوني | `exolex_arm_id` | `legal_arms` | `id` |
| الشريك | `exolex_partner_id` | `partners` | `id` |
| موظف الشريك | `exolex_employee_id` | `partner_employees` | `id` |
| الأدمن | `exolex_admin_id` | `admin_users` | `id` |

---

## 1.7 رسم توضيحي للربط

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           سلسلة الربط الصحيحة                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  localStorage          users            members          subscriptions      │
│  ┌────────────┐      ┌────────┐       ┌──────────┐     ┌─────────────┐     │
│  │ exolex_    │      │   id   │───────│ user_id  │     │  member_id  │     │
│  │ user_id    │──────│        │       │    id    │─────│             │     │
│  └────────────┘      └────────┘       └──────────┘     └─────────────┘     │
│                                             │                               │
│                                             │          service_requests     │
│                                             │         ┌─────────────┐       │
│                                             └─────────│  member_id  │       │
│                                                       └─────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 2. سياسات RLS والتعديلات

## 2.1 الجداول التي تم تعطيل RLS عليها (للاختبار)

| الجدول | الأمر المُنفذ | السبب | التاريخ |
|--------|--------------|-------|---------|
| `subscriptions` | `ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;` | خطأ 406 عند جلب الاشتراك | 5 يناير 2026 |
| `users` | `ALTER TABLE users DISABLE ROW LEVEL SECURITY;` | خطأ عند التسجيل | 5 يناير 2026 |
| `members` | `ALTER TABLE members DISABLE ROW LEVEL SECURITY;` | خطأ عند جلب العضوية | 5 يناير 2026 |
| `service_requests` | `ALTER TABLE service_requests DISABLE ROW LEVEL SECURITY;` | خطأ عند جلب الطلبات | 5 يناير 2026 |

## 2.2 سياسات RLS التي تم إضافتها

```sql
-- سياسة قراءة الاشتراكات
CREATE POLICY "Allow read subscriptions" ON subscriptions
FOR SELECT USING (true);
```

## 2.3 ⚠️ ملاحظة مهمة للإنتاج

قبل الإطلاق، يجب:
1. إعادة تفعيل RLS على جميع الجداول
2. إنشاء سياسات أمان صحيحة تعتمد على `auth.uid()`
3. اختبار كل سياسة بشكل منفصل

### أوامر إعادة تفعيل RLS:
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
```

### نموذج سياسة آمنة للإنتاج:
```sql
-- سياسة: المشترك يرى اشتراكاته فقط
CREATE POLICY "Users can view own subscriptions" ON subscriptions
FOR SELECT USING (
  member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  )
);
```

---

# 3. الإصلاحات المُنفذة

## 3.1 إصلاح ترقيم المشتركين

### المشكلة:
- الـ trigger `auto_trial_subscription` كان يُنشئ `MBR-xxxxx` يدوياً
- بدلاً من ترك trigger `generate_member_code` يعمل

### الحل:
```sql
CREATE OR REPLACE FUNCTION auto_trial_subscription()
RETURNS TRIGGER AS $$
DECLARE
  new_member_id UUID;
BEGIN
  -- إدخال بدون member_code ليعمل الـ trigger تلقائياً
  INSERT INTO members (user_id)
  VALUES (NEW.id)
  RETURNING id INTO new_member_id;
  
  INSERT INTO subscriptions (...)
  -- باقي الكود
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### النتيجة:
- ✅ الترقيم الجديد: `SUB-00000001`, `SUB-00000002`, ...

---

## 3.2 إصلاح جلب الاشتراك في صفحات المشترك

### المشكلة:
- الصفحات كانت تستخدم `.eq('user_id', userId)` في جدول `subscriptions`
- لكن الجدول لا يحتوي على `user_id`، بل `member_id`

### الملفات المُصلحة (11 ملف):

| الملف | السطر | قبل | بعد |
|-------|-------|-----|-----|
| `profile/page.tsx` | ~139 | `user_id` | `member_id` |
| `dashboard/page.tsx` | ~100 | `user_id` | `member_id` |
| `settings/page.tsx` | ~107 | `user_id` | `member_id` |
| `affiliate/page.tsx` | ~137 | `user_id` | `member_id` |
| `subscription/page.tsx` | ~112 | `user_id` | `member_id` |
| `calendar/page.tsx` | ~74 | `user_id` | `member_id` |
| `extra-services/page.tsx` | ~91 | `user_id` | `member_id` |
| `inbox/page.tsx` | ~108 | `user_id` | `member_id` |
| `library/page.tsx` | ~112 | `user_id` | `member_id` |
| `nolex/page.tsx` | ~51 | `user_id` | `member_id` |
| `requests/page.tsx` | ~97 | `user_id` | `member_id` |

### نمط الإصلاح:
```typescript
// ❌ قبل (خطأ)
const { data: subData } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', userId)  // ❌
  .eq('status', 'active')
  .single()

// ✅ بعد (صحيح)
// 1. جلب member أولاً
const { data: memberData } = await supabase
  .from('members')
  .select('id')
  .eq('user_id', userId)
  .single()

// 2. ثم جلب الاشتراك
const { data: subData } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('member_id', memberData?.id)  // ✅
  .eq('status', 'active')
  .single()
```

---

## 3.3 إضافة تفعيل الاشتراك المجاني (للاختبار)

### الـ Function:
```sql
CREATE OR REPLACE FUNCTION activate_subscription_free(
  p_user_id UUID,
  p_package_name VARCHAR(20)
)
RETURNS UUID 
SECURITY DEFINER  -- يتجاوز RLS
AS $$
DECLARE
  v_member_id UUID;
  v_package_id UUID;
  v_subscription_id UUID;
  v_consultations INTEGER;
  v_cases INTEGER;
  v_library INTEGER;
BEGIN
  -- جلب member_id
  SELECT id INTO v_member_id FROM members WHERE user_id = p_user_id;
  
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  
  -- تحديد مزايا الباقة و package_id
  CASE LOWER(p_package_name)
    WHEN 'exo' THEN 
      v_package_id := 'dbf39728-5b12-4b42-b107-359246e225d3';
      v_consultations := 3; v_cases := 1; v_library := 30;
    WHEN 'plus' THEN 
      v_package_id := '58219686-4aa5-472d-b328-066539d55efa';
      v_consultations := 6; v_cases := 2; v_library := 60;
    WHEN 'pro' THEN 
      v_package_id := 'f563c1e1-65bf-41c1-b82f-12a545bd3f4f';
      v_consultations := 10; v_cases := 3; v_library := 100;
    ELSE RAISE EXCEPTION 'Invalid package name';
  END CASE;
  
  -- إلغاء الاشتراكات السابقة
  UPDATE subscriptions 
  SET status = 'cancelled', updated_at = NOW()
  WHERE member_id = v_member_id AND status = 'active';
  
  -- إنشاء اشتراك جديد (سنة كاملة)
  INSERT INTO subscriptions (
    member_id, package_id, start_date, end_date, status,
    consultations_remaining, cases_remaining, library_searches_remaining, amount_paid
  ) VALUES (
    v_member_id, v_package_id, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year',
    'active', v_consultations, v_cases, v_library, 0
  )
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;
```

### الاستخدام في الكود:
```typescript
const { error } = await supabase.rpc('activate_subscription_free', {
  p_user_id: userId,
  p_package_name: packageId  // 'exo' | 'plus' | 'pro'
})
```

---

# 4. توزيع الطلبات

## 4.1 أنواع مقدمي الخدمة

| النوع | الجدول | يستقبل طلبات الباقات | يستقبل الخدمات الإضافية |
|-------|--------|---------------------|------------------------|
| الذراع القانوني | `lawyers` (lawyer_type='legal_arm') | ✅ نعم (أولوية) | ✅ نعم |
| الشريك | `partners` + `partner_employees` | ⚠️ الإضافية فقط | ✅ نعم |
| المحامي المستقل | `lawyers` (lawyer_type='independent') | ❌ لا | ✅ نعم |

## 4.2 مسار توزيع الطلبات

```
┌─────────────────────────────────────────────────────────────┐
│                    طلب جديد من المشترك                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │         نوع الطلب؟            │
              └───────────────────────────────┘
                   │              │              │
        ┌──────────┘              │              └──────────┐
        ▼                         ▼                         ▼
   ┌─────────┐            ┌─────────────┐           ┌─────────────┐
   │ استشارة │            │   قضية     │           │خدمة إضافية  │
   │ (باقة)  │            │  (باقة)    │           │ (مدفوعة)    │
   └─────────┘            └─────────────┘           └─────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   ┌─────────┐            ┌─────────────┐           ┌─────────────┐
   │ الذراع  │            │   الذراع   │           │  الشريك    │
   │القانوني│            │  القانوني  │           │ أو المستقل │
   │ (فقط)  │            │   (فقط)    │           │   أولاً    │
   └─────────┘            └─────────────┘           └─────────────┘
```

## 4.3 حقول تحديد المُعالج في service_requests

| الحقل | الوصف | القيم |
|-------|-------|-------|
| `handler_type` | نوع المعالج | `legal_arm` / `partner` / `independent` |
| `assigned_lawyer_id` | معرف المحامي | UUID (للذراع والمستقل) |
| `assigned_partner_id` | معرف الشريك | UUID (للشريك) |
| `assigned_partner_employee_id` | معرف موظف الشريك | UUID |
| `source` | مصدر الطلب | `package` / `extra_services_page` / `nolex` |

## 4.4 خوارزمية التوزيع

### للطلبات المشمولة بالباقة (استشارات/قضايا):
```typescript
async function distributePackageRequest(request: ServiceRequest) {
  // 1. البحث في الذراع القانوني أولاً
  const armLawyers = await supabase
    .from('lawyers')
    .select('*')
    .eq('lawyer_type', 'legal_arm')
    .eq('status', 'active')
    .eq('is_available', true)
    .eq('admin_approval_status', 'approved')
    .order('active_requests_count', { ascending: true })
    .limit(1)
  
  if (armLawyers.data?.length > 0) {
    // تعيين للذراع القانوني
    await assignToLawyer(request.id, armLawyers.data[0].id, 'legal_arm')
    return
  }
  
  // 2. إذا لم يتوفر الذراع، يبقى في قائمة الانتظار
  // ❌ لا يذهب للشريك أو المستقل
}
```

### للخدمات الإضافية (المدفوعة):
```typescript
async function distributeExtraService(request: ServiceRequest) {
  // 1. البحث في الشركاء أولاً
  const partners = await supabase
    .from('partners')
    .select('*, partner_employees(*)')
    .eq('status', 'active')
    .eq('receive_exolex_requests', true)
  
  if (partners.data?.length > 0) {
    // تعيين للشريك
    await assignToPartner(request.id, partners.data[0].id)
    return
  }
  
  // 2. البحث في المحامين المستقلين
  const independentLawyers = await supabase
    .from('lawyers')
    .select('*')
    .eq('lawyer_type', 'independent')
    .eq('status', 'active')
    .eq('is_available', true)
    .eq('admin_approval_status', 'approved')
  
  if (independentLawyers.data?.length > 0) {
    await assignToLawyer(request.id, independentLawyers.data[0].id, 'independent')
  }
}
```

## 4.5 حالات الطلب (Status Flow)

```
┌──────────┐    ┌────────────────────┐    ┌──────────┐    ┌───────────┐
│   new    │───▶│ pending_assignment │───▶│ assigned │───▶│ in_progress│
└──────────┘    └────────────────────┘    └──────────┘    └───────────┘
                                                                │
                         ┌──────────────────────────────────────┤
                         │                                      │
                         ▼                                      ▼
                   ┌───────────┐                         ┌───────────┐
                   │ completed │                         │ cancelled │
                   └───────────┘                         └───────────┘
```

| الحالة | الوصف |
|--------|-------|
| `new` | طلب جديد |
| `pending_assignment` | بانتظار التعيين |
| `assigned` | تم التعيين لمحامي/شريك |
| `in_progress` | قيد التنفيذ |
| `completed` | مكتمل |
| `cancelled` | ملغي |

---

# 5. أنماط الكود الموحدة

## 5.1 نمط موحد لصفحات المشترك

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SubscriberPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userId = localStorage.getItem('exolex_user_id')
    
    if (!userId) {
      router.push('/auth/login')
      return
    }

    const fetchData = async () => {
      // 1️⃣ جلب المستخدم
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (userData) setUser(userData)
      
      // 2️⃣ جلب العضوية (member) - مهم جداً!
      const { data: memberData } = await supabase
        .from('members')
        .select('id, member_code')
        .eq('user_id', userId)
        .single()
      
      if (memberData) {
        // 3️⃣ جلب الاشتراك باستخدام member_id
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*, packages(*)')
          .eq('member_id', memberData.id)  // ✅ member_id وليس user_id
          .eq('status', 'active')
          .single()
        
        if (subData) {
          setIsSubscribed(true)
          setSubscription(subData)
        }
        
        // 4️⃣ جلب الطلبات
        const { data: requests } = await supabase
          .from('service_requests')
          .select('*')
          .eq('member_id', memberData.id)  // ✅ member_id
          .order('created_at', { ascending: false })
      }
      
      setIsLoading(false)
    }

    fetchData()
  }, [router])

  // ... باقي الكود
}
```

## 5.2 نمط موحد للتحقق من المحامي

```typescript
async function checkLawyerAvailability(lawyerId: string) {
  const { data: lawyer } = await supabase
    .from('lawyers')
    .select('*')
    .eq('id', lawyerId)
    .eq('status', 'active')
    .eq('is_available', true)
    .eq('admin_approval_status', 'approved')
    .single()
  
  return lawyer !== null
}
```

## 5.3 نمط موحد لتعيين الطلب

```typescript
async function assignRequest(
  requestId: string,
  handlerType: 'legal_arm' | 'partner' | 'independent',
  handlerId: string,
  employeeId?: string
) {
  const updateData: any = {
    handler_type: handlerType,
    status: 'assigned',
    assigned_at: new Date().toISOString()
  }
  
  if (handlerType === 'partner') {
    updateData.assigned_partner_id = handlerId
    updateData.assigned_partner_employee_id = employeeId
  } else {
    updateData.assigned_lawyer_id = handlerId
  }
  
  await supabase
    .from('service_requests')
    .update(updateData)
    .eq('id', requestId)
}
```

---

# 6. استكشاف الأخطاء

## 6.1 أخطاء شائعة وحلولها

### خطأ 406 (Not Acceptable)
**السبب:** RLS يمنع الوصول
**الحل:**
```sql
-- للاختبار فقط
ALTER TABLE [table_name] DISABLE ROW LEVEL SECURITY;

-- أو إضافة policy
CREATE POLICY "Allow read" ON [table_name] FOR SELECT USING (true);
```

### خطأ 401 (Unauthorized)
**السبب:** API key غير صحيح أو منتهي
**الحل:** تحقق من `.env.local`

### خطأ 400 (Bad Request)
**السبب:** بيانات غير صحيحة أو أعمدة غير موجودة
**الحل:** تحقق من schema الجدول

### الاشتراك لا يظهر
**السبب:** استخدام `user_id` بدل `member_id`
**الحل:** راجع قسم 3.2

### ترقيم خاطئ (MBR- بدل SUB-)
**السبب:** trigger قديم
**الحل:** راجع قسم 3.1

## 6.2 أوامر تصحيح مفيدة

### التحقق من سلسلة الربط:
```sql
SELECT 
  u.id as user_id,
  u.full_name,
  m.id as member_id,
  m.member_code,
  s.id as subscription_id,
  s.status,
  p.name_ar as package_name
FROM users u
LEFT JOIN members m ON m.user_id = u.id
LEFT JOIN subscriptions s ON s.member_id = m.id
LEFT JOIN packages p ON p.id = s.package_id
WHERE u.id = '[USER_UUID]';
```

### التحقق من RLS:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'members', 'subscriptions', 'service_requests');
```

### عرض policies:
```sql
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

---

# 📝 سجل التحديثات

| التاريخ | التغيير | المسؤول |
|---------|---------|---------|
| 5 يناير 2026 | إنشاء الدليل | Claude + Jassi |
| 5 يناير 2026 | إصلاح member_id في 11 صفحة | Claude |
| 5 يناير 2026 | تعطيل RLS للاختبار | Claude |
| 5 يناير 2026 | إضافة function التفعيل المجاني | Claude |

---

**نهاية الدليل - الإصدار 1.0**
