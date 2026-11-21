/**
 * expo-document-picker 的 Web/Electron 实现
 */
import { host } from "../host";

const MIME_MAP: Record<string, string> = {
    js: "application/javascript",
    json: "application/json",
    txt: "text/plain",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    aac: "audio/aac",
    lrc: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
};

function extOf(name: string) {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function basename(path: string) {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1];
}

interface IGetDocumentOptions {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
}

function parseExtensions(type?: string | string[]): string[] {
    if (!type) {
        return ["*"];
    }
    const list = Array.isArray(type) ? type : [type];
    const exts: string[] = [];
    for (const item of list) {
        if (item === "*/*" || item === "*") {
            return ["*"];
        }
        if (item.startsWith(".")) {
            exts.push(item.slice(1));
        } else {
            // 形如 application/javascript，反查扩展名
            const found = Object.keys(MIME_MAP).filter(k => MIME_MAP[k] === item);
            if (found.length > 0) {
                exts.push(...found);
            }
        }
    }
    return exts.length > 0 ? exts : ["*"];
}

export async function getDocumentAsync(options?: IGetDocumentOptions) {
    const extensions = parseExtensions(options?.type);
    const multiple = options?.multiple ?? false;

    if (host) {
        const files = await host.invoke<string[]>("dialog:openFiles", {
            title: "选择文件",
            filters:
                extensions[0] === "*"
                    ? []
                    : [{ name: "支持的格式", extensions }],
            multiple,
        });
        if (!files || files.length === 0) {
            return { canceled: true, assets: null };
        }
        return {
            canceled: false,
            assets: files.map(path => ({
                uri: `fly-media://local?path=${encodeURIComponent(path)}`,
                name: basename(path),
                mimeType: MIME_MAP[extOf(path)] ?? "application/octet-stream",
                size: 0,
                originalPath: path,
            })),
        };
    }

    return pickFromInput(extensions, multiple);
}

function pickFromInput(extensions: string[], multiple: boolean): Promise<any> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        if (extensions[0] !== "*") {
            input.accept = extensions.map(e => `.${e}`).join(",");
        }
        input.multiple = multiple;
        input.onchange = () => {
            const files = Array.from(input.files ?? []);
            if (files.length === 0) {
                resolve({ canceled: true, assets: null });
                return;
            }
            resolve({
                canceled: false,
                assets: files.map(file => ({
                    uri: URL.createObjectURL(file),
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                })),
            });
        };
        input.oncancel = () => resolve({ canceled: true, assets: null });
        input.click();
    });
}

export const DocumentPicker = {
    getDocumentAsync,
};

export default DocumentPicker;
