# LIFELOG · 生活日志

纯前端健身记录 App，Capacitor 打包 Android APK。

## 技术栈

- **零框架、零构建**：纯 HTML / CSS / JS，无打包步骤
- **数据**：localStorage，key = `liftlog.db.v1`
- **图表**：手写 SVG / CSS，零依赖
- **字体**：Google Fonts woff2 已本地化（`web/fonts/`）
- **打包**：Capacitor 6 + GitHub Actions 云端构建 APK

## 目录结构

```
web/              前端静态文件（Capacitor webDir）
  index.html      入口
  app.js          全部逻辑（数据层 / 渲染 / 图表 / 事件）
  styles.css      暗黑竞技风样式，手机优先
  fonts.css       @font-face 本地声明
  fonts/          woff2 字体文件
package.json      Capacitor 依赖
capacitor.config.json   appId=com.lifelog.app, webDir=web
.github/workflows/      GitHub Actions 构建 APK
```

## 数据模型

```
equipment: { id, name, lastSets:[{reps,weight}]|null }
entries:   { id, date, equipmentId, muscle, mode:'weighted'|'bodyweight'|'assisted', sets:[{reps,weight}], createdAt }
```

DB = `{ equipment, entries }`

## 常用命令

```bash
# 安装依赖
npm install

# 同步 web 到 android（需先 npx cap add android）
npm run sync

# 桌面预览：直接双击 web/index.html 或用本地服务器
python -m http.server 8000 --directory web

# 构建 APK（GitHub Actions 自动执行）
# push 到 main/master 分支即触发
```

## 签名（固定，可覆盖安装）

- CI 用**固定 debug keystore** 签名：keystore 的 base64 存在 GitHub Secret `ANDROID_DEBUG_KEYSTORE`（仓库 public，不可入库，备份在 `android-signing/`，已 gitignore）
- 本地备份 `android-signing/debug.keystore`（alias=androiddebugkey，密码 android）——**丢失则永远无法覆盖升级**
- workflow 在构建前恢复 keystore 到 `$HOME/.android/debug.keystore`（AGP 默认 debug 签名位置，零 build.gradle 改动）
- `versionCode` 用 `git rev-list --count HEAD` 注入，保证每次构建版本号递增
- ⚠️ 首次从"临时签名"切换到"固定签名"需在手机卸载重装一次；之后所有构建签名一致，覆盖安装保留数据

## 开发注意事项

- app.js 是单文件包含全部逻辑，修改时注意搜索定位
- 自重器械（mode='bodyweight'）不记重量，按次数统计
- 配重模式（mode='assisted'）：weight 为配重 kg，越大越轻松，不计入 kg 训练量
- 记录弹窗：每组次数/重量用加减号 stepper + 输入框，连续录入为"保存本组开下一组"
- 周 = 周一~周日，月 = 自然月
- 热力图颜色：训练=绿色（组数）
- 14 天柱图横轴从今天往回每 3 天标一个日期
- npm 镜像：.npmrc 配置了 npmmirror
