# Milestone Time Parsing Rules

## Overview
Both `time` (alarm) and `suggestedTime` (calendar) fields in `milestones-data.js` contain descriptive Chinese strings that need to be parsed into day offsets from birth date. The earlier deadline between the two is used for status judgment.

## Parsing Logic

### 1. Month-based (most common)
| Pattern | Example | Upper Bound (days) |
|---------|---------|-------------------|
| `{N}月龄` | "6月龄" | N × 30 |
| `{N}-{M}月龄` | "12-15月龄" | M × 30 |
| `{N}-{M}月` | "4-6月" | M × 30 |
| `约{M}月龄` | "约6月龄" | M × 30 |
| `{M}月龄左右` | "8月龄左右" | M × 30 |
| `{N}-{M}月` | "4-5月" | M × 30 |
| `{M}月龄起` | "6月龄起" | M × 30 |
| `{M}月` | "6月" (ambiguous) | M × 30 |

### 2. Year-based
| Pattern | Example | Upper Bound (days) |
|---------|---------|-------------------|
| `{N}周岁` | "3周岁" | N × 365 |
| `{N}岁左右` | "3岁左右" | N × 365 |
| `{N}-{M}岁` | "2.5-3岁" | M × 365 |
| `周岁` | "周岁" | 365 |
| `周岁后` | "周岁后" | 365 |

### 3. Specific day offsets from birth
| Pattern | Example | Upper Bound (days) |
|---------|---------|-------------------|
| `出生后{N}天` | "出生后42天" | N |
| `出生后{N小时}-{M}天` | "出生后72小时-7天" | M |
| `出生后{N}-{M}天` | "出生后3-5天" | M |
| `出生后{N}h` | "出生后24h" | 1 (ceil 24h to 1 day) |
| `出生后{N}h-{M}月` | "出生后24h-1月" | 30 |
| `出生后{N}周内` | "出生后1周内" | N × 7 |
| `出生时` | "出生时" | 0 |
| `出生后24小时内` | "出生后24小时内" | 1 |

### 4. Named milestones
| Pattern | Upper Bound (days) |
|---------|-------------------|
| `满月` | 30 |
| `百天` / `100天` | 100 |
| `半岁` | 180 |
| `周岁` | 365 |
| `出牙后` | 180 (approximate: ~6 months) |

### 5. Periodic / Cyclic (open-ended)
These indicate ongoing activities with no fixed deadline. Fall back to `time` field; if both are cyclic, mark as "normal" (no deadline pressure).
| Pattern | Behavior |
|---------|----------|
| `持续` | No fixed deadline |
| `每日` / `每日{N}分钟` / `每日{activity}` | Ongoing, no deadline |
| `每周{N}次` / `每周{N}篇` | Ongoing, no deadline |
| `每学期` / `学期{type}` | Ongoing, no deadline |
| `日常` / `日常{activity}` | Ongoing, no deadline |
| `持续{activity}` | Ongoing, no deadline |
| `适当` / `酌情` / `适时` | Vague, no deadline |

### 6. School calendar based
Varies by child's actual school start date. Unparseable without school calendar — treated as "no deadline".
| Pattern | Behavior |
|---------|----------|
| `入园{time}` | Unparseable |
| `小班/中班/大班{time}` | Unparseable |
| `{年级}{上下}` | Unparseable |
| `学期{time}` | Unparseable |
| `假期` | Unparseable |
| `入学{time}` | Unparseable |

### 7. Ambiguous
| Pattern | Behavior |
|---------|----------|
| `{N}月龄起每年` | Treat first occurrence at N months |
| `{N}月龄前` | N × 30 |
| `{N}月左右` | N × 30 |
| `每年秋季` | Unparseable without year context |

## Status Judgment Algorithm

```
for each milestone:
  deadline = null
  hasSuggested = try parse suggestedTime → days
  hasTime = try parse time → days
  
  if hasSuggested && hasTime:
    deadline = min(suggestedDays, timeDays)
  elif hasSuggested:
    deadline = suggestedDays
  elif hasTime:
    deadline = timeDays
  else:
    // Both unparseable → no special coloring
    continue
  
  deadlineDate = birthDate + deadline days
  
  if milestone is checked:
    status = "checked"
  elif today > deadlineDate:
    status = "expired"
  elif (deadlineDate - today) <= 10 days:
    status = "expiring"
  else:
    status = "normal"

return { id: status }
```

## Edge Function
`get-baby-status` reads `BABY_BIRTH_TIME` from `Deno.env.get()`, receives milestones + checked items from client, computes statuses, returns JSON map.

## Setup & Deployment

### 1. Add `BABY_BIRTH_TIME` Secret
```bash
npx supabase secrets set BABY_BIRTH_TIME="2026-06-01 14:20:32 +08:00"
```

Format: `YYYY-MM-DD HH:mm:ss +08:00` (Beijing time). The server normalizes to UTC internally.

**To change later:** Run the same command with the updated value. The old value is overwritten.

### 2. Deploy the Edge Function
```bash
npx supabase functions deploy get-baby-status --no-verify-jwt
```

The `--no-verify-jwt` flag is needed because this function is called from the browser without an auth token (it only needs the birth time secret).

### 3. Verify
After deployment, the function is available at:
`https://<project-ref>.supabase.co/functions/v1/get-baby-status`

The frontend automatically determines the URL from `SUPABASE_CONFIG.url` in `supabase-config.js`.
