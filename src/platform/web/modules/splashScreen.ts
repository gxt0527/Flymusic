/**
 * expo-splash-screen 的 Web 实现（桌面端无开屏页）
 */
export async function preventAutoHideAsync(): Promise<boolean> {
    return true;
}

export async function hideAsync(): Promise<boolean> {
    return true;
}

export async function hide(): Promise<void> {}

export function setOptions(_options?: any) {}

export default {
    preventAutoHideAsync,
    hideAsync,
    hide,
    setOptions,
};
