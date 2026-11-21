/**
 * Electron / 浏览器 宿主桥接
 *
 * Electron 主进程通过 preload 注入 `globalThis.flyHost`，
 * 渲染进程（react-native-web）通过它访问文件系统、对话框、窗口控制等原生能力。
 * 纯浏览器环境下 `flyHost` 不存在，各 shim 会降级到内存实现。
 */

export interface FlyHostBridge {
    platform: "electron";
    /** 应用数据根目录，如 C:\Users\xxx\AppData\Roaming\FlyMusic */
    appDataPath: string;
    /** 固定缓存目录（安装目录下，安装目录只读时回退到用户数据目录） */
    cacheRoot: string;
    /** 应用安装目录（开发态为项目根目录） */
    installPath: string;
    /** Chromium 网络缓存目录（由 Electron 管理，不在固定缓存目录内） */
    networkCachePath: string;
    /** 系统临时目录 */
    tempPath: string;
    /** 用户图片目录 */
    picturesPath: string;
    /** 用户「音乐」目录（Windows 下载默认位置） */
    musicPath?: string;
    /** 应用版本号 */
    appVersion: string;
    invoke<T = any>(channel: string, payload?: any): Promise<T>;
    send(channel: string, payload?: any): void;
    /** 返回取消订阅函数 */
    on(channel: string, listener: (payload: any) => void): () => void;
}

export const host: FlyHostBridge | undefined = (globalThis as any).flyHost;

export const isElectron = !!host;

/** 调用主进程；无宿主时抛出可读错误 */
export async function invoke<T = any>(
    channel: string,
    payload?: any,
): Promise<T> {
    if (!host) {
        throw new Error(`[fly] 当前环境不支持 ${channel}（未运行在 Electron 中）`);
    }
    return host.invoke<T>(channel, payload);
}
