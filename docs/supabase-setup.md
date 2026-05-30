# Supabase 配置与数据库方案

## 配置步骤

### 1. 创建 Supabase 项目

1. 前往 [supabase.com](https://supabase.com/) 注册并创建一个免费项目
2. 记录项目的 **Project URL** 和 **anon public key**（Settings → API）

### 2. 初始化数据库

在 Supabase Dashboard 的 **SQL Editor** 中运行 `supabase-setup.sql`，它将：
- 创建 `users` 表（手机号 + PIN 哈希）
- 创建 `milestone_checks` 表（里程碑 ID + 打勾状态 + 编辑者 + 时间）
- 创建 `diary_entries` 表（明文日记内容 + 照片路径 + 心情标签）
- 启用 Row Level Security（RLS），匿名只读，写操作通过 RPC 函数
- 创建 `login_user`、`toggle_milestone`、`create_diary_entry`、`get_diary_entries`、`update_diary_entry`、`delete_diary_entry` 等 RPC 函数（SECURITY DEFINER）
- 插入 331 条里程碑初始记录

### 3. 启用 Realtime

在 Supabase Dashboard 中：**Database → Replication** → 启用 `milestone_checks` 表的 Realtime

### 4. 创建 Storage Bucket

在 Supabase Dashboard 中：**Storage → New Bucket** → 名称: `diary-photos`，勾选 Private

Storage RLS 策略已在 `supabase-setup.sql` 中定义，支持 anon 角色的上传/读取/删除。

### 5. 填入配置

编辑 `supabase-config.js`：

```js
var SUPABASE_CONFIG = {
  url: 'https://你的项目ID.supabase.co',
  anonKey: '你的anon-public-key'
};
```

### 6. 部署

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
| 身份显示 | 手机尾号映射为家人身份（花爸爸/花妈妈/花奶奶），未配置则脱敏显示 |
| 读取权限 | 里程碑允许匿名读取；日记通过 RPC 验证身份后才返回，RLS 禁止匿名直接访问 |

### 本地优先策略

```
toggleCheck()
  ├─ 1. 即时：写入 localStorage + 更新 UI（0 延迟）
  ├─ 2. 异步：supabaseToggle() → RPC toggle_milestone()（后台同步）
  └─ 3. 实时：其他设备收到 postgres_changes → 更新 UI（秒级）
```

即使网络断开，打勾也能正常使用（存 localStorage），联网后自动同步。

---

## 日记功能：家人共享模式

日记采用家人共享模式，所有登录用户可见全部日记条目。

- **内容存储**：明文存储（与里程碑打卡同级隐私保护）
- **访问控制**：RLS 禁止匿名直接访问，RPC 函数验证 PIN 身份后才返回数据
- **编辑/删除权限**：仅日记创建者可编辑/删除（RPC 函数 `WHERE phone = p_phone` 保证）
- **身份显示**：通过 `family-config.js` 配置手机尾号→身份名称映射

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
