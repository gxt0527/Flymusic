/**
 * Fly音乐 - Electron 主进程
 *
 * 职责：
 * 1. 创建无边框窗口并加载 Metro 打出的 web bundle
 * 2. 注册 `fly://`（应用资源）与 `fly-media://`（本地媒体，支持 Range）两个协议
 * 3. 通过 IPC 向渲染进程提供文件系统 / 系统对话框 / 窗口控制能力
 */
const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    protocol,
    shell,
    Menu,
    Tray,
    nativeImage,
    session,
} = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const { Readable } = require("stream");
const http = require("http");
const https = require("https");
const zlib = require("zlib");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const WEB_DIST = path.join(ROOT, "web-dist");

/**
 * 打包版是 Windows GUI 子系统，没有控制台，stdout 全丢。
 * FLY_LOG=<文件> 时把 log/error/warn 同时写盘，否则打包版出问题只能靠猜。
 */
if (process.env.FLY_LOG) {
    const logFile = process.env.FLY_LOG;
    const write = (tag, args) => {
        try {
            const text = args
                .map(a => {
                    if (typeof a === "string") {
                        return a;
                    }
                    try {
                        return JSON.stringify(a);
                    } catch {
                        return String(a);
                    }
                })
                .join(" ");
            fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${tag} ${text}\n`);
        } catch {
            // 写日志失败不能影响主流程
        }
    };
    const rawLog = console.log.bind(console);
    const rawErr = console.error.bind(console);
    const rawWarn = console.warn.bind(console);
    console.log = (...a) => {
        write("log", a);
        rawLog(...a);
    };
    console.error = (...a) => {
        write("error", a);
        rawErr(...a);
    };
    console.warn = (...a) => {
        write("warn", a);
        rawWarn(...a);
    };
}

const APP_VERSION = require(path.join(ROOT, "package.json")).version;

// 固定应用名，避免数据目录落到默认的 Electron 目录
app.setName("FlyMusic");
// FLY_USER_DATA=<目录> 时把 userData 指到别处：调试时与正式实例并存，
// 不会占用/污染真实数据目录（--user-data-dir 只隔离 Chromium 缓存，隔离不了它）
if (process.env.FLY_USER_DATA) {
    app.setPath("userData", process.env.FLY_USER_DATA);
}
// 任务栏分组 / 通知归属（与 electron-builder 的 appId 保持一致）
app.setAppUserModelId("fun.upup.musicfree");

/**
 * 缺省的光栅化占位是浅灰棋盘格。
 *
 * 页面切换（react-navigation 在 web 上把旧 screen 设成 display:none、
 * 新 screen 设回 display:flex）会让新页面那一层从头光栅化，tile 还没画完的
 * 那一两帧就会露出棋盘格；深色主题下桌面是深灰，这一点浅色就是「整屏亮一下」。
 * 关掉之后未完成的区域直接透出层底色/窗口底色，与页面同色，不再跳亮。
 *
 * 必须在 app ready 之前设置，ready 之后再追加不生效。
 */
app.commandLine.appendSwitch("disable-checker-imaging");

/* ------------------------------------------------------------------ */
/* 存储目录                                                            */
/* ------------------------------------------------------------------ */

// userData 目录里混着 Chromium 缓存，业务数据单独放一层
const STORAGE_ROOT = path.join(app.getPath("userData"), "storage");

function ensureDir(dir) {
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch {}
}

/**
 * 固定缓存目录：安装目录同级下的 FlyMusicCache。
 * 开发态没有安装目录，用项目根目录；打包态用 exe 所在目录。
 * 用户可能把程序装到只读位置（Program Files），此时回退到 userData，
 * 否则写入失败会让缓存统计恒为 0B、清理却误报成功。
 */
let INSTALL_ROOT = ROOT;
try {
    if (app.isPackaged) {
        INSTALL_ROOT = path.dirname(app.getPath("exe"));
    }
} catch {}

const CACHE_ROOT = path.join(INSTALL_ROOT, "FlyMusicCache");

function resolveCacheRoot() {
    try {
        fs.mkdirSync(CACHE_ROOT, { recursive: true });
        const probe = path.join(CACHE_ROOT, ".writable");
        fs.writeFileSync(probe, "ok", "utf8");
        fs.unlinkSync(probe);
        return CACHE_ROOT;
    } catch {
        const fallback = path.join(STORAGE_ROOT, "FlyMusicCache");
        ensureDir(fallback);
        return fallback;
    }
}

const CACHE_DIR = resolveCacheRoot();
const CACHE_SUBDIRS = ["music", "image", "lyric", "download"];
for (const name of CACHE_SUBDIRS) {
    ensureDir(path.join(CACHE_DIR, name));
}

/**
 * Chromium 的 HTTP 缓存由 sessionData 管理，不能只改这一项而不动 localStorage，
 * 否则歌单 / 设置会跟着搬到安装目录、卸载或升级即丢失。它由 Chromium 自己管理，
 * 统计与清理走 cache:httpSize / cache:clearHttp，路径单独暴露给渲染进程做兜底。
 */
let NETWORK_CACHE_PATH = "";
try {
    NETWORK_CACHE_PATH = path.join(app.getPath("userData"), "Cache");
} catch {}

/* ------------------------------------------------------------------ */
/* 桌面端窗口偏好（关闭行为）                                           */
/* ------------------------------------------------------------------ */

/**
 * 关闭按钮执行的操作：
 *  - "tray"：只关闭前台窗口，进程与播放继续（托盘常驻）
 *  - "quit"：关闭界面并退出后台
 *
 * 渲染进程的配置存在 MMKV（localStorage），主进程在窗口 close 时就要拿到值，
 * 所以这里单独落一份 JSON，并在启动 / 渲染进程启动时同步。
 */
const DESKTOP_PREFS_FILE = path.join(STORAGE_ROOT, "data", "desktop-prefs.json");
const CLOSE_ACTIONS = ["tray", "quit"];
let closeAction = "tray";
let isQuitting = false;
let tray = null;

/** 打包后图标在 process.resourcesPath/assets，开发态在 electron/assets */
const ASSET_DIR = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "assets");

function loadDesktopPrefs() {
    try {
        const raw = fs.readFileSync(DESKTOP_PREFS_FILE, "utf8");
        const json = JSON.parse(raw);
        if (CLOSE_ACTIONS.includes(json?.closeAction)) {
            closeAction = json.closeAction;
        }
    } catch {
        // 首次启动没有文件，用默认值
    }
}

function saveDesktopPrefs() {
    try {
        ensureDir(path.dirname(DESKTOP_PREFS_FILE));
        fs.writeFileSync(
            DESKTOP_PREFS_FILE,
            JSON.stringify({ closeAction }, null, 2),
            "utf8",
        );
    } catch (e) {
        console.error("[main] 保存桌面偏好失败", e);
    }
}

/* ------------------------------------------------------------------ */
/* MIME                                                               */
/* ------------------------------------------------------------------ */

const MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wma": "audio/x-ms-wma",
    ".ape": "audio/x-ape",
    ".lrc": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
};

function mimeOf(filePath) {
    return MIME_MAP[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/* ------------------------------------------------------------------ */
/* 协议注册                                                            */
/* ------------------------------------------------------------------ */

// 必须在 app ready 之前声明
protocol.registerSchemesAsPrivileged([
    {
        scheme: "fly",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        },
    },
    {
        scheme: "fly-media",
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: true,
            corsEnabled: true,
        },
    },
]);

/** 应用静态资源：fly://local/index.html */
function registerAppProtocol() {
    protocol.handle("fly", async request => {
        try {
            const url = new URL(request.url);
            let relativePath = decodeURIComponent(url.pathname);
            if (!relativePath || relativePath === "/") {
                relativePath = "/index.html";
            }
            const filePath = path.join(WEB_DIST, relativePath);
            // 防目录穿越
            if (!path.resolve(filePath).startsWith(path.resolve(WEB_DIST))) {
                return new Response("Forbidden", { status: 403 });
            }
            const data = await fsp.readFile(filePath);
            return new Response(data, {
                status: 200,
                headers: {
                    "Content-Type": mimeOf(filePath),
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch (e) {
            return new Response("Not Found", { status: 404 });
        }
    });
}

/** 本地媒体：fly-media://local?path=<绝对路径>，支持 Range 以便拖动进度 */
function registerMediaProtocol() {
    protocol.handle("fly-media", async request => {
        try {
            const url = new URL(request.url);
            const filePath = decodeURIComponent(url.searchParams.get("path") || "");
            if (!filePath) {
                return new Response("Bad Request", { status: 400 });
            }

            const stat = await fsp.stat(filePath);
            if (!stat.isFile()) {
                return new Response("Not Found", { status: 404 });
            }

            const size = stat.size;
            const type = mimeOf(filePath);
            const rangeHeader = request.headers.get("range");

            if (rangeHeader) {
                const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
                let start = match && match[1] ? parseInt(match[1], 10) : 0;
                let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
                if (Number.isNaN(start) || start >= size) {
                    return new Response(null, {
                        status: 416,
                        headers: { "Content-Range": `bytes */${size}` },
                    });
                }
                end = Math.min(end, size - 1);
                const stream = fs.createReadStream(filePath, { start, end });
                return new Response(Readable.toWeb(stream), {
                    status: 206,
                    headers: {
                        "Content-Type": type,
                        "Content-Length": String(end - start + 1),
                        "Content-Range": `bytes ${start}-${end}/${size}`,
                        "Accept-Ranges": "bytes",
                    },
                });
            }

            return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
                status: 200,
                headers: {
                    "Content-Type": type,
                    "Content-Length": String(size),
                    "Accept-Ranges": "bytes",
                },
            });
        } catch (e) {
            return new Response("Not Found", { status: 404 });
        }
    });
}

/* ------------------------------------------------------------------ */
/* 窗口                                                               */
/* ------------------------------------------------------------------ */

let mainWindow = null;

/** 把主窗口叫到前台（托盘单击 / 二次启动 / 任务栏点击） */
function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
    }
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
    mainWindow.focus();
}

/* ---------------- 系统托盘 ---------------- */

function resolveTrayIcon() {
    // PNG 兼容性最好，放在前面；ICO 作为高 DPI 兜底
    const candidates = [
        path.join(ASSET_DIR, "tray.png"),
        path.join(ASSET_DIR, "tray.ico"),
        path.join(ASSET_DIR, "icon.png"),
    ];
    for (const p of candidates) {
        try {
            const image = nativeImage.createFromPath(p);
            if (!image.isEmpty()) {
                const size = image.getSize();
                console.log(`[tray] icon=${path.basename(p)} ${size.width}x${size.height}`);
                return image;
            }
        } catch {}
    }
    return nativeImage.createEmpty();
}

function rebuildTrayMenu() {
    if (!tray) {
        return;
    }
    const menu = Menu.buildFromTemplate([
        {
            label: "显示主界面",
            click: () => showMainWindow(),
        },
        {
            label: "播放 / 暂停",
            click: () => mainWindow?.webContents.send("tray:toggle-play"),
        },
        {
            label: "下一首",
            click: () => mainWindow?.webContents.send("tray:next"),
        },
        { type: "separator" },
        {
            label: "退出 Fly音乐",
            click: () => {
                isQuitting = true;
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
}

function createTray() {
    if (tray) {
        return;
    }
    const icon = resolveTrayIcon();
    if (icon.isEmpty()) {
        console.warn("[tray] 图标加载失败，跳过托盘创建");
        return;
    }
    tray = new Tray(icon);
    tray.setToolTip("Fly音乐");
    tray.on("click", () => showMainWindow());
    tray.on("double-click", () => showMainWindow());
    rebuildTrayMenu();
    console.log("[tray] 托盘已创建");
}

/** 首次隐藏到托盘时不弹系统气泡 —— 用户是主动点「关闭」选择后台运行的，
 *  再弹一条「仍在后台运行」的通知反而打扰（需求：取消这个通知）。
 *  托盘图标本身就在任务栏常驻，可发现性足够。 */

function createWindow() {
    const windowIcon = path.join(ASSET_DIR, "icon.png");
    mainWindow = new BrowserWindow({
        // 默认窗口尺寸对齐桌面端设计基准 1064×753
        width: 1064,
        height: 753,
        minWidth: 960,
        minHeight: 640,
        frame: false, // 无边框，标题栏由前端自绘（与设计稿一致）
        backgroundColor: "#101213",
        show: false,
        autoHideMenuBar: true,
        title: "Fly音乐",
        icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            // 本地应用需要访问任意音源地址，关闭 webSecurity 以避免 CORS 拦截
            webSecurity: false,
            spellcheck: false,
            // 隐藏到托盘后窗口不可见，不能被 Chromium 降频，
            // 否则播放进度、定时器会被节流
            backgroundThrottling: false,
        },
    });

    Menu.setApplicationMenu(null);

    mainWindow.loadURL("fly://local/index.html");

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    const notifyMaximize = () => {
        mainWindow?.webContents.send(
            "win:maximized-changed",
            mainWindow.isMaximized(),
        );
    };
    mainWindow.on("maximize", notifyMaximize);
    mainWindow.on("unmaximize", notifyMaximize);

    // 外链走系统浏览器
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/.test(url)) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });

    // 关闭按钮：按设置决定「隐藏到托盘继续后台运行」还是「退出」
    mainWindow.on("close", event => {
        if (isQuitting) {
            return;
        }
        if (closeAction === "tray") {
            event.preventDefault();
            mainWindow.hide();
            console.log("[win] 关闭请求 → 隐藏到托盘，后台继续运行");
        } else {
            isQuitting = true;
            console.log("[win] 关闭请求 → 退出应用");
        }
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    // 把渲染进程的日志转发到主进程 stdout，便于命令行调试
    mainWindow.webContents.on(
        "console-message",
        (_event, level, message, line, sourceId) => {
            const tag = ["log", "warn", "error", "debug"][level] ?? "log";
            console.log(`[renderer:${tag}] ${message} (${sourceId}:${line})`);
        },
    );

    mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
        console.error(`[renderer] 页面加载失败 ${code} ${desc} ${url}`);
    });

    mainWindow.webContents.on("render-process-gone", (_e, details) => {
        console.error("[renderer] 渲染进程异常退出", details);
    });
}

/* ------------------------------------------------------------------ */
/* 网络请求代理：歌单解析专用                                          */
/* ------------------------------------------------------------------ */
/**
 * 渲染进程的 XHR 不允许设置 Referer / User-Agent / Cookie，且桌面端虽然关了
 * webSecurity，第三方接口仍可能因 Origin / 缺失请求头被风控。打包版排除了
 * node_modules，所以这里只用 Node 内置模块发请求，把响应文本交回渲染进程。
 * RN 原生端没有 flyHost，解析层会自动回落到 axios 直连。
 */
function decompressBody(buffer, encoding) {
    try {
        switch (String(encoding || "").toLowerCase()) {
            case "gzip":
                return zlib.gunzipSync(buffer);
            case "deflate":
                return zlib.inflateSync(buffer);
            case "br":
                return zlib.brotliDecompressSync(buffer);
            default:
                return buffer;
        }
    } catch {
        return buffer;
    }
}

function hostFetch(options, redirectLeft = 5) {
    return new Promise((resolve, reject) => {
        let target;
        try {
            target = new URL(options.url);
        } catch {
            reject(new Error("invalid url"));
            return;
        }
        if (target.protocol !== "http:" && target.protocol !== "https:") {
            reject(new Error("unsupported protocol"));
            return;
        }
        const mod = target.protocol === "https:" ? https : http;
        const headers = Object.assign({}, options.headers || {});
        const body = options.body || "";
        if (body && !Object.keys(headers).some(k => k.toLowerCase() === "content-length")) {
            headers["Content-Length"] = Buffer.byteLength(body);
        }
        const req = mod.request(
            {
                hostname: target.hostname,
                port: target.port || undefined,
                path: `${target.pathname}${target.search}`,
                method: String(options.method || "GET").toUpperCase(),
                headers,
            },
            res => {
                const status = res.statusCode || 0;
                if (
                    status >= 300 &&
                    status < 400 &&
                    res.headers.location &&
                    redirectLeft > 0
                ) {
                    res.resume();
                    const next = new URL(res.headers.location, target).toString();
                    hostFetch(
                        Object.assign({}, options, { url: next }),
                        redirectLeft - 1,
                    ).then(resolve, reject);
                    return;
                }
                const chunks = [];
                res.on("data", chunk => chunks.push(chunk));
                res.on("end", () => {
                    const buf = decompressBody(
                        Buffer.concat(chunks),
                        res.headers["content-encoding"],
                    );
                    resolve({
                        status,
                        headers: res.headers,
                        text: buf.toString("utf8"),
                        // 跟随 302 后的最终地址，QQ音乐 / 网易云短链靠它拿歌单 id
                        url: target.toString(),
                    });
                });
            },
        );
        const timeout = Math.min(
            Math.max(Number(options.timeout) || 12000, 1000),
            30000,
        );
        req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

/* ------------------------------------------------------------------ */
/* IPC：文件系统                                                       */
/* ------------------------------------------------------------------ */

function registerIpc() {
    ipcMain.on("app:paths", event => {
        event.returnValue = {
            appDataPath: STORAGE_ROOT,
            // 固定缓存目录（安装目录 / 只读时回退到用户数据目录）
            cacheRoot: CACHE_DIR,
            installPath: INSTALL_ROOT,
            networkCachePath: NETWORK_CACHE_PATH,
            tempPath: app.getPath("temp"),
            picturesPath: app.getPath("pictures"),
            // 系统「音乐」目录：下载默认落地在这里
            musicPath: app.getPath("music"),
            appVersion: APP_VERSION,
        };
    });

    ipcMain.handle("fs:exists", async (_e, { path: p }) => {
        try {
            await fsp.access(p);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle("fs:mkdir", async (_e, { path: p }) => {
        await fsp.mkdir(p, { recursive: true });
    });

    ipcMain.handle("fs:readDir", async (_e, { path: p }) => {
        const entries = await fsp.readdir(p, { withFileTypes: true });
        const result = [];
        for (const entry of entries) {
            const fullPath = path.join(p, entry.name);
            let stat = null;
            try {
                stat = await fsp.stat(fullPath);
            } catch {}
            result.push({
                name: entry.name,
                path: fullPath,
                size: String(stat?.size ?? 0),
                ctime: stat?.ctimeMs ?? null,
                mtime: stat?.mtimeMs ?? null,
                isFile: entry.isFile(),
                isDirectory: entry.isDirectory(),
            });
        }
        return result;
    });

    ipcMain.handle("fs:unlink", async (_e, { path: p }) => {
        const stat = await fsp.stat(p);
        if (stat.isDirectory()) {
            await fsp.rm(p, { recursive: true, force: true });
        } else {
            await fsp.unlink(p);
        }
    });

    ipcMain.handle("fs:writeFile", async (_e, { path: p, contents, encoding }) => {
        await fsp.mkdir(path.dirname(p), { recursive: true });
        const buffer =
            encoding === "base64"
                ? Buffer.from(contents, "base64")
                : Buffer.from(contents, "utf8");
        await fsp.writeFile(p, buffer);
    });

    ipcMain.handle("fs:readFile", async (_e, { path: p, encoding }) => {
        if (encoding === "base64") {
            const buffer = await fsp.readFile(p);
            return buffer.toString("base64");
        }
        return fsp.readFile(p, "utf8");
    });

    ipcMain.handle("fs:copyFile", async (_e, { from, to }) => {
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.copyFile(from, to);
    });

    ipcMain.handle("fs:moveFile", async (_e, { from, to }) => {
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await fsp.rename(from, to);
    });

    ipcMain.handle("fs:stat", async (_e, { path: p }) => {
        const stat = await fsp.stat(p);
        return {
            name: path.basename(p),
            path: p,
            size: String(stat.size),
            mode: stat.mode,
            mtime: stat.mtimeMs,
            ctime: stat.ctimeMs,
            originalFilepath: p,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
        };
    });

    /* ---------------- Chromium 网络缓存 ---------------- */

    /**
     * 桌面端音频是 HTMLAudioElement 流式播放、图片走 RNW Image，
     * 真实缓存落在 Chromium 的 HTTP Cache，而不是 pathConst 里那两个
     * 从来没被写入过的临时目录。设置页要显示/清理真实占用只能走 session。
     * 这只清网络缓存，不动 localStorage 里的 MediaCache 记录。
     */
    ipcMain.handle("cache:httpSize", async () => {
        try {
            return await session.defaultSession.getCacheSize();
        } catch {
            return 0;
        }
    });

    ipcMain.handle("cache:clearHttp", async () => {
        try {
            const before = await session.defaultSession.getCacheSize();
            await session.defaultSession.clearCache();
            const after = await session.defaultSession.getCacheSize();
            return { ok: true, removed: Math.max(0, before - after) };
        } catch {
            return { ok: false, removed: 0 };
        }
    });

    /* ---------------- 对话框 ---------------- */

    ipcMain.handle("dialog:openFiles", async (_e, options = {}) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: options.title ?? "选择文件",
            properties: options.multiple
                ? ["openFile", "multiSelections"]
                : ["openFile"],
            filters: options.filters ?? [],
        });
        if (result.canceled) {
            return [];
        }
        return result.filePaths;
    });

    /**
     * 原生「选择文件夹」对话框（Windows 资源管理器 UI）。
     * multiple = true 时允许一次选中多个文件夹，返回数组；否则返回单个路径字符串。
     */
    ipcMain.handle("dialog:openDirectory", async (_e, options = {}) => {
        const properties = ["openDirectory", "createDirectory"];
        if (options.multiple) {
            properties.push("multiSelections");
        }
        const result = await dialog.showOpenDialog(mainWindow, {
            title: options.title ?? "选择文件夹",
            buttonLabel: options.buttonLabel ?? "选择此文件夹",
            defaultPath: options.defaultPath,
            properties,
        });
        if (result.canceled || result.filePaths.length === 0) {
            return options.multiple ? [] : null;
        }
        return options.multiple ? result.filePaths : result.filePaths[0];
    });

    ipcMain.handle("dialog:saveFile", async (_e, options = {}) => {
        const result = await dialog.showSaveDialog(mainWindow, {
            title: options.title ?? "保存文件",
            defaultPath: options.defaultPath,
            filters: options.filters ?? [],
        });
        if (result.canceled || !result.filePath) {
            return null;
        }
        return result.filePath;
    });

    /* ---------------- 窗口控制 ---------------- */

    ipcMain.handle("win:minimize", () => {
        mainWindow?.minimize();
    });

    ipcMain.handle("win:toggleMaximize", () => {
        if (!mainWindow) {
            return false;
        }
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
        return mainWindow.isMaximized();
    });

    ipcMain.handle("win:close", () => {
        mainWindow?.close();
    });

    /**
     * 窗口底色跟随主题。
     *
     * 这是合成器的清屏色：任何一帧内容没画满（重排、层的重新栅格化），
     * 露出来的就是它。写死深色时浅色主题会闪一下黑，写死浅色则深色主题闪白，
     * 所以由渲染进程在主题变化时同步过来。
     */
    ipcMain.on("app:setBackgroundColor", (_e, color) => {
        if (typeof color !== "string" || !mainWindow?.isDestroyed?.()) {
            return;
        }
        if (!/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) {
            return;
        }
        mainWindow.setBackgroundColor(color);
    });

    /* ---------------- 托盘 / 后台运行 ---------------- */

    ipcMain.handle("win:getCloseAction", () => closeAction);

    ipcMain.handle("win:setCloseAction", (_e, action) => {
        if (!CLOSE_ACTIONS.includes(action)) {
            return closeAction;
        }
        closeAction = action;
        saveDesktopPrefs();
        console.log(`[win] 关闭行为已切换为 ${action}`);
        return closeAction;
    });

    /** 托盘菜单里的「显示主界面」等操作，渲染进程也可以主动让窗口回到前台 */
    ipcMain.handle("win:show", () => {
        showMainWindow();
    });

    ipcMain.handle("win:isMaximized", () => {
        return mainWindow?.isMaximized() ?? false;
    });

    ipcMain.handle("shell:openExternal", (_e, url) => {
        if (/^https?:/.test(url)) {
            shell.openExternal(url);
        }
    });

    ipcMain.handle("shell:showItemInFolder", (_e, p) => {
        shell.showItemInFolder(p);
    });

    /** 在资源管理器里打开某个目录（本地音乐的文件夹卡片用） */
    ipcMain.handle("shell:openPath", async (_e, p) => {
        if (!p) {
            return false;
        }
        try {
            const err = await shell.openPath(p);
            return !err;
        } catch {
            return false;
        }
    });

    // 歌单解析的网络代理：只返回文本，业务解析仍在渲染进程完成
    ipcMain.handle("net:request", async (_e, options) => {
        try {
            const r = await hostFetch(options || {});
            return {
                ok: true,
                status: r.status,
                text: r.text,
                headers: { location: r.headers.location || "" },
                finalUrl: r.url || (options && options.url) || "",
            };
        } catch (e) {
            return { ok: false, error: String((e && e.message) || e) };
        }
    });
}

/* ------------------------------------------------------------------ */
/* 生命周期                                                            */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        // 窗口可能被隐藏到托盘，二次启动要把它叫回来
        showMainWindow();
    });

    app.whenReady().then(() => {
        console.log(`[main] userData=${app.getPath("userData")}`);
        console.log(`[main] storage=${STORAGE_ROOT}`);
        console.log(`[main] cache=${CACHE_DIR}`);
        ensureDir(STORAGE_ROOT);
        ensureDir(path.join(STORAGE_ROOT, "data"));
        ensureDir(path.join(STORAGE_ROOT, "cache"));
        ensureDir(path.join(STORAGE_ROOT, "plugins"));
        ensureDir(path.join(STORAGE_ROOT, "log"));
        ensureDir(path.join(STORAGE_ROOT, "download"));
        ensureDir(path.join(STORAGE_ROOT, "local_lrc"));

        loadDesktopPrefs();
        console.log(`[main] closeAction=${closeAction}`);

        registerAppProtocol();
        registerMediaProtocol();
        registerIpc();
        createWindow();
        createTray();

        app.on("activate", () => {
            showMainWindow();
        });
    });

    // 托盘常驻时，关闭窗口不等于退出应用（closeAction=quit 时仍会退出）
    app.on("window-all-closed", () => {
        if (!tray || closeAction === "quit") {
            app.quit();
        }
    });

    // 无论从菜单还是托盘退出，都先打标记，避免 close 事件再拦一次
    app.on("before-quit", () => {
        isQuitting = true;
    });
}
