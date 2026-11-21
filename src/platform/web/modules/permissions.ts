/**
 * react-native-permissions 的 Web 实现
 *
 * 桌面端无运行时权限，一律返回 granted。
 */
export const PERMISSIONS = {
    ANDROID: {
        READ_EXTERNAL_STORAGE: "android.permission.READ_EXTERNAL_STORAGE",
        WRITE_EXTERNAL_STORAGE: "android.permission.WRITE_EXTERNAL_STORAGE",
        POST_NOTIFICATIONS: "android.permission.POST_NOTIFICATIONS",
    },
    IOS: {},
};

export async function check(_permission?: string): Promise<string> {
    return "granted";
}

export async function request(_permission?: string): Promise<string> {
    return "granted";
}

export async function checkMultiple(
    permissions: string[],
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const p of permissions ?? []) {
        result[p] = "granted";
    }
    return result;
}

export async function requestMultiple(
    permissions: string[],
): Promise<Record<string, string>> {
    return checkMultiple(permissions);
}

export async function openSettings(): Promise<void> {}
export const RESULTS = {
    UNAVAILABLE: "unavailable",
    DENIED: "denied",
    BLOCKED: "blocked",
    GRANTED: "granted",
    LIMITED: "limited",
};

export default {
    PERMISSIONS,
    RESULTS,
    check,
    request,
    checkMultiple,
    requestMultiple,
    openSettings,
};
