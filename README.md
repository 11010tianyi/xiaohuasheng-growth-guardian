# 小花生成长护航计划

为小花生量身定制的 0-10 岁成长里程碑追踪工具。涵盖健康医疗、教育启蒙、情感陪伴三大维度，331 条数据，14 个工作表，疫苗/体检/仪式全覆盖。

## 项目结构

```
├── index.html            # 首页，导航 + Excel 下载
├── stage-0-3.html        # 0-3 岁里程碑（51+39+30 = 120 项）
├── stage-3-6.html        # 3-6 岁里程碑（25+19+23 = 67 项）
├── stage-6-10.html       # 6-10 岁里程碑（25+16+15+17 = 73 项）
├── health.html           # 疫苗接种（37 项）+ 健康体检（17 项）
├── milestones.html       # 成长仪式清单（17 项）
├── milestones-data.js    # 唯一数据源，331 条里程碑
├── growth-guardian.js    # 共享逻辑：打勾、恢复、分享、Excel 导出
└── push-to-github.sh     # GitHub Pages 部署脚本
```

## 功能

- **里程碑追踪**：打勾标记已完成项，进度条实时更新
- **数据持久化**：打勾状态自动保存到浏览器 localStorage
- **链接分享**：将打勾进度编码到 URL，家人打开链接即可恢复
- **Excel 导出**：一键生成 14 个工作表的 .xlsx 文件，"完成状态"列与网页同步
- **权威来源**：数据参考中国 CDC、国家卫健委、AAP、WHO 等机构指南

## 技术栈

- 纯静态 HTML/CSS/JS，无构建步骤，直接部署到 GitHub Pages
- [SheetJS 0.18.5](https://cdn.jsdelivr.net/npm/xlsx@0.18.5/) — 按需加载，客户端生成 Excel
- [LZ-String 1.5.0](https://cdn.jsdelivr.net/npm/lz-string@1.5.0/) — URL hash 压缩

---

## 多设备数据同步方案对比

本站部署在 GitHub Pages（纯静态，无后端），打勾数据默认只存在当前浏览器。以下四种方案可实现跨设备访问。

### 方案 4：手动分享链接（当前方案）

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

其他设备打开此链接时：

```
URL hash #s=QgNABQMckA
    ↓ LZString.decompressFromEncodedURIComponent()
"a1-1,a1-2,v3"
    ↓ split(",")
["a1-1","a1-2","v3"]
    ↓ decompressId() 还原完整 ID
["s01-001","s01-002","v-003"]
    ↓ 写入 localStorage + 渲染勾选状态
页面显示 3 项已完成
```

**取消打勾的原理**

ID 列表只包含当前已勾选项。取消打勾时，该 ID 从数组中移除：

```
勾选 s01-001 → 列表: ["s01-001","s01-002"]
取消 s01-001 → 列表: ["s01-002"]
再次分享 → URL 只含 s01-002 的编码
```

**优点**：无需后端，无需注册，简单可靠

**缺点**：每次变更需手动分享；旧链接不自动失效（含旧状态）

---

### 方案 1：URL 自动同步

**原理**

与方案 4 使用完全相同的编码/解码机制，区别在于**时机**：

| | 方案 4（手动） | 方案 1（自动） |
|---|---|---|
| 更新 URL 的时机 | 点击"分享进度"按钮 | 每次打勾/取消后立即 |
| 保存方式 | 手动复制链接发送 | 收藏浏览器书签 |
| 恢复方式 | 打开分享链接 | 打开书签 |

实现上，只需在 `toggleCheck()` 末尾自动调用 `encodeCheckedToHash()`：

```js
window.toggleCheck = function(element) {
    // ... 原有逻辑 ...
    localStorage.setItem('checkedItems', JSON.stringify(checkedItems));
    updateProgress();
    encodeCheckedToHash();  // 新增：自动更新 URL
};
```

**使用流程**

1. 手机上打开网站，打勾若干项 → 地址栏自动更新为含 hash 的 URL
2. 将当前 URL 添加为浏览器书签
3. 电脑上打开该书签 → 自动恢复手机上的打勾状态
4. 电脑上继续打勾/取消 → 地址栏再次自动更新
5. 更新书签 → 下次手机打开即为最新状态

**取消打勾的原理**

与方案 4 相同：取消打勾时 ID 从列表移除，URL hash 实时更新，书签随之更新。

**优点**：比方案 4 更方便，不需要手动点分享按钮

**缺点**：仍需手动更新书签；不是实时推送；频繁更新 URL 可能影响浏览器历史记录

---

### 方案 2：Firebase 实时同步

**原理**

接入 [Firebase Realtime Database](https://firebase.google.com/docs/database)，数据存在 Google 云端：

```
打勾 → 写入 Firebase → 其他设备监听到变化 → 自动更新 UI
```

**架构**

```
浏览器 A (手机)                    Firebase Cloud                   浏览器 B (电脑)
    │                                  │                                │
    ├─ toggleCheck()                   │                                │
    ├─ 写入 localStorage               │                                │
    ├─ firebase.ref('checks').set() ──→│                                │
    │                                  ├─ 实时推送 ──────────────────→│
    │                                  │                                ├─ 更新 localStorage
    │                                  │                                ├─ 更新 UI
```

**优点**：真正的多设备实时同步，自动冲突合并

**缺点**：需要 Google 账号、Firebase 项目配置；数据存在 Google 云端；增加约 100KB 的 Firebase SDK

---

### 方案 3：Supabase 实时同步

**原理**

与方案 2 类似，但使用 [Supabase](https://supabase.com/)（开源 Firebase 替代品）：

```
打勾 → 写入 Supabase PostgreSQL → 其他设备通过 WebSocket 监听 → 自动更新 UI
```

**优点**：开源、免费额度充足、数据存在 Supabase 云端（可自托管）

**缺点**：需要注册 Supabase 账号和配置；增加约 50KB 的 Supabase JS 客户端

---

### 方案对比总结

| 特性 | 方案 4 手动分享 | 方案 1 URL 自动同步 | 方案 2 Firebase | 方案 3 Supabase |
|---|---|---|---|---|
| 是否需要后端 | 否 | 否 | 是 (Google) | 是 (Supabase) |
| 是否需要注册账号 | 否 | 否 | 是 | 是 |
| 实时同步 | 否 | 否 | 是 | 是 |
| 支持取消打勾 | 是 | 是 | 是 | 是 |
| 同步方式 | 手动复制链接 | 收藏书签 | 自动推送 | 自动推送 |
| 多人协作 | 通过链接传递 | 通过书签传递 | 实时共享 | 实时共享 |
| 数据存储位置 | 浏览器本地 | 浏览器本地 + URL | Google 云端 | Supabase 云端 |
| 额外依赖 | 无 | 无 | ~100KB SDK | ~50KB SDK |
| 隐私风险 | 低 | 低 | 中 | 中 |
| 实现复杂度 | 已完成 | 极低（改动 1 行） | 中 | 中 |

### 建议

- **个人使用**：方案 1（URL 自动同步）最合适，改动极小，体验提升明显
- **家庭共享**：方案 2 或 3，多人实时看到彼此的打勾进度
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
