# 小花生成长护航计划

为小花生量身定制的 0-10 岁成长里程碑追踪工具。涵盖健康医疗、教育启蒙、情感陪伴三大维度，331 条数据，疫苗/体检/仪式全覆盖。

## 项目结构

```
├── index.html            # 首页，导航 + Excel 下载
├── stage-0-3.html        # 0-3 岁里程碑（120 项）
├── stage-3-6.html        # 3-6 岁里程碑（67 项）
├── stage-6-10.html       # 6-10 岁里程碑（73 项）
├── health.html           # 疫苗接种（37 项）+ 健康体检（17 项）
├── milestones.html       # 成长仪式清单（17 项）
├── milestones-data.js    # 唯一数据源，331 条里程碑
├── growth-guardian.js    # 共享逻辑：打勾、恢复、分享、Excel 导出、认证 UI
├── supabase-config.js    # Supabase 配置（用户填入 url + anonKey）
├── supabase-sync.js      # Supabase 实时同步模块（登录/注册/同步/Realtime）
├── supabase-setup.sql    # 数据库初始化脚本（在 Supabase SQL Editor 中运行）
└── push-to-github.sh     # GitHub Pages 部署脚本
```

## 功能

- **里程碑追踪**：打勾标记已完成项，进度条实时更新
- **手机号 + PIN 认证**：自设 PIN 码（免费，无需短信服务商），首次输入自动注册
- **多设备实时同步**：基于 Supabase Realtime，A 设备打勾 → B 设备秒级更新
- **编辑追溯**：每个里程碑显示最后编辑者手机号（脱敏）和时间
- **数据持久化**：本地优先（localStorage 即时响应 + 离线可用），Supabase 异步同步
- **链接分享**：将打勾进度编码到 URL，家人打开链接即可恢复
- **Excel 导出**：一键生成 14 个工作表的 .xlsx 文件，含"手机号"和"最后编辑时间"列
- **权威来源**：数据参考中国 CDC、国家卫健委、AAP、WHO 等机构指南

## 技术栈

