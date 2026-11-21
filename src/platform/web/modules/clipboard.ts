/**
 * @react-native-clipboard/clipboard 的 Web 实现
 */
const Clipboard = {
    async setString(text: string) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
    },
    async getString() {
        try {
            return await navigator.clipboard.readText();
        } catch {
            return "";
        }
    },
    setStrings(_data: string[]) {},
    getImagePNG: async () => "",
    getImageJPG: async () => "",
    hasImage: async () => false,
    hasString: async () => true,
    addListener: () => ({ remove: () => void 0 }),
    removeAllListeners: () => void 0,
};

export default Clipboard;
