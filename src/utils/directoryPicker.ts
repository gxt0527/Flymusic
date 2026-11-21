/**
 * 目录选择：桌面端走 Windows 原生资源管理器对话框。
 *
 * 之前「扫描本地音乐」一律跳进应用内的 `file-selector` 页 ——
 * 那套界面是给 Android 的文件系统写的（右侧复选框、底部通栏按钮、
 * 只能一级一级往上点，根目录时返回键是死的），在 Windows 上用起来很别扭。
 * Electron 主进程本来就有 `dialog:openDirectory`，这里包一层统一入口：
 *
 *   - 桌面（Electron）：弹系统对话框，返回用户确认的绝对路径数组；
 *   - 其它环境：返回 null，调用方自行回落到应用内文件选择页。
 */
import { invoke, isElectron } from "@/platform/web/host";

export interface IPickDirectoryOptions {
    title?: string;
    /** 确认按钮文案（Windows 上显示在对话框右下角） */
    buttonLabel?: string;
    defaultPath?: string;
    /** 允许一次选多个文件夹 */
    multiple?: boolean;
}

/** 当前环境是否有原生目录选择能力 */
export const hasNativeDirectoryPicker = isElectron;

/**
 * @returns 选中的路径数组；用户取消返回 `[]`；
 *          当前环境不支持（或对话框异常）返回 `null`
 */
export async function pickDirectory(
    options: IPickDirectoryOptions = {},
): Promise<string[] | null> {
    if (!isElectron) {
        return null;
    }
    try {
        const res = await invoke<string[] | string | null>(
            "dialog:openDirectory",
            options,
        );
        if (res === null || res === undefined) {
            return [];
        }
        const list = Array.isArray(res) ? res : [res];
        return list.filter(Boolean);
    } catch {
        return null;
    }
}

/** `C:\Music\Pop` → `Pop`（用于列表里的短名展示） */
export function folderName(path: string) {
    const segments = path.split(/[\\/]/).filter(Boolean);
    return segments.length ? segments[segments.length - 1] : path;
}