- 纯静态 HTML/CSS/JS，无构建步骤，直接部署到 GitHub Pages
- [Supabase JS 2.x](https://supabase.com/) — 实时同步 + RPC 认证（~50KB）
- [SheetJS 0.18.5](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/) — 按需加载，客户端生成 Excel
- [LZ-String 1.5.0](https://cdn.jsdelivr.net/npm/lz-string@1.5.0/) — URL hash 压缩

---

## Supabase 配置步骤

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com/) 注册并创建一个免费项目
2. 记录项目的 **Project URL** 和 **anon public key**（Settings → API）

### 2. 初始化数据库

在 Supabase Dashboard 的 **SQL Editor** 中运行 `supabase-setup.sql`，它将：
- 创建 `users` 表（手机号 + PIN 哈希）
- 创建 `milestone_checks` 表（里程碑 ID + 打勾状态 + 编辑者 + 时间）
- 启用 Row Level Security（RLS），匿名只读，写操作通过 RPC 函数
- 创建 `login_user` 和 `toggle_milestone` 两个 RPC 函数（SECURITY DEFINER）
- 插入 331 条里程碑初始记录

### 3. 启用 Realtime

在 Supabase Dashboard 中：**Database → Replication** → 启用 `milestone_checks` 表的 Realtime

### 4. 填入配置

编辑 `supabase-config.js`：

```js
var SUPABASE_CONFIG = {
  url: 'https://你的项目ID.supabase.co',
  anonKey: '你的anon-public-key'
};
```

### 5. 部署

推送到 GitHub Pages 即可使用。未配置 Supabase 时，应用仍可正常运行（仅本地模式）。

---

## 认证方案：手机号 + 自设 PIN 码

### 为什么不用 Supabase Auth 的手机 OTP？

Supabase Auth 的手机号登录需要付费短信服务商（如 Twilio），每条短信约 $0.05。自设 PIN 码完全免费。

### 安全机制

| 环节 | 实现 |
|---|---|
| PIN 传输 | 客户端用 `crypto.subtle.digest('SHA-256')` 对 PIN 做哈希，网络中不传明文 |
| PIN 存储 | Supabase 只存 SHA-256 哈希值，无法反推原始 PIN |
| 写入验证 | 所有写操作通过 RPC 函数，SECURITY DEFINER 绕过 RLS，函数内部验证 PIN 哈希 |
| 手机号脱敏 | 显示为 `138****1234` 格式，完整号码不暴露在前端 |
| 读取权限 | RLS 允许匿名读取（方便家人查看进度），写入必须通过认证 |

### 本地优先策略

```
toggleCheck()
  ├─ 1. 即时：写入 localStorage + 更新 UI（0 延迟）
  ├─ 2. 异步：supabaseToggle() → RPC toggle_milestone()（后台同步）
  └─ 3. 实时：其他设备收到 postgres_changes → 更新 UI（秒级）
```

即使网络断开，打勾也能正常使用（存 localStorage），联网后自动同步。

---

## 多设备数据同步方案对比

本站部署在 GitHub Pages（纯静态，无后端），打勾数据默认只存在当前浏览器。以下四种方案可实现跨设备访问。

### 方案 4：手动分享链接（v1 基础功能）

**原理**

打勾数据存储在浏览器的 `localStorage` 中，格式为已勾选里程碑 ID 的数组：

```json
["s01-001", "s01-002", "v-003", "h-005"]
```

点击"分享进度"按钮时，系统执行以下流程：

```
localStorage ["s01-001","s01-002","v-003"]
    ↓ compressId() 缩短 ID
["a1-1","a1-2","v3"]
    ↓ join(",")
"a1-1,a1-2,v3"
    ↓ LZString.compressToEncodedURIComponent()
"QgNABQMckA"
    ↓ 拼接到 URL hash
https://xxx.github.io/xxx/stage-0-3.html#s=QgNABQMckA
```

其他设备打开此链接时执行逆过程还原勾选状态。取消打勾时，该 ID 从数组中移除。

**优点**：无需后端，无需注册，简单可靠

**缺点**：每次变更需手动分享；旧链接不自动失效

---

### 方案 1：URL 自动同步（v1 增强）

**原理**

与方案 4 使用完全相同的编码/解码机制，区别在于**时机**：

| | 方案 4（手动） | 方案 1（自动） |
|---|---|---|
| 更新 URL 的时机 | 点击"分享进度"按钮 | 每次打勾/取消后立即 |
| 保存方式 | 手动复制链接发送 | 收藏浏览器书签 |
| 恢复方式 | 打开分享链接 | 打开书签 |

实现上，在 `toggleCheck()` 末尾自动调用 `encodeCheckedToHash()`。

**使用流程**：打勾 → 地址栏自动更新 → 收藏书签 → 其他设备打开书签即可恢复

**优点**：比方案 4 更方便，1 行代码改动

**缺点**：仍需手动更新书签；不是实时推送

---

### 方案 3：Supabase 实时同步（v2 已实现）

**原理**

```
浏览器 A (手机)                    Supabase Cloud                   浏览器 B (电脑)
    │                                  │                                │
    ├─ toggleCheck()                   │                                │
    ├─ 1. 写入 localStorage (即时)     │                                │
    ├─ 2. RPC toggle_milestone() ─────→│                                │
    │                                  ├─ 3. postgres_changes 推送 ────→│
    │                                  │                                ├─ 更新 localStorage
    │                                  │                                ├─ 更新 UI + 编辑者信息
```

**架构细节**

- **认证**：手机号 + SHA-256 哈希 PIN，通过 RPC 函数 `login_user` 验证
- **写入**：通过 RPC 函数 `toggle_milestone`（SECURITY DEFINER 绕过 RLS，内部验证 PIN）
- **读取**：RLS 允许匿名 SELECT，加载全部打勾状态
- **实时**：Supabase Realtime（WebSocket）监听 `milestone_checks` 表的 INSERT/UPDATE
- **本地优先**：localStorage 先写，Supabase 异步同步，离线可用

**优点**：真正的多设备实时同步；编辑追溯（谁在什么时候打的勾）；免费额度充足

**缺点**：需要注册 Supabase 账号和配置；增加约 50KB 的 Supabase JS 客户端

---

### 方案 2：Firebase 实时同步

**原理**

与方案 3 类似，但使用 [Firebase Realtime Database](https://firebase.google.com/docs/database)：

```
打勾 → 写入 Firebase → 其他设备监听到变化 → 自动更新 UI
```

**优点**：真正的多设备实时同步，自动冲突合并

**缺点**：需要 Google 账号、Firebase 项目配置；数据存在 Google 云端；增加约 100KB 的 Firebase SDK

---

### 方案对比总结

| 特性 | 方案 4 手动分享 | 方案 1 URL 自动 | 方案 3 Supabase (v2) | 方案 2 Firebase |
|---|---|---|---|---|
| 是否需要后端 | 否 | 否 | 是 (Supabase) | 是 (Google) |
| 是否需要注册账号 | 否 | 否 | 是 | 是 |
| 实时同步 | 否 | 否 | 是 | 是 |
| 编辑追溯 | 否 | 否 | 是 (手机号+时间) | 需额外开发 |
| 支持取消打勾 | 是 | 是 | 是 | 是 |
| 同步方式 | 手动复制链接 | 收藏书签 | 自动推送 | 自动推送 |
| 离线可用 | 是 | 是 | 是 (本地优先) | 需额外配置 |
| 数据存储位置 | 浏览器本地 | 浏览器本地 + URL | Supabase 云端 + 本地 | Google 云端 |
| 额外依赖 | 无 | 无 | ~50KB SDK | ~100KB SDK |
| 实现状态 | 已完成 | 已完成 | 已完成 (v2) | 未实现 |

### 建议

- **个人使用**：方案 1（URL 自动同步），改动极小，体验提升明显
- **家庭共享**：方案 3（Supabase v2），多人实时看到彼此的打勾进度 + 编辑追溯
- **隐私优先**：方案 4 或 1，数据不离开浏览器

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
