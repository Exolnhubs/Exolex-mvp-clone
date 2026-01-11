import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body
    
    if (!code) {
      return NextResponse.json({ error: 'Missing referral code' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get device info
    const userAgent = request.headers.get('user-agent') || ''
    const ip = request.headers.get('x-forwarded-for') || ''
    
    const deviceType = /Mobile|Android|iPhone/i.test(userAgent) ? 'mobile' : 
                       /Tablet|iPad/i.test(userAgent) ? 'tablet' : 'desktop'
    
    const browser = /Chrome/i.test(userAgent) && !/Edge/i.test(userAgent) ? 'Chrome' :
                    /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent) ? 'Safari' :
                    /Firefox/i.test(userAgent) ? 'Firefox' : 'Other'
    
    const os = /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS' :
               /Android/i.test(userAgent) ? 'Android' :
               /Windows/i.test(userAgent) ? 'Windows' :
               /Mac/i.test(userAgent) ? 'macOS' : 'Other'
    
    // Record click
    const { data, error } = await supabase.from('referral_clicks').insert({
      referral_code: code,
      visitor_ip: ip,
      user_agent: userAgent,
      device_type: deviceType,
      browser: browser,
      os: os
    }).select().single()
    
    if (error) {
      console.error('Error recording click:', error)
      return NextResponse.json({ success: true, note: 'Click not recorded' })
    }
    
    return NextResponse.json({ success: true, click_id: data?.id })
    
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
