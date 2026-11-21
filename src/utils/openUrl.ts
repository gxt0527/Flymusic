import { Linking } from "react-native";
import Toast from "./toast";

export default async function openUrl(url: string) {
    try {
        const host = (globalThis as any)?.flyHost;
        // Electron 里 window.open 可能被拦截，走主进程的 shell.openExternal 更可靠
        if (host?.invoke && /^https?:/.test(url)) {
            await host.invoke("shell:openExternal", url);
            return;
        }
        await Linking.canOpenURL(url);
        return Linking.openURL(url);
    } catch {
        Toast.warn("无法打开链接");
    }
}
