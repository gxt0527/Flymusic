import { Platform } from "react-native";
import RNFS, { CachesDirectoryPath } from "react-native-fs";

const isAndroid = Platform.OS === "android";

export const basePath = isAndroid
    ? RNFS.ExternalDirectoryPath
    : RNFS.DocumentDirectoryPath;

const host = (globalThis as any)?.flyHost as
    | {
          cacheRoot?: string;
          musicPath?: string;
          networkCachePath?: string;
      }
    | undefined;

/**
 * Windows / Electron：默认下载到系统「音乐」目录（主进程 app.getPath("music") 注入），
 * 而不是应用数据目录下的 download/music —— 用户下载完能在资源管理器里直接找到。
 * 移动端 / 纯浏览器仍沿用原来的沙箱路径。
 */
const systemMusicPath = host?.musicPath;

const defaultDownloadMusicPath = systemMusicPath
    ? `${systemMusicPath.replace(/\//g, "\\").replace(/\\+$/, "")}\\Fly音乐`
    : `${basePath}/download/music/`;

/**
 * 桌面端所有缓存收敛到主进程注入的固定目录（安装目录下的 FlyMusicCache），
 * 不再散落在系统临时目录、用户数据目录和 Chromium 默认缓存目录三处。
 * 移动端与纯浏览器没有宿主，保留上游的原生目录布局。
 */
const isDesktop = !isAndroid && !!host?.cacheRoot;

const desktopCacheRoot = isDesktop
    ? host!.cacheRoot!.replace(/\\/g, "/").replace(/\/+$/, "")
    : "";

function resolveCacheLayout() {
    if (isDesktop) {
        return {
            cachePath: `${desktopCacheRoot}/`,
            musicCachePath: `${desktopCacheRoot}/music/`,
            imageCachePath: `${desktopCacheRoot}/image/`,
            lrcCachePath: `${desktopCacheRoot}/lyric/`,
            downloadCachePath: `${desktopCacheRoot}/download/`,
            mmkvCachePath: `${desktopCacheRoot}/mmkv/`,
            // Chromium 自管的网络缓存：路径由主进程给出，供统计兜底
            httpCachePath: host?.networkCachePath ?? "",
        };
    }
    return {
        cachePath: `${basePath}/cache/`,
        musicCachePath: CachesDirectoryPath + "/TrackPlayer",
        imageCachePath: CachesDirectoryPath + "/image_manager_disk_cache",
        lrcCachePath: `${basePath}/cache/lrc/`,
        downloadCachePath: `${basePath}/cache/download/`,
        mmkvCachePath: `${basePath}/cache/mmkv`,
        httpCachePath: "",
    };
}

const cache = resolveCacheLayout();

export const cacheRoot = desktopCacheRoot || cache.cachePath;

export default {
    basePath,
    cacheRoot,
    ...cache,
    pluginPath: `${basePath}/plugins/`,
    logPath: `${basePath}/log/`,
    dataPath: `${basePath}/data/`,
    // 用户手动导入的关联歌词属于数据而非缓存：留在用户数据目录，
    // 安装目录在卸载 / 升级时会被清空，放过去会丢文件。
    localLrcPath: `${basePath}/local_lrc/`,
    downloadPath: `${basePath}/download/`,
    downloadMusicPath: defaultDownloadMusicPath,
    mmkvPath: `${basePath}/mmkv`,
};
