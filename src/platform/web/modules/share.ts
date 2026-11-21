/**
 * react-native-share 的 Web 实现
 *
 * 桌面端没有系统分享面板：优先走 navigator.share，
 * 其次把内容（链接/文本）复制到剪贴板。
 */
import Clipboard from "./clipboard";

interface IShareOptions {
    url?: string;
    message?: string;
    title?: string;
    type?: string;
    failOnCancel?: boolean;
    [key: string]: any;
}

const Share = {
    async open(options: IShareOptions) {
        const { url, message, title } = options ?? {};
        const payload = url || message || "";

        const nav: any = navigator;
        if (nav?.share) {
            try {
                await nav.share({ title, text: message, url });
                return { success: true };
            } catch (e) {
                // 用户取消或不受支持，落回剪贴板
            }
        }

        if (payload) {
            await Clipboard.setString(payload);
        }
        return { success: true, message: "已复制到剪贴板" };
    },
    async shareSingle(options: IShareOptions) {
        return Share.open(options);
    },
    isPackageInstalled: async () => false,
};

export default Share;
