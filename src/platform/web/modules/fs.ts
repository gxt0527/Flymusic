/**
 * react-native-fs 的 Web/Electron 实现
 *
 * 路径策略：业务数据用主进程注入的 appDataPath，缓存统一用固定目录
 * cacheRoot（安装目录下的 FlyMusicCache），避免虚拟路径反复映射。
 * 纯浏览器下退化为内存文件系统。
 */
import { host, invoke, isElectron } from "../host";

const dataRoot = host?.appDataPath ?? "/FlyMusic";
const tempRoot = host?.tempPath ?? "/tmp";
const picturesRoot = host?.picturesPath ?? "/Pictures";
const cacheRoot = host?.cacheRoot ?? `${dataRoot}/FlyMusicCache`;

export const DocumentDirectoryPath = dataRoot;
export const ExternalDirectoryPath = dataRoot;
export const ExternalStorageDirectoryPath = dataRoot;
export const PicturesDirectoryPath = picturesRoot;
export const CachesDirectoryPath = cacheRoot;
export const TemporaryDirectoryPath = tempRoot;
export const MainBundlePath = dataRoot;
export const DownloadsDirectoryPath = `${dataRoot}/download`;

export interface ReadDirItem {
    ctime: Date | null;
    mtime: Date | null;
    name: string;
    path: string;
    size: string;
    isFile: () => boolean;
    isDirectory: () => boolean;
}

export interface StatResult {
    name: string;
    path: string;
    size: string;
    mode: number;
    mtime: number;
    ctime: number;
    originalFilepath: string;
    isFile: () => boolean;
    isDirectory: () => boolean;
}

/* ------------------------------------------------------------------ */
/* 浏览器降级：内存文件系统                                             */
/* ------------------------------------------------------------------ */

const memFs = new Map<string, string>();

function memToStat(path: string): StatResult {
    const isDir = [...memFs.keys()].some(
        k => k === path || k.startsWith(path + "/"),
    );
    const content = memFs.get(path) ?? "";
    return {
        name: path.split(/[\\/]/).pop() ?? path,
        path,
        size: String(content.length),
        mode: 0,
        mtime: Date.now(),
        ctime: Date.now(),
        originalFilepath: path,
        isFile: () => !isDir,
        isDirectory: () => isDir,
    };
}

/* ------------------------------------------------------------------ */
/* 基础操作                                                             */
/* ------------------------------------------------------------------ */

export async function exists(path: string): Promise<boolean> {
    if (!path) {
        return false;
    }
    if (isElectron) {
        return invoke<boolean>("fs:exists", { path });
    }
    return memFs.has(path) || memToStat(path).isDirectory();
}

export async function mkdir(
    path: string,
    _options?: { NSURLIsExcludedFromBackupKey?: boolean },
): Promise<void> {
    if (isElectron) {
        await invoke("fs:mkdir", { path });
    }
}

export async function readDir(path: string): Promise<ReadDirItem[]> {
    if (isElectron) {
        const list = await invoke<any[]>("fs:readDir", { path });
        return (list ?? []).map(item => ({
            ...item,
            ctime: item.ctime ? new Date(item.ctime) : null,
            mtime: item.mtime ? new Date(item.mtime) : null,
            isFile: () => !!item.isFile,
            isDirectory: () => !!item.isDirectory,
        }));
    }
    const prefix = path.endsWith("/") ? path : path + "/";
    return [...memFs.keys()]
        .filter(k => k.startsWith(prefix))
        .map(k => ({
            name: k.slice(prefix.length),
            path: k,
            size: String((memFs.get(k) ?? "").length),
            ctime: new Date(),
            mtime: new Date(),
            isFile: () => true,
            isDirectory: () => false,
        }));
}

export async function readdir(path: string): Promise<string[]> {
    const items = await readDir(path);
    return items.map(it => it.name);
}

export async function unlink(path: string): Promise<void> {
    if (isElectron) {
        await invoke("fs:unlink", { path });
        return;
    }
    memFs.delete(path);
}

