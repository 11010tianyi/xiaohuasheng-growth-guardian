# 小花生成长护航计划

为小花生量身定制的 0-10 岁成长里程碑追踪工具。涵盖健康医疗、教育启蒙、情感陪伴三大维度，331 条数据，疫苗/体检/仪式全覆盖。

## 项目结构

```
├── index.html            # 首页，导航 + Excel 下载
├── diary.html            # 成长日记（家人共享、Markdown、照片墙）
├── stage-0-3.html        # 0-3 岁里程碑（120 项）
├── stage-3-6.html        # 3-6 岁里程碑（67 项）
├── stage-6-10.html       # 6-10 岁里程碑（73 项）
├── health.html           # 疫苗接种（37 项）+ 健康体检（17 项）
├── milestones.html       # 成长仪式清单（17 项）
├── milestones-data.js    # 唯一数据源，331 条里程碑
├── growth-guardian.js    # 共享逻辑：打勾、恢复、分享、Excel 导出、认证 UI
├── family-config.js      # 家人身份配置（手机尾号→称呼映射）
├── diary.js              # 日记模块（CRUD、照片、心情标签、Markdown）
├── music-player.js       # 全局音乐播放器（四主题 18 首曲目，主题色卡片）
├── supabase-config.js    # Supabase 配置（用户填入 url + anonKey）
├── supabase-sync.js      # Supabase 实时同步模块（登录/同步/Realtime）
├── supabase-setup.sql    # 数据库初始化脚本（在 Supabase SQL Editor 中运行）
├── supabase/                     # Supabase Edge Functions
│   ├── config.toml               # Functions 配置
│   └── functions/parse-milestones/# AI 语音打卡边缘函数（DeepSeek）
├── docs/                        # 文档
│   ├── supabase-setup.md              # Supabase 配置与数据库方案
│   ├── dary-share-plan.md             # 日记共享方案（历史参考）
│   ├── ITEM_LINKS.md                  # 跨区同步映射表（里程碑↔疫苗/体检/仪式）
│   ├── v4.1.0-milestone-card-overlay.md # 4.1.0 版本变更说明（详情弹窗、日记关联）
│   ├── v5.0.0-voice-checkin.md        # 5.0.0 版本变更说明（语音打卡、AI 日志增强）
│   └── v5.1.00-music-themes.md        # 5.1.00 版本变更说明（四主题音乐播放器、主题色卡片）
└── push-to-github.sh            # GitHub Pages 部署脚本
```

## 功能

- **语音打卡**：点击 FAB 按钮录音，AI 自动匹配里程碑（331+ 项），语音转日志并增强（摘要、创作、亲子提问）
- **里程碑追踪**：打勾标记已完成项，进度条实时更新
- **里程碑关联日记**：日记编辑器中可选关联里程碑，保存后自动编码为 `📌` 标签，查看日记时展示关联里程碑的科学解释
- **里程碑卡片详情弹窗**：点击卡片弹出 Markdown 渲染的科学解释 + 权威来源链接（331+ 条数据全覆盖）
- **里程碑卡片详情弹窗**：点击卡片弹出 Markdown 渲染的科学解释 + 权威来源链接（331+ 条数据全覆盖）
- **跨区自动同步**：同一事项（如"42天体检"）在里程碑页和体检/疫苗/仪式页之间自动同步勾选状态
- **成长日记**：家人共享日记，支持 Markdown 编辑/预览、照片、心情、标签
- **日记照片墙**：宽屏两侧自动滚动照片瀑布，带上传人时间戳，点击放大
- **背景音乐**：全局音乐播放器，四主题 18 首曲目（原始/儿童/轻音乐/白噪音），可切换主题，带主题色卡片指示器，偏好持久化
- **家人身份**：手机尾号自动映射为称呼（花爸爸、花妈妈、花奶奶），跨日记和里程碑统一显示
- **全页登录/退出**：任何页面均可登录和退出，非主人日记不可编辑/删除
- **手机号 + PIN 认证**：自设 PIN 码（免费，无需短信服务商），首次输入自动注册
- **PIN 失败冷却**：连续 5 次 PIN 错误自动锁定 15 分钟，防止暴力破解
- **多设备实时同步**：基于 Supabase Realtime，A 设备打勾 → B 设备秒级更新
- **编辑追溯**：每个里程碑显示最后编辑者身份和时间
- **数据持久化**：本地优先（localStorage 即时响应 + 离线可用），Supabase 异步同步
- **链接分享**：将打勾进度编码到 URL，家人打开链接即可恢复
- **Excel 导出**：一键生成 14 个工作表的 .xlsx 文件，含"手机号"和"最后编辑时间"列
- **权威来源**：数据参考中国 CDC、国家卫健委、AAP、WHO 等机构指南

## 技术栈

- 纯静态 HTML/CSS/JS，无构建步骤，直接部署到 GitHub Pages
- [Supabase JS 2.x](https://supabase.com/) — 实时同步 + RPC 认证 + Edge Functions（~50KB）
- [DeepSeek Chat API](https://platform.deepseek.com/) — AI 语义分析 + 日志增强
- [SheetJS 0.18.5](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/) — 按需加载，客户端生成 Excel
- [LZ-String 1.5.0](https://cdn.jsdelivr.net/npm/lz-string@1.5.0/) — URL hash 压缩
- [marked.js](https://marked.js.org/) — Markdown 渲染
- [DOMPurify](https://github.com/cure53/DOMPurify) — XSS 防护

---

## Supabase 配置

详见 [docs/supabase-setup.md](docs/supabase-setup.md)，包含配置步骤、认证方案、日记功能说明和数据同步方案对比。

---

## 部署

本项目为纯静态站点，可直接部署到任何静态托管服务：

```bash
# GitHub Pages
gh repo create xiaohuasheng-growth-guardian --public
git push -u origin main
gh api --method POST repos/OWNER/xiaohuasheng-growth-guardian/pages --input - <<'EOF'
{"build_type":"legacy","source":{"branch":"main","path":"/"}}
EOF
```

## 权威数据来源

| 领域 | 来源 | 发布机构 |
|---|---|---|
| 疫苗接种 | 国家免疫规划疫苗儿童免疫程序及说明(2021年版) | 中国疾病预防控制中心 |
| 健康体检 | 国家基本公共卫生服务规范(第三版) | 国家卫生健康委员会 |
| 发育里程碑 | 美国儿科学会育儿百科(AAP)、WHO儿童生长标准 | 国际权威儿科组织 |
| 营养辅食 | 中国居民膳食指南(2022) | 中国营养学会 |

> 每个孩子的发育节奏不同，本计划仅供参考。如有疑问，请咨询专业儿科医生。

## License

MIT
