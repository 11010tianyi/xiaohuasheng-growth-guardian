-- ============================================
-- 小花生成长护航计划 v2 - Supabase 初始化脚本
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 1. 创建用户表
CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 创建里程碑打卡表
CREATE TABLE IF NOT EXISTS milestone_checks (
  milestone_id TEXT PRIMARY KEY,
  checked BOOLEAN DEFAULT false,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_checks ENABLE ROW LEVEL SECURITY;

-- 4. RLS 策略
-- 清理可能存在的旧策略（支持重复运行）
DROP POLICY IF EXISTS "users_read_all" ON users;
DROP POLICY IF EXISTS "users_no_anon_read" ON users;
DROP POLICY IF EXISTS "users_own_read" ON users;
DROP POLICY IF EXISTS "checks_read_all" ON milestone_checks;

-- users 表：禁止匿名读取（包含 pin_hash，绝不能暴露）
-- 注意：本应用不使用 Supabase Auth，所有请求都是 anon 角色
-- RPC 函数(login_user, toggle_milestone)使用 SECURITY DEFINER 绕过 RLS，不受影响
CREATE POLICY "users_no_anon_read" ON users FOR SELECT TO anon USING (false);

-- milestone_checks 表：允许匿名读取（需要加载打勾状态和编辑者信息）
CREATE POLICY "checks_read_all" ON milestone_checks FOR SELECT TO anon USING (true);

-- 5. 登录函数（禁止注册，只允许数据库已有账号登录）
-- 客户端用 SHA-256 对 PIN 做哈希后传入，服务端只存哈希
-- 新增用户需手动在 Supabase SQL Editor 中执行:
--   INSERT INTO users (phone, pin_hash) VALUES ('手机号', 'SHA-256哈希');
CREATE OR REPLACE FUNCTION login_user(p_phone TEXT, p_pin_hash TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_pin TEXT;
  v_phone_masked TEXT;
BEGIN
  -- 验证手机号格式（11位数字）
  IF p_phone !~ '^\d{11}$' THEN
    RETURN json_build_object('success', false, 'message', '手机号格式不正确');
  END IF;

  -- 验证 PIN 哈希非空
  IF p_pin_hash IS NULL OR p_pin_hash = '' THEN
    RETURN json_build_object('success', false, 'message', 'PIN码不能为空');
  END IF;

  -- 检查用户是否存在
  SELECT pin_hash INTO v_existing_pin FROM users WHERE phone = p_phone;

  IF v_existing_pin IS NULL THEN
    -- 用户不存在，禁止注册
    RETURN json_build_object('success', false, 'message', '该手机号未注册');
  ELSE
    -- 验证 PIN
    IF v_existing_pin = p_pin_hash THEN
      v_phone_masked := substring(p_phone, 1, 3) || '****' || substring(p_phone, 8, 4);
      RETURN json_build_object(
        'success', true,
        'message', '登录成功',
        'phone', p_phone,
        'phone_masked', v_phone_masked,
        'is_new', false
      );
    ELSE
      RETURN json_build_object('success', false, 'message', 'PIN码错误');
    END IF;
  END IF;
END;
$$;

-- 6. 打勾/取消函数
CREATE OR REPLACE FUNCTION toggle_milestone(
  p_milestone_id TEXT,
  p_checked BOOLEAN,
  p_phone TEXT,
  p_pin_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
BEGIN
  -- 验证用户身份
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  -- Upsert 里程碑状态
  INSERT INTO milestone_checks (milestone_id, checked, phone, updated_at)
  VALUES (p_milestone_id, p_checked, p_phone, now())
  ON CONFLICT (milestone_id)
  DO UPDATE SET checked = p_checked, phone = p_phone, updated_at = now();

  RETURN json_build_object(
    'success', true,
    'message', '更新成功',
    'milestone_id', p_milestone_id,
    'checked', p_checked
  );
END;
$$;

-- 7. 插入 331 条里程碑初始记录
-- 使用 ON CONFLICT 避免重复插入
INSERT INTO milestone_checks (milestone_id, checked, phone, updated_at)
SELECT id, false, null, null
FROM unnest(ARRAY[
  's01-001','s01-002','s01-003','s01-004','s01-005','s01-006','s01-007','s01-008','s01-009','s01-010',
  's01-011','s01-012','s01-013','s01-014','s01-015','s01-016','s01-017','s01-018','s01-019','s01-020',
  's01-021','s01-022','s01-023','s01-024','s01-025','s01-026','s01-027','s01-028','s01-029','s01-030',
  's01-031','s01-032','s01-033','s01-034','s01-035','s01-036','s01-037','s01-038','s01-039','s01-040',
  's01-041','s01-042','s01-043','s01-044','s01-045','s01-046','s01-047','s01-048','s01-049','s01-050',
  's01-051',
  's02-001','s02-002','s02-003','s02-004','s02-005','s02-006','s02-007','s02-008','s02-009','s02-010',
  's02-011','s02-012','s02-013','s02-014','s02-015','s02-016','s02-017','s02-018','s02-019','s02-020',
  's02-021','s02-022','s02-023','s02-024','s02-025','s02-026','s02-027','s02-028','s02-029','s02-030',
  's02-031','s02-032','s02-033','s02-034','s02-035','s02-036','s02-037','s02-038','s02-039',
  's03-001','s03-002','s03-003','s03-004','s03-005','s03-006','s03-007','s03-008','s03-009','s03-010',
  's03-011','s03-012','s03-013','s03-014','s03-015','s03-016','s03-017','s03-018','s03-019','s03-020',
  's03-021','s03-022','s03-023','s03-024','s03-025','s03-026','s03-027','s03-028','s03-029','s03-030',
  's04-001','s04-002','s04-003','s04-004','s04-005','s04-006','s04-007','s04-008','s04-009','s04-010',
  's04-011','s04-012','s04-013','s04-014','s04-015','s04-016','s04-017','s04-018','s04-019','s04-020',
  's04-021','s04-022','s04-023','s04-024','s04-025',
  's05-001','s05-002','s05-003','s05-004','s05-005','s05-006','s05-007','s05-008','s05-009','s05-010',
  's05-011','s05-012','s05-013','s05-014','s05-015','s05-016','s05-017','s05-018','s05-019',
  's06-001','s06-002','s06-003','s06-004','s06-005','s06-006','s06-007','s06-008','s06-009','s06-010',
  's06-011','s06-012','s06-013','s06-014','s06-015','s06-016','s06-017','s06-018','s06-019','s06-020',
  's06-021','s06-022','s06-023',
  's07-001','s07-002','s07-003','s07-004','s07-005','s07-006','s07-007','s07-008','s07-009','s07-010',
  's07-011','s07-012','s07-013','s07-014','s07-015','s07-016','s07-017','s07-018','s07-019','s07-020',
  's07-021','s07-022','s07-023','s07-024','s07-025',
  's08-001','s08-002','s08-003','s08-004','s08-005','s08-006','s08-007','s08-008','s08-009','s08-010',
  's08-011','s08-012','s08-013','s08-014','s08-015','s08-016',
  's09-001','s09-002','s09-003','s09-004','s09-005','s09-006','s09-007','s09-008','s09-009','s09-010',
  's09-011','s09-012','s09-013','s09-014','s09-015',
  's10-001','s10-002','s10-003','s10-004','s10-005','s10-006','s10-007','s10-008','s10-009','s10-010',
  's10-011','s10-012','s10-013','s10-014','s10-015','s10-016','s10-017',
  'v-001','v-002','v-003','v-004','v-005','v-006','v-007','v-008','v-009','v-010',
  'v-011','v-012','v-013','v-014','v-015','v-016','v-017','v-018','v-019','v-020',
  'v-021','v-022','v-023','v-024','v-025','v-026','v-027','v-028','v-029','v-030',
  'v-031','v-032','v-033','v-034','v-035','v-036','v-037',
  'h-001','h-002','h-003','h-004','h-005','h-006','h-007','h-008','h-009','h-010',
  'h-011','h-012','h-013','h-014','h-015','h-016','h-017',
  'c-001','c-002','c-003','c-004','c-005','c-006','c-007','c-008','c-009','c-010',
  'c-011','c-012','c-013','c-014','c-015','c-016','c-017'
]) AS id
ON CONFLICT (milestone_id) DO NOTHING;

-- 8. 启用 Realtime（需要在 Supabase Dashboard 中手动操作）
-- 进入 Database > Replication > 启用 milestone_checks 表的 Realtime

-- ============================================
-- v3: 记录点滴 — 日记功能
-- ============================================

-- 9. 日记表
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  content_encrypted TEXT,
  content_iv TEXT,
  photo_paths TEXT[],
  entry_date DATE NOT NULL,
  mood TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 加密盐值表（每个用户一个 salt）
CREATE TABLE IF NOT EXISTS user_salts (
  phone TEXT PRIMARY KEY REFERENCES users(phone),
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. 日记表 RLS
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_salts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diary_no_anon" ON diary_entries;
DROP POLICY IF EXISTS "salts_read_all" ON user_salts;

CREATE POLICY "diary_no_anon" ON diary_entries FOR ALL TO anon USING (false);
CREATE POLICY "salts_read_all" ON user_salts FOR SELECT TO anon USING (true);

-- 12. 获取/创建用户加密 salt
CREATE OR REPLACE FUNCTION get_or_create_salt(p_phone TEXT, p_pin_hash TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
  v_existing_salt TEXT;
  v_new_salt TEXT;
BEGIN
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  SELECT salt INTO v_existing_salt FROM user_salts WHERE phone = p_phone;

  IF v_existing_salt IS NOT NULL THEN
    RETURN json_build_object('success', true, 'salt', v_existing_salt);
  END IF;

  v_new_salt := encode(gen_random_bytes(32), 'base64');
  INSERT INTO user_salts (phone, salt) VALUES (p_phone, v_new_salt);
  RETURN json_build_object('success', true, 'salt', v_new_salt);
END;
$$;

-- 13. 创建日记
CREATE OR REPLACE FUNCTION create_diary_entry(
  p_phone TEXT,
  p_pin_hash TEXT,
  p_content_encrypted TEXT,
  p_content_iv TEXT,
  p_photo_paths TEXT[],
  p_entry_date DATE,
  p_mood TEXT,
  p_tags TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
  v_new_id UUID;
BEGIN
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  INSERT INTO diary_entries (phone, content_encrypted, content_iv, photo_paths, entry_date, mood, tags)
  VALUES (p_phone, p_content_encrypted, p_content_iv, p_photo_paths, p_entry_date, p_mood, p_tags)
  RETURNING id INTO v_new_id;

  RETURN json_build_object(
    'success', true,
    'message', '保存成功',
    'id', v_new_id
  );
END;
$$;

-- 14. 读取日记列表
CREATE OR REPLACE FUNCTION get_diary_entries(
  p_phone TEXT,
  p_pin_hash TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
  v_result JSON;
BEGIN
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  SELECT json_agg(row_to_json(d)) INTO v_result
  FROM (
    SELECT id, content_encrypted, content_iv, photo_paths, entry_date, mood, tags, created_at, updated_at
    FROM diary_entries
    WHERE phone = p_phone
    ORDER BY entry_date DESC, created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) d;

  RETURN json_build_object(
    'success', true,
    'entries', COALESCE(v_result, '[]'::json)
  );
END;
$$;

-- 15. 更新日记
CREATE OR REPLACE FUNCTION update_diary_entry(
  p_entry_id UUID,
  p_phone TEXT,
  p_pin_hash TEXT,
  p_content_encrypted TEXT,
  p_content_iv TEXT,
  p_photo_paths TEXT[],
  p_mood TEXT,
  p_tags TEXT[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
BEGIN
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  UPDATE diary_entries
  SET content_encrypted = p_content_encrypted,
      content_iv = p_content_iv,
      photo_paths = p_photo_paths,
      mood = p_mood,
      tags = p_tags,
      updated_at = now()
  WHERE id = p_entry_id AND phone = p_phone;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', '日记不存在或无权修改');
  END IF;

  RETURN json_build_object('success', true, 'message', '更新成功');
END;
$$;

-- 16. 删除日记
CREATE OR REPLACE FUNCTION delete_diary_entry(
  p_entry_id UUID,
  p_phone TEXT,
  p_pin_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_pin TEXT;
BEGIN
  SELECT pin_hash INTO v_stored_pin FROM users WHERE phone = p_phone;
  IF v_stored_pin IS NULL THEN
    RETURN json_build_object('success', false, 'message', '用户不存在');
  END IF;
  IF v_stored_pin != p_pin_hash THEN
    RETURN json_build_object('success', false, 'message', 'PIN码错误');
  END IF;

  DELETE FROM diary_entries WHERE id = p_entry_id AND phone = p_phone;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', '日记不存在或无权删除');
  END IF;

  RETURN json_build_object('success', true, 'message', '删除成功');
END;
$$;

-- 17. Supabase Storage: 需要在 Dashboard 中手动创建 diary-photos 桶
-- 进入 Storage > New Bucket > 名称: diary-photos, 勾选 Private
--
-- 18. Storage RLS 策略（本应用使用 anon 角色，不使用 Supabase Auth）
-- 安全性依赖：应用层登录门控 + RPC 身份验证 + 不可猜测的文件路径 + 签名 URL

-- 清理可能存在的旧策略
DROP POLICY IF EXISTS "diary_photos_anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "diary_photos_anon_read" ON storage.objects;
DROP POLICY IF EXISTS "diary_photos_anon_delete" ON storage.objects;

-- 允许 anon 上传照片（路径格式: 手机号/时间戳-随机串.jpg）
CREATE POLICY "diary_photos_anon_upload" ON storage.objects
FOR INSERT TO anon WITH CHECK (bucket_id = 'diary-photos');

-- 允许 anon 读取照片（读取时通过签名 URL，URL 1小时后失效）
CREATE POLICY "diary_photos_anon_read" ON storage.objects
FOR SELECT TO anon USING (bucket_id = 'diary-photos');

-- 允许 anon 删除照片（仅通过日记编辑界面，RPC 验证身份后执行）
CREATE POLICY "diary_photos_anon_delete" ON storage.objects
FOR DELETE TO anon USING (bucket_id = 'diary-photos');
