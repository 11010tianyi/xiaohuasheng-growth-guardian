#!/bin/bash
# 小花生成长护航计划 - GitHub 推送脚本

set -e

echo "🚀 开始推送到 GitHub..."

# 检查 gh 是否安装
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI 未安装，请先安装:"
    echo "   brew install gh"
    exit 1
fi

# 检查登录状态
echo "🔐 检查 GitHub 登录状态..."
gh auth status || (echo "请先运行: gh auth login" && exit 1)

# 进入项目目录
cd "$(dirname "$0")"

# 创建 GitHub 仓库并推送
echo "📦 创建 GitHub 仓库..."
gh repo create xiaohuasheng-growth-guardian \
  --public \
  --description "小花生成长护航计划 - A beautiful childhood milestone tracker website" \
  --source=. \
  --push \
  --homepage "https://11010tianyi.github.io/xiaohuasheng-growth-guardian/" \
  || echo "仓库可能已存在，继续推送..."

# 确保远程仓库已添加
git remote add origin https://github.com/11010tianyi/xiaohuasheng-growth-guardian.git 2>/dev/null || true

# 推送代码
echo "⬆️ 推送代码到 GitHub..."
git branch -M main
git push -u origin main

# 启用 GitHub Pages
echo "🌐 启用 GitHub Pages..."
gh api --method POST repos/11010tianyi/xiaohuasheng-growth-guardian/pages \
  -f source='{"branch":"main","path":"/"}' 2>/dev/null || echo "GitHub Pages 可能已启用"

echo "✅ 完成！"
echo ""
echo "📋 仓库地址: https://github.com/11010tianyi/xiaohuasheng-growth-guardian"
echo "🌐 网站地址: https://11010tianyi.github.io/xiaohuasheng-growth-guardian/"
echo ""
echo "⏳ GitHub Pages 部署可能需要几分钟，请稍后访问"
