import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const DAYS = 24 * 60 * 60 * 1000

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// Parse Chinese time string to days-from-birth, or null if unparseable
function parseDaysFromBirth(str: string): number | null {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()

  // --- Specific named milestones ---
  if (s === '满月') return 30
  if (s === '百天' || s === '100天') return 100
  if (s === '周岁' || s === '周岁后') return 365
  if (s === '出生时' || s === '出生后24h') return 0

  // --- "出生后{N}天" ---
  let m = s.match(/^出生后(\d+)天$/)
  if (m) return parseInt(m[1], 10)

  // --- "出生后{N小时}-{M}天" ---
  m = s.match(/^出生后(\d+)小时[-~](\d+)天$/)
  if (m) return parseInt(m[2], 10)

  // --- "出生后{N}-{M}天" ---
  m = s.match(/^出生后(\d+)[-~](\d+)天$/)
  if (m) return parseInt(m[2], 10)

  // --- "出生后{N}h-{M}月" ---
  m = s.match(/^出生后(\d+)h[-~](\d+)月$/)
  if (m) return parseInt(m[2], 10) * 30

  // --- "出生后{N}周内" ---
  m = s.match(/^出生后(\d+)周内$/)
  if (m) return parseInt(m[1], 10) * 7

  // --- "出生后24小时内" ---
  if (s === '出生后24小时内') return 1

  // --- "出牙后" ---
  if (s === '出牙后') return 180

  // --- "{N}月龄" (exact month) ---
  m = s.match(/^(\d+)月龄$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "约{N}月龄" ---
  m = s.match(/^约(\d+)月龄$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "{N}月龄左右" ---
  m = s.match(/^(\d+)月龄左右$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "{N}月龄前" ---
  m = s.match(/^(\d+)月龄前$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "半岁" ---
  if (s === '半岁') return 180

  // --- "{N}-{M}月龄" ---
  m = s.match(/^(\d+)[-~](\d+)月龄$/)
  if (m) return parseInt(m[2], 10) * 30

  // --- "{N}-{M}月" (month range, common in `time` fields) ---
  m = s.match(/^(\d+)[-~](\d+)月$/)
  if (m) return parseInt(m[2], 10) * 30

  // --- "约{M}月" ---
  m = s.match(/^约(\d+)月$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "{N}月左右" ---
  m = s.match(/^(\d+)月左右$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "{M}月" (just a number + 月, non-range) ---
  m = s.match(/^(\d+)月$/)
  if (m) {
    const val = parseInt(m[1], 10)
    if (val <= 36) return val * 30
  }

  // --- "{N}月龄起每年" → first occurrence at N months ---
  m = s.match(/^(\d+)月龄起每年$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- "{N}月龄起" ---
  m = s.match(/^(\d+)月龄起$/)
  if (m) return parseInt(m[1], 10) * 30

  // --- Year-based: "{N}周岁" ---
  m = s.match(/^(\d+)周岁$/)
  if (m) return parseInt(m[1], 10) * 365

  // --- "{N}岁左右" ---
  m = s.match(/^(\d+)岁左右$/)
  if (m) return parseInt(m[1], 10) * 365

  // --- "{N}-{M}岁" ---
  m = s.match(/^(\d+)[-~](\d+)岁$/)
  if (m) return parseInt(m[2], 10) * 365

  // --- "2.5-3岁" ---
  m = s.match(/^([\d.]+)[-~]([\d.]+)岁$/)
  if (m) return Math.ceil(parseFloat(m[2]) * 365)

  // --- "{M}岁" (non-range) ---
  m = s.match(/^(\d+)岁$/)
  if (m) return parseInt(m[1], 10) * 365

  // Cyclic / ongoing → no fixed deadline
  const cyclicPatterns = [
    '持续', '每日', '每周', '日常', '持续培养', '持续引导', '持续练习', '持续积累',
    '每天', '每学期', '学期', '假期', '酌情', '适时', '逐步',
    '入园', '小班', '中班', '大班', '一上', '一下', '二上', '二下',
    '三上', '三下', '四上', '四下', '入学', '毕业', '暑假', '每年秋季',
  ]
  if (cyclicPatterns.some(p => s.includes(p))) return null

  // --- "{N}月龄左右" --- already handled above

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const birthTimeStr = Deno.env.get('BABY_BIRTH_TIME')
  if (!birthTimeStr) {
    return new Response(JSON.stringify({ error: 'BABY_BIRTH_TIME not configured' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const birthDate = new Date(birthTimeStr)
  if (isNaN(birthDate.getTime())) {
    return new Response(JSON.stringify({ error: 'Invalid BABY_BIRTH_TIME format' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const { milestones, checkedItems } = body
  if (!Array.isArray(milestones)) {
    return new Response(JSON.stringify({ error: 'milestones array is required' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const checkedSet = new Set<string>(Array.isArray(checkedItems) ? checkedItems : [])
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const result: Record<string, string> = {}

  for (const ms of milestones) {
    const id = ms.id
    if (!id) continue

    const timeStr = ms.time || ''
    const suggestedStr = ms.suggestedTime || ''

    const timeDays = parseDaysFromBirth(timeStr)
    const suggestedDays = parseDaysFromBirth(suggestedStr)

    let deadlineDays: number | null = null
    if (timeDays !== null && suggestedDays !== null) {
      deadlineDays = Math.min(timeDays, suggestedDays)
    } else if (timeDays !== null) {
      deadlineDays = timeDays
    } else if (suggestedDays !== null) {
      deadlineDays = suggestedDays
    }

    if (deadlineDays === null) {
      // Unparseable — no special coloring
      result[id] = 'normal'
      continue
    }

    const deadlineDate = new Date(birthDate.getTime() + deadlineDays * DAYS)
    const deadlineDay = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
    const diffDays = Math.floor((deadlineDay.getTime() - today.getTime()) / DAYS)

    if (checkedSet.has(id)) {
      result[id] = 'checked'
    } else if (diffDays < 0) {
      result[id] = 'expired'
    } else if (diffDays <= 10) {
      result[id] = 'expiring'
    } else {
      result[id] = 'normal'
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
})
