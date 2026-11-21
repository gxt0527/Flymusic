/**
 * react-native-image-picker 的 Web/Electron 实现
 *
 * Electron 下调用系统文件对话框；纯浏览器下退化为 <input type="file">。
 */
import { host } from "../host";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

function toMediaUri(path: string) {
    return `fly-media://local?path=${encodeURIComponent(path)}`;
}

function basename(path: string) {
    const parts = path.split(/[\\/]/);
    return parts[parts.length - 1];
}

function extOf(name: string) {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

const MIME_MAP: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
};

export async function launchImageLibrary(options?: any) {
    const selectionLimit = options?.selectionLimit ?? 1;

    if (host) {
        const files = await host.invoke<string[]>("dialog:openFiles", {
            title: options?.title ?? "选择图片",
            filters: [{ name: "图片", extensions: IMAGE_EXTENSIONS }],
            multiple: selectionLimit > 1,
        });
        if (!files || files.length === 0) {
            return { didCancel: true, assets: undefined };
        }
        return {
            didCancel: false,
            assets: files.map(path => ({
                uri: toMediaUri(path),
                fileName: basename(path),
                type: MIME_MAP[extOf(path)] ?? "image/*",
                originalPath: path,
            })),
        };
    }

    return pickFromInput(IMAGE_EXTENSIONS, selectionLimit);
}

export async function launchCamera(_options?: any) {
    return { didCancel: true, assets: undefined, errorCode: "camera_unavailable" };
}

function pickFromInput(extensions: string[], limit: number): Promise<any> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = extensions.map(e => `.${e}`).join(",");
        input.multiple = limit > 1;
        input.onchange = () => {
            const files = Array.from(input.files ?? []);
            if (files.length === 0) {
                resolve({ didCancel: true });
                return;
            }
            resolve({
                didCancel: false,
                assets: files.map(file => ({
                    uri: URL.createObjectURL(file),
                    fileName: file.name,
                    type: file.type,
                    fileSize: file.size,
                })),
            });
        };
        input.oncancel = () => resolve({ didCancel: true });
        input.click();
    });
}

export const ImagePicker = {
    launchImageLibrary,
    launchCamera,
};

export default ImagePicker;
