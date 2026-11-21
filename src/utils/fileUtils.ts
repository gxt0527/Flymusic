import pathConst from "@/constants/pathConst";
import MediaCache from "@/core/mediaCache";
import FastImage from "react-native-fast-image";
import RNFS, {
    PicturesDirectoryPath,
    copyFile,
    downloadFile,
    exists,
    mkdir,
    readDir,
    unlink,
    writeFile,
} from "react-native-fs";
import { errorLog } from "./log";
import path from "path-browserify";
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";

const galleryBasePath = `${PicturesDirectoryPath}/MusicFree/`;

/**
 * 将图片保存到相册
 * @param src 图片地址
 * @returns 保存后的文件路径
 */
export async function saveToGallery(src: string) {
    const fileName = `${galleryBasePath}${Date.now()}.png`;
    if (!(await exists(galleryBasePath))) {
        await mkdir(galleryBasePath);
    }
    if (await exists(src)) {
        try {
            await copyFile(src, fileName);
        } catch (e) {
            console.log("... ", e);
        }
    }
    if (src.startsWith("http")) {
        const { promise } = downloadFile({
            fromUrl: src,
            toFile: fileName,
            background: true,
        });
        await promise;
    }
    if (src.startsWith("data")) {
        await writeFile(fileName, src);
    }

    return fileName;
}

export function sizeFormatter(bytes: number | string) {
    if (typeof bytes === "string") {
        return bytes;
    }
    // 目录统计异常时可能是 NaN / Infinity / 负数，直接落到 "0B"，
    // 否则 Math.log 会算出 NaN 并把 "NaNundefined" 之类的鬼东西糊到界面上
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0B";
    }
    let k = 1024,
        sizes = ["B", "KB", "MB", "GB"],
        i = Math.min(
            sizes.length - 1,
            Math.floor(Math.log(bytes) / Math.log(k)),
        );
    return (bytes / Math.pow(k, i)).toFixed(1) + sizes[i];
}

export async function checkAndCreateDir(dirPath: string) {
    const filePath = dirPath;
    try {
        if (!(await exists(filePath))) {
            await mkdir(filePath);
        }
    } catch (e) {
        errorLog("无法初始化目录", { path: dirPath, e });
    }
}

async function getFolderSize(dirPath: string): Promise<number> {
    let size = 0;
    try {
        const fns = await readDir(dirPath);
        for (let fn of fns) {
            if (fn.isFile()) {
                /**
                 * Web / Electron 的 readDir 把 size 作为 **字符串** 返回，
                 * `size += fn.size` 会退化成字符串拼接：设置页「清除音乐缓存」
                 * 右侧那一大串数字（01495230419621…）就是几十个文件大小首尾
                 * 相接的结果，不是统计错误，是类型错误。
                 */
                const itemSize = Number(fn.size);
                if (Number.isFinite(itemSize) && itemSize > 0) {
                    size += itemSize;
                }
            }
            // todo: 可以改成并行 promise.all
            if (fn.isDirectory()) {
                size += await getFolderSize(fn.path);
            }
        }
    } catch (e) {
        // 目录还没被创建是正常状态；其它错误必须留痕，否则界面只会静默显示 0B
        if ((e as any)?.code !== "ENOENT") {
            errorLog("统计缓存目录失败", { dirPath, e });
        }
    }
    return size;
}

/**
 * 桌面端统一缓存目录（安装目录下的 FlyMusicCache）里的分工：
 *   · music/ 播放器缓存 + download/ 下载临时音频；
 *   · image/ 封面磁盘缓存；lyric/ 远程歌词缓存；
 *   · 用户导入的关联歌词、Chromium 网络缓存（音频流与图片共用）仍在
 *     用户数据目录：前者是数据不能随安装目录卸载，后者由 Electron 自管，
 *     两者都通过 session / 本地路径计入统计与清理。
 * 只统计原生播放器目录会长期显示 0B，清理也会变成空操作。
 */
function getHost():
    | { invoke?: (channel: string, payload?: any) => Promise<any> }
    | undefined {
    return (globalThis as any)?.flyHost;
}

async function getHttpCacheSize(): Promise<number> {
    const host = getHost();
    if (host?.invoke) {
        try {
            const size = Number(await host.invoke("cache:httpSize"));
            if (Number.isFinite(size) && size > 0) {
                return size;
            }
        } catch {}
    }
    // session 统计偶发返回 0（自定义 disk-cache-dir 后更常见），用目录实际占用兜底
    return pathConst.httpCachePath
        ? getFolderSize(pathConst.httpCachePath)
        : 0;
}

async function clearHttpCache(): Promise<boolean> {
    const host = getHost();
    if (!host?.invoke) {
        // 纯浏览器运行时没有 Electron session，不算清理失败
        return true;
    }
    try {
        const result = await host.invoke("cache:clearHttp");
        return result?.ok !== false;
    } catch {
        return false;
    }
}

export async function getCacheSize(
    type: "music" | "lyric" | "image",
): Promise<number> {
    if (type === "music") {
        const [player, download] = await Promise.all([
            getFolderSize(pathConst.musicCachePath),
            getFolderSize(pathConst.downloadCachePath),
        ]);
        return player + download;
    }
    if (type === "lyric") {
        const [lrc, local] = await Promise.all([
            getFolderSize(pathConst.lrcCachePath),
            getFolderSize(pathConst.localLrcPath),
        ]);
        return lrc + local;
    }
    if (type === "image") {
        const [disk, http] = await Promise.all([
            getFolderSize(pathConst.imageCachePath),
            getHttpCacheSize(),
        ]);
        return disk + http;
    }
    throw new Error();
}

