# LIFELOG · 生活日志

纯前端的个人生活记录 App,目前记录两块:**健身训练** + **吉他练习**。所有数据存在浏览器本地(localStorage),无需后端、无需登录。最终目标:打包成安卓 APK 装手机用。

界面为暗黑竞技风,手机优先布局。

---

## 功能

### 训练
- 记录流程:选器械 → 逐组录入(组数/次数/重量)。默认 4 组 × 12 次 × 30kg,自动回填上次数值;没做的组点 ✕ 删除。
- 器械库:预存器械(名称 + 部位 + 有重量/自重),记录时直接选,不用重复输入。
- **自重器械**(如俯卧撑)不记重量,按次数统计;有重量器械按训练量(kg)= Σ(每组次数×重量)统计。
- 器材分部位:胸/背/肩/肱二头/肱三头/前臂/腿/臀/小腿/核心/有氧/其他。

### 练习(吉他)
- 记录每日练习时长(分钟)+ 可选备注,一天可多条累加。
- 统计:今日/本周/本月分钟、连续打卡天数、总天数、总时长。

### 报表
- **训练**:今日/本周/本月 kg · 近14天每日训练量柱图 · 训练热力图(6月,颜色=当天组数)· 按器械/按部位(可切换 全部/近30天/近90天/近1年/自定义 区间)。
- **练习**:今日/本周/本月分钟 · 连续打卡 · 近14天每日时长柱图 · 练习热力图(6月,颜色=当天分钟)。
- 报表顶部「训练 / 练习」切换。

### 其他
- 历史 tab 按日期合并展示训练 + 练习,可改可删。
- 数据导出 / 导入 JSON(备份与跨设备迁移)。

---

## 技术栈
- 纯 HTML / CSS / JS,**无框架、无构建步骤**。
- 数据:`localStorage`。
- 图表:手写 SVG / CSS(零依赖)。
- 字体:Google Fonts(Big Shoulders Display / Archivo / Space Mono),woff2 已下载到本地 `web/fonts/`(离线可用)。

## 目录结构
```
健身记录/
├─ web/                    前端静态文件(Capacitor webDir)
│  ├─ index.html           页面结构 + 本地字体引用
│  ├─ styles.css           样式(暗黑竞技风,手机优先)
│  ├─ app.js               全部逻辑(数据层 / 渲染 / 图表 / 事件)
│  ├─ fonts.css            @font-face 本地声明
│  └─ fonts/               woff2 字体文件
├─ package.json            Capacitor 依赖(@capacitor/core, android, cli)
├─ capacitor.config.json   appId / webDir=web
├─ .github/workflows/      GitHub Actions 构建 APK
└─ README.md
```

## 数据模型
```
equipment: { id, name, muscle, mode:'weighted'|'bodyweight', lastSets:[{reps,weight}]|null }
entries:   { id, date, equipmentId, mode, sets:[{reps,weight}], createdAt }
practice:  { id, date, minutes, note, createdAt }
```
- localStorage key:`liftlog.db.v1`(历史遗留命名,未改以保留旧数据)。
- 整个 DB = `{ equipment, entries, practice }`,导出即此对象的 JSON。

## 如何运行

**桌面预览**:直接双击 `web/index.html`。

**手机预览**(手机和电脑连同一 WiFi):
```bash
python -m http.server 8000 --bind 0.0.0.0 --directory "D:/myprojects/健身记录/web"
```
手机浏览器访问 `http://<电脑局域网IP>:8000`(用 `ipconfig` 查 IPv4,通常是 192.168.x.x / 172.x.x.x)。

> 注意:
> - 不同浏览器/设备的 localStorage 不共享,手机上是空数据。要搬数据:电脑「数据 → 导出 JSON」→ 传到手机 → 手机「数据 → 导入 JSON」。
> - Windows 防火墙可能拦截,需放行 Python 或 8000 端口。

## 数据与备份
- 数据只存在本地浏览器。清缓存 / 换浏览器 / 卸载 App 都会丢,**建议定期导出 JSON**。
- 导入会覆盖当前数据(导入时自动迁移补全字段)。

## 打包 APK
用 Capacitor 包 WebView(代码无需改动)+ GitHub Actions 云端构建,本地无需 Android SDK。

流程:
1. push 到 GitHub -> Actions 自动构建(见 `.github/workflows/build-apk.yml`)
2. Actions 页面下载 `lifelog-debug-apk` artifact
3. 装手机(开启「允许未知来源」)

构建细节:
- CI 里 `npx cap add android` 生成原生工程,`gradlew assembleDebug` 出 debug APK
- **字体**:已下载到本地 `web/fonts/`,离线(健身房无网)不回退
- **持久化**:localStorage 在 WebView 内可用,卸载 App 会清空;数据可经 App 内「导出 JSON」备份

## 设计决策备忘
- 自重器械不计 kg,单独按次数统计(避免 kg 与次数混在同一张图误导)。
- 报表「训练/练习」切换而非同图叠加(量纲不同)。
- 热力图颜色:训练 = 当天组数,练习 = 当天分钟(均含自重,反映打卡连续性)。
- 周 = 周一~周日,月 = 自然月;今日 ⊆ 本周 ⊆ 本月。

## 已知限制 / 可扩展
- 练习目前只记时长,未支持多乐器分类(可加「项目」字段扩展)。
- 无云同步 / 多设备同步(本地单机)。
- 训练量未区分每组重量递增的细节展示(已支持每组不同次数/重量,且各自统计)。
