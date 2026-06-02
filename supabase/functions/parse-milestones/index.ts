import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
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

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'DEEPSEEK_API_KEY not configured' }), {
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

  const { transcript, milestones } = body
  if (!transcript || typeof transcript !== 'string') {
    return new Response(JSON.stringify({ error: 'transcript is required' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  if (!Array.isArray(milestones) || milestones.length === 0) {
    return new Response(JSON.stringify({ error: 'milestones list is required' }), {
      status: 400,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }

  const milestoneLines = milestones
    .map((m) => `${m.id}: ${m.title}`)
    .join('\n')

  const isMilestoneMode = body.mode === 'milestone' || true

  const systemPrompt = `你是一个儿童成长记录助手。家长的家长会说出孩子相关的内容，可能是打卡项目，也可能是日常记录、感想、创作请求等。

你的任务：
1. 先从下面的里程碑列表中找出最匹配的项目（如果有）。匹配要灵活——考虑同义词、口语化表达、部分匹配。例如"满月"对应月龄1个月的项目，"打针"对应疫苗项目，"体检"对应健康检查。
2. 无论是否匹配到里程碑，都要分析原文内容用于日记归档。
   - 如果家长有明确的创作需求（写诗、写故事、写打油诗、描述场景等），请用中文完成创作
   - 生成一个亚里士多德式的提问（引导家长和孩子一起深入思考，增进亲子交流）
   - 提炼/总结原文核心内容（2-3句话）
   - 建议1-3个合适的标签，标签要贴合本次日记主题

只返回 JSON 格式，不要任何额外文字：
{
  "matched": [{"id": "...", "title": "..."}],
  "summary": "一句话概括家长说的内容",
  "diary": {
    "summary": "提炼后的内容总结（2-3句话）",
    "creative_response": "如果原文有创作请求，这里放完成的创作内容；否则空字符串",
    "aristotle_question": "亚里士多德式提问",
    "tags": ["标签1", "标签2"]
  }
}

如果没有任何里程碑可以匹配，matched 返回空数组。
如果原文没有创作需求，creative_response 返回空字符串。

里程碑列表：
${milestoneLines}`

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return new Response(JSON.stringify({ error: 'DeepSeek API error', detail: errText }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const resultText = data.choices?.[0]?.message?.content

    if (!resultText) {
      return new Response(JSON.stringify({ error: 'Empty DeepSeek response' }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    let result
    try {
      result = JSON.parse(resultText)
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse DeepSeek response', raw: resultText }), {
        status: 502,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error', detail: err.message }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})