/** 清空目录内容但保留目录本身，后续写入不必重新初始化 */
async function clearFolderContents(dirPath: string): Promise<boolean> {
    let items: any[];
    try {
        if (!(await exists(dirPath))) {
            return true;
        }
        items = await readDir(dirPath);
    } catch (e) {
        errorLog("读取缓存目录失败", { dirPath, e });
        return false;
    }
    let ok = true;
    for (const item of items) {
        try {
            if (item.isDirectory()) {
                if (!(await clearFolderContents(item.path))) {
                    ok = false;
                }
                // 空目录留着：原生 RNFS 的 unlink 删不了目录
            } else {
                await unlink(item.path);
            }
        } catch (e) {
            ok = false;
            errorLog("删除缓存文件失败", { path: item.path, e });
        }
    }
    return ok;
}

/** 返回 false 表示清理过程中有失败，界面不该无条件弹「清理成功」 */
export async function clearCache(
    type: "music" | "lyric" | "image",
): Promise<boolean> {
    if (type === "music") {
        const [player, download] = await Promise.all([
            clearFolderContents(pathConst.musicCachePath),
            clearFolderContents(pathConst.downloadCachePath),
        ]);
        return player && download;
    }
    if (type === "lyric") {
        const [lrc, local] = await Promise.all([
            clearFolderContents(pathConst.lrcCachePath),
            clearFolderContents(pathConst.localLrcPath),
        ]);
        try {
            // 记录里存着 .lrc 路径，不同步清掉会继续指向已删文件
            MediaCache.clearLyricCache();
        } catch (e) {
            errorLog("同步歌词缓存记录失败", e);
            return false;
        }
        return lrc && local;
    }
    if (type === "image") {
        const [disk, http] = await Promise.all([
            clearFolderContents(pathConst.imageCachePath),
            clearHttpCache(),
        ]);
        try {
            await FastImage.clearDiskCache();
        } catch {}
        return disk && http;
    }
    return false;
}

export function addFileScheme(fileName: string) {
    if (fileName.startsWith("/")) {
        return `file://${fileName}`;
    }
    return fileName;
}

export function addRandomHash(url: string) {
    if (url.indexOf("#") === -1) {
        return `${url}#${Date.now()}`;
    }
    return url;
}

export function trimHash(url: string) {
    const index = url.lastIndexOf("#");
    if (index === -1) {
        return url;
    }
    return url.substring(0, index);
}

export function escapeCharacter(str?: string) {
    return str !== undefined ? `${str}`.replace(/[/|\\?*"<>:]+/g, "_") : "";
}

export function getDirectory(dirPath: string) {
    const lastSlash = dirPath.lastIndexOf("/");
    if (lastSlash === -1) {
        return dirPath;
    }
    return dirPath.slice(0, lastSlash);
}

export function getFileName(filePath: string, withoutExt?: boolean) {
    // Windows 下路径是反斜杠，只找 "/" 会把整条绝对路径当成文件名，
    // 本地音乐在桌面端就会出现「歌名 = E:\Music\xxx.mp3」这种鬼东西
    const lastSlash = Math.max(
        filePath.lastIndexOf("/"),
        filePath.lastIndexOf("\\"),
    );
    if (lastSlash === -1) {
        return filePath;
    }
    let fileName = filePath.slice(lastSlash + 1);
    if (withoutExt) {
        const lastDot = fileName.lastIndexOf(".");
        fileName = lastDot === -1 ? fileName : fileName.slice(0, lastDot);
    }

    try {
        return decodeURIComponent(fileName);
    } catch {
        return fileName;
    }
}

export async function mkdirR(directory: string) {
    let folder = directory;
    const checkStack: string[] = [];
    while (folder.length > 15) {
        checkStack.push(folder);
        folder = path.dirname(folder);
    }
    let existPos = 0;
    for (let i = 0; i < checkStack.length; ++i) {
        const isExist = await exists(checkStack[i]);
        if (isExist) {
            existPos = i;
            break;
        }
    }

    for (let j = existPos - 1; j >= 0; --j) {
        try {
            await mkdir(checkStack[j]);
        } catch (e) {
            console.log("error", e);
        }
    }
}

export async function writeInChunks(
    filePath: string,
    data,
    chunkSize = 1024 * 1024 * 2,
) {
    let offset = 0;
    if (await exists(filePath)) {
        await unlink(filePath);
    }

    while (offset < data.length) {
        const chunk = data.slice(offset, offset + chunkSize);
        if (offset === 0) {
            await RNFS.writeFile(filePath, chunk, "utf8");
        } else {
            await RNFS.appendFile(filePath, chunk, "utf8");
        }
        offset += chunkSize;
    }
}


export function resolveImportedAssetOrPath(pathOrAsset: string | number | undefined) {
    return pathOrAsset === undefined
        ? undefined
        : typeof pathOrAsset === "string"
            ? pathOrAsset
            : resolveImportedAsset(pathOrAsset);
}

function resolveImportedAsset(id?: number) {
    return id
        ? (resolveAssetSource(id) as { uri: string } | null) ?? undefined
        : undefined;
}