export async function writeFile(
    path: string,
    contents: string,
    encoding: "utf8" | "base64" | "ascii" = "utf8",
): Promise<void> {
    if (isElectron) {
        await invoke("fs:writeFile", { path, contents, encoding });
        return;
    }
    memFs.set(path, contents);
}

export async function readFile(
    path: string,
    encoding: "utf8" | "base64" | "ascii" = "utf8",
): Promise<string> {
    if (isElectron) {
        return invoke<string>("fs:readFile", { path, encoding });
    }
    const content = memFs.get(path);
    if (content === undefined) {
        throw new Error(`文件不存在: ${path}`);
    }
    return content;
}

export async function copyFile(from: string, to: string): Promise<void> {
    if (isElectron) {
        await invoke("fs:copyFile", { from, to });
        return;
    }
    const content = memFs.get(from);
    if (content !== undefined) {
        memFs.set(to, content);
    }
}

export async function moveFile(from: string, to: string): Promise<void> {
    if (isElectron) {
        await invoke("fs:moveFile", { from, to });
        return;
    }
    const content = memFs.get(from);
    if (content !== undefined) {
        memFs.set(to, content);
        memFs.delete(from);
    }
}

export async function stat(path: string): Promise<StatResult> {
    if (isElectron) {
        const res = await invoke<any>("fs:stat", { path });
        return {
            ...res,
            isFile: () => !!res.isFile,
            isDirectory: () => !!res.isDirectory,
        };
    }
    return memToStat(path);
}

export async function getAllExternalFilesDirs(): Promise<string[]> {
    return [dataRoot];
}

/* ------------------------------------------------------------------ */
/* 下载                                                                 */
/* ------------------------------------------------------------------ */

interface IDownloadOptions {
    fromUrl: string;
    toFile: string;
    headers?: Record<string, string>;
    background?: boolean;
    progress?: (res: {
        jobId: number;
        contentLength: number;
        bytesWritten: number;
    }) => void;
}

let downloadSeq = 0;

export function downloadFile(options: IDownloadOptions) {
    const jobId = ++downloadSeq;
    const controller = new AbortController();

    const promise = (async () => {
        const response = await fetch(options.fromUrl, {
            headers: options.headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`下载失败 HTTP ${response.status}`);
        }
        const total = Number(response.headers.get("content-length") || 0);
        const chunks: Uint8Array[] = [];
        let written = 0;

        const reader = response.body?.getReader();
        if (reader) {
             
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    chunks.push(value);
                    written += value.length;
                    options.progress?.({
                        jobId,
                        contentLength: total,
                        bytesWritten: written,
                    });
                }
            }
        }

        const merged = new Uint8Array(written);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        // 转 base64 后写盘
        let binary = "";
        const block = 0x8000;
        for (let i = 0; i < merged.length; i += block) {
            binary += String.fromCharCode(
                ...Array.from(merged.subarray(i, i + block)),
            );
        }
        await writeFile(options.toFile, btoa(binary), "base64");

        return {
            jobId,
            statusCode: response.status,
            bytesWritten: written,
        };
    })();

    return {
        jobId,
        promise,
        stop: () => controller.abort(),
    };
}

/** 读取一个本地文件为 data URI（音频/图片自动推断 MIME） */
export async function readFileAsDataUri(path: string): Promise<string> {
    const base64 = await readFile(path, "base64");
    return base64;
}

const RNFS = {
    DocumentDirectoryPath,
    ExternalDirectoryPath,
    ExternalStorageDirectoryPath,
    PicturesDirectoryPath,
    CachesDirectoryPath,
    TemporaryDirectoryPath,
    MainBundlePath,
    DownloadsDirectoryPath,
    exists,
    mkdir,
    readDir,
    readdir,
    unlink,
    writeFile,
    readFile,
    copyFile,
    moveFile,
    stat,
    getAllExternalFilesDirs,
    downloadFile,
};

export default RNFS;
