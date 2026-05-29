/* 小花生成长护航计划 - Supabase 配置
 *
 * 部署方式：
 * - GitHub Pages: 此文件中的占位符会在 GitHub Actions 部署时自动替换为仓库 Secrets 中的真实值
 * - 本地开发: 将占位符替换为你的实际值即可
 *
 * 配置步骤：
 * 1. 前往 https://supabase.com 创建项目
 * 2. 在项目 Settings > API 中找到 URL 和 anon/public key
 * 3. 在 SQL Editor 中运行 supabase-setup.sql
 * 4a. GitHub 部署: 在仓库 Settings > Secrets 中添加 SUPABASE_URL 和 SUPABASE_ANON_KEY
 * 4b. 本地开发: 直接替换下方占位符（不要提交真实值）
 */

var SUPABASE_CONFIG = {
  url: '__SUPABASE_URL__',
  anonKey: '__SUPABASE_ANON_KEY__'
};
