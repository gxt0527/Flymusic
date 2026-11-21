/**
 * expo-file-system 的 Web/Electron 实现
 *
 * 复用 fs shim 的底层能力，补齐 expo 的 URI 语义。
 */
import {
    copyFile,
    exists,
    mkdir,
    moveFile,
    readdir,
    readFile,
    stat,
    unlink,
    writeFile,
} from "./fs";

function normalizeUri(uri: string): string {
    if (!uri) {
        return "";
    }
    if (uri.startsWith("file://")) {
        let path = decodeURIComponent(uri.replace(/^file:\/\//, ""));
        // Windows 下 file:///C:/xxx 会解析成 /C:/xxx
        if (/^\/[A-Za-z]:/.test(path)) {
            path = path.slice(1);
        }
        return path.replace(/\//g, "\\");
    }
    return uri;
}

export const documentDirectory = "";
export const cacheDirectory = "";

export async function copyAsync(options: { from: string; to: string }) {
    await copyFile(normalizeUri(options.from), normalizeUri(options.to));
}

export async function moveAsync(options: { from: string; to: string }) {
    await moveFile(normalizeUri(options.from), normalizeUri(options.to));
}

export async function deleteAsync(
    uri: string,
    options?: { idempotent?: boolean },
) {
    const path = normalizeUri(uri);
    if (await exists(path)) {
        await unlink(path);
        return;
    }
    if (!options?.idempotent) {
        throw new Error(`文件不存在: ${uri}`);
    }
}

export async function getInfoAsync(uri: string) {
    const path = normalizeUri(uri);
    if (!(await exists(path))) {
        return {
            exists: false,
            isDirectory: false,
            uri,
        };
    }
    const info = await stat(path);
    return {
        exists: true,
        isDirectory: info.isDirectory(),
        uri,
        size: Number(info.size ?? 0),
        modificationTime: info.mtime,
    };
}

export async function readAsStringAsync(
    uri: string,
    options?: { encoding?: string },
) {
    const encoding = options?.encoding === "base64" ? "base64" : "utf8";
    return readFile(normalizeUri(uri), encoding as any);
}

export async function writeAsStringAsync(
    uri: string,
    contents: string,
    options?: { encoding?: string },
) {
    const encoding = options?.encoding === "base64" ? "base64" : "utf8";
    await writeFile(normalizeUri(uri), contents, encoding as any);
}

export async function makeDirectoryAsync(
    uri: string,
    _options?: { intermediates?: boolean },
) {
    await mkdir(normalizeUri(uri));
}

export async function readDirectoryAsync(uri: string) {
    return readdir(normalizeUri(uri));
}

export const EncodingType = {
    UTF8: "utf8",
    Base64: "base64",
};

export default {
    documentDirectory,
    cacheDirectory,
    copyAsync,
    moveAsync,
    deleteAsync,
    getInfoAsync,
    readAsStringAsync,
    writeAsStringAsync,
    makeDirectoryAsync,
    readDirectoryAsync,
    EncodingType,
};
