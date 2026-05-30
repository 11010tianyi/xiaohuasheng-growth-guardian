# 日记功能 - 未来方案：不加密 + 家人共享

## 当前方案

当前使用 AES-256-GCM 客户端加密，每用户 PIN 派生不同密钥。
优点：服务器无法阅读日记内容。
缺点：家人无法互相阅读日记（PIN 不同 → 密钥不同 → 无法解密）。

## 未来方案：不加密 + 家人共享

若未来需要家人共享日记，切换为以下方案：

### 1. 数据库改动

```sql
-- 删除旧表
DROP TABLE IF EXISTS user_salts;

-- 重建 diary_entries 表（去掉加密列，改为明文 content）
DROP TABLE IF EXISTS diary_entries;
CREATE TABLE diary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  content TEXT,                    -- 明文文字（不再加密）
  photo_paths TEXT[],
  entry_date DATE NOT NULL,
  mood TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 不变：禁止匿名直接访问
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diary_no_anon" ON diary_entries FOR ALL TO anon USING (false);
```

### 2. RPC 函数改动

```sql
-- 删除 get_or_create_salt 函数（不再需要）
DROP FUNCTION IF EXISTS get_or_create_salt(TEXT, TEXT);

-- 重建 create_diary_entry（去掉加密参数）
CREATE OR REPLACE FUNCTION create_diary_entry(
  p_phone TEXT, p_pin_hash TEXT,
  p_content TEXT,                 -- 明文内容
  p_photo_paths TEXT[],
  p_entry_date DATE,
  p_mood TEXT, p_tags TEXT[]
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
  -- 验证用户 → 插入 diary_entries
$$;

-- get_diary_entries：去掉 phone 过滤，所有登录用户可见全部日记
CREATE OR REPLACE FUNCTION get_diary_entries(
  p_phone TEXT, p_pin_hash TEXT,  -- 仍需验证身份
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stored_pin TEXT;
  v_result JSON;
BEGIN
  -- 只验证用户身份，不过滤 phone
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  -- 返回所有日记（不按 phone 过滤）
  SELECT json_agg(row_to_json(d)) INTO v_result
  FROM (
    SELECT id, phone, content, photo_paths, entry_date, mood, tags, created_at, updated_at
    FROM diary_entries
    ORDER BY entry_date DESC, created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) d;

  RETURN json_build_object(
    'success', true,
    'entries', COALESCE(v_result, '[]'::json)
  );
END;
$$;
```

### 3. 前端代码改动

**diary.js：**
- 删除 `encryptContent()` / `decryptContent()` 函数
- `saveEntry()` 直接传明文 content
- `loadEntries()` 直接读取明文 content，不再解密
- 删除 key prompt 相关代码

**supabase-sync.js：**
- 删除 `deriveEncryptionKey()` / `initEncryptionKey()` / `getEncryptionKey()` / `hasEncryptionKey()` / `rederiveEncryptionKey()`
- 删除 `_encryptionKey` / `_rawPin` 变量
- `saveSession()` 不再存储 `rawPin`
- `supabaseLogin()` 不再调用 `initEncryptionKey()`

**diary.html：**
- 初始化不再需要等待加密密钥
- 直接 `initDiary()` 即可

### 4. 隐私保护级别

与里程碑打卡同级：
- RLS 禁止匿名读取
- 必须登录才能访问
- RPC 函数验证 PIN 身份
- Supabase 管理员可看明文（与 milestone_checks 一致）
