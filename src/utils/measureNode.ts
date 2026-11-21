/**
 * 取一个 Pressable/View 在窗口中的位置（视口坐标）。
 *
 * 桌面端（react-native-web / Electron）下 ref 就是真实 DOM 节点，
 * 用 getBoundingClientRect 能同步拿到精确位置，用来把浮层挂到按钮上；
 * 原生端 measureInWindow 是异步的，这里不做兜底，直接返回 undefined，
 * 调用方回退到原来的定位方式。
 */
export interface INodeRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export default function measureNodeRect(node: any): INodeRect | undefined {
    if (!node) {
        return undefined;
    }
    try {
        if (typeof node.getBoundingClientRect === "function") {
            const rect = node.getBoundingClientRect();
            if (rect?.width && rect?.height) {
                return {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height,
                };
            }
        }
    } catch {
        // 忽略：拿不到位置就走默认定位
    }
    return undefined;
}
