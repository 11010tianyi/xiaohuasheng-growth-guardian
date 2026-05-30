/* 小花生成长护航计划 - Supabase 配置
 *
 * 使用前请填入你的 Supabase 项目信息：
 * 1. 前往 https://supabase.com 创建项目
 * 2. 在项目 Settings > API 中找到 URL 和 anon/public key
 * 3. 在 SQL Editor 中运行 supabase-setup.sql
 * 4. 将下方值替换为你的实际值
 *
 * 注：anon key 是公开的（类似 Firebase config），安全由 RLS 策略保障。
 * users 表的 RLS 禁止匿名读取，PIN 哈希不会泄露。
 */

var SUPABASE_CONFIG = {
  url: 'https://rhfbhnbstpufgnasrzrm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZmJobmJzdHB1ZmduYXNyenJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTE4OTcsImV4cCI6MjA5NTYyNzg5N30.7X2IC-2CvZw8idNJMyFEedFGEZbwxRrc6NFB-Q9ZyB8'
};
