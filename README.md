# Fly 音乐（Flymusic）

一个插件化的本地 / 在线音乐播放器。仓库地址：**<https://github.com/gxt0527/Flymusic>**

本项目在 [MusicFree](https://github.com/maotoumao/MusicFree)（AGPL-3.0）基础上二次开发，重点补齐 **Windows 桌面端**体验：完整的桌面窗口框架、侧栏导航、沉浸式播放页、原生托盘与文件对话框、Windows 风格的设置页与菜单。

- 代码：TypeScript + React Native 0.76.5（同一套 UI 跑 Android 与 Web / Electron）
- 桌面壳：Electron 33 + electron-builder 25（NSIS 安装包）
- 界面：React Native Web + 自研桌面布局层（侧栏 / 顶栏 / 播放条 / 浮层）
- 状态：Jotai；本地存储：MMKV（桌面端落到 Chromium localStorage）

> 本项目**不内置、不提供任何音源插件**，也不分发任何音乐内容。插件由使用者自行导入，软件仅提供插件运行环境。仓库内不含插件源、订阅地址或音源接口。

## 功能

**播放**
- 多音源插件化搜索、播放、歌单解析，支持音质选择
- 完整播放控制：上一首 / 下一首 / 播放暂停 / 循环模式 / 音量 / 进度拖拽
- 歌词：逐行高亮、进度联动快滑、歌词偏移校准、字号调节
- 播放列表、下一首播放、收藏、最近播放
- 无可用音源的曲目**直接跳过**，不弹提示、不停顿

**内容**
- 首页推荐、推荐歌单、听歌排行、歌单 / 专辑 / 歌手详情
- 本地音乐：导入文件夹或文件、扫描、删除、批量编辑
- 插件管理：安装 / 更新 / 排序 / 订阅

**桌面端（Windows）**
- 自绘标题栏（最小化 / 最大化 / 关闭）
- 系统托盘：显示主界面、播放 / 暂停、下一首、退出；关闭按钮行为可配置并持久化
- 侧栏随窗口宽度切换「展开 / 图标栏」，桌面版列表行与卡片网格单独适配
- 沉浸式播放页：黑胶唱片 + 歌词区
- Windows 11 风格的设置页、右键菜单、下拉与对话框；浅色 / 深色两套主题
- 原生「选择文件 / 选择文件夹」对话框、在资源管理器中定位文件
- 歌单解析网络代理（自动补 Referer / UA）

## 目录结构

```
├─ src/                  业务代码（React Native，多端共用）
│  ├─ components/        通用组件（桌面布局、音乐列表、播放条、菜单、弹窗）
│  ├─ pages/             页面（首页、推荐、榜单、播放页、本地音乐、设置…）
│  │  └─ setting/desktop/  桌面版 Windows 风格设置页
│  ├─ core/              核心逻辑（播放器、插件、歌单、歌词、媒体缓存）
│  ├─ platform/web/      桌面端运行时适配（fs / mmkv / trackPlayer / host 桥接）
│  ├─ constants/         路径与常量（含固定缓存目录 pathConst.ts）
│  ├─ theme/             设计令牌与语义色板
│  ├─ hooks/ utils/      通用 hooks 与工具
│  └─ types/             全局类型声明
├─ electron/
│  ├─ main.js            主进程（窗口、托盘、IPC、路径注入、缓存目录）
│  └─ preload.js         上下文隔离下的受控桥接（window.flyHost）
├─ scripts/              web 构建、图标生成、发布脚本
├─ android/              原生 Android 工程
├─ web/                  桌面端 HTML 宿主
├─ resources/            安装包与托盘图标
├─ release/              发布元信息（version.json：版本号 + changeLog）
├─ docs/                 本地历史设计稿（不入库，见 docs/README.md）
└─ preview/              早期高保真还原稿（不入库）
```

构建产物 `web-dist/`、`release-stage/`、`release-desktop/` 均不入库。

## 环境要求

| 项目 | 版本 |
| --- | --- |
| Node.js | 20.x |
| JDK（Android 构建） | 17 |
| Android SDK | 与 `android/build.gradle` 一致 |

## 开发

```bash
npm install

# 桌面端（构建 Web 包后启动 Electron）
npm run desktop

# 只构建 Web 产物到 web-dist/（生产模式）
npm run web:build:prod

# 类型检查 / 代码规范
./node_modules/.bin/tsc --noEmit
npm run lint

# Android 调试
npm run android
```

## 构建发布包

### Windows

```bash
npm run dist:win
```

流程：`web:build:prod` → `electron-builder` 输出到 `release-stage/` → `scripts/publish-win.js` 把安装包发布到 `release-desktop/`。

`release-desktop/` 中保留：

- `FlyMusic-<version>-setup.exe`：NSIS 安装包（可选安装目录、创建桌面快捷方式）
- `FlyMusic-<version>-setup.exe.blockmap` 与 `latest.yml`：增量更新元信息
- `backup/`：同版本号重发时归档的旧包

免安装目录 `win-unpacked/` 只存在于构建暂存目录 `release-stage/`，不发布。

**版本号需要四处同步**：`package.json`、`src/platform/web/modules/deviceInfo.ts` 的兜底串、`release/version.json`（含 `changeLog`）、`android/app/build.gradle` 的 `appVersionCode`（每次 +1）。

### Android

```bash
npm run build-android
```

正式签名需自备 `android/app/release.keystore` 与 `android/keystore.properties`（均在 `.gitignore` 中，不入库）。

## 缓存目录（桌面端）

所有运行时缓存固定保存在**应用安装目录**下的 `FlyMusicCache/`：

```
<安装目录>/FlyMusicCache/
├─ music/       播放器缓存
├─ image/       封面磁盘缓存
├─ lyric/       远程歌词缓存
└─ download/    下载中的临时音频
```

- 开发模式没有安装目录，固定目录落在项目根目录 `./FlyMusicCache/`（已加入 `.gitignore`）。
- 若用户把程序装到了只读位置（例如 `C:\Program Files`），启动时会检测写权限并**自动回退**到 `%APPDATA%\FlyMusic\storage\FlyMusicCache`，保证缓存功能不失效。
- 设置 → 基本设置 → 缓存里可以看到当前实际生效的目录，并一键在资源管理器中打开。
- 歌单、插件、配置、日志、用户导入的关联歌词属于**数据**，仍保存在 `%APPDATA%\FlyMusic\storage`，升级 / 卸载不会丢。缓存随安装目录清理是正常的。
- **一个例外**：Chromium 的网络缓存（流式音频与图片共用）由 Electron 通过 `sessionData` 管理，仍位于 `%APPDATA%\FlyMusic\Cache`。它和 localStorage 绑定在同一目录，单独搬迁会连歌单 / 设置一起搬走，卸载或升级即丢失，所以保留原位，改由 `session.getCacheSize()` / `clearCache()` 统计与清理。
- 音乐 / 歌词 / 图片三项缓存大小按上述目录实时统计，清理会同时清掉对应文件与歌词记录。

## 插件

- 软件本身不包含任何插件代码，仓库中也不含插件源、订阅地址或抓取逻辑。
- 插件是运行时动态加载的脚本，由使用者自行获取并通过「设置 → 插件管理」导入。
- 插件的行为与产生的内容由插件作者与使用者负责，与本项目无关。

## 数据与隐私

- 无账号体系，不收集、不上报任何使用数据。
- 播放记录、歌单、设置等数据保存在本地：
  - Windows：`%APPDATA%/FlyMusic`（业务数据在 `storage/` 子目录）
  - Android：应用私有目录
- 卸载应用不会自动删除上述目录；缓存目录位于安装目录，会随卸载一并清理。

## 许可

本项目基于 [MusicFree](https://github.com/maotoumao/MusicFree) 开发，遵循 **AGPL-3.0** 协议开源，完整文本见 [LICENSE](./LICENSE)。二次分发 / 打包请保留代码出处与协议声明。

开源地址：<https://github.com/gxt0527/Flymusic>

## 致谢

- [MusicFree](https://github.com/maotoumao/MusicFree)：本项目的上游工程
- [React Native](https://reactnative.dev/)、[React Native Web](https://necolas.github.io/react-native-web/)、[Electron](https://www.electronjs.org/)、[Jotai](https://jotai.org/)

## 免责声明

本项目仅用于学习与技术交流。软件本身不提供、不存储、不分发任何音频内容，所有内容均来自使用者自行配置的第三方接口；请遵守当地法律法规，支持正版，因使用产生的版权问题由使用者自行承担。
