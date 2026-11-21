/**
 * 浮层锚点：把触发按钮的窗口坐标交给 PanelBase，让菜单贴着按钮展开。
 *
 * RN-Web 的 onPress 拿到的就是原生 DOM 事件（没有 nativeEvent 包装），
 * 直接用 currentTarget.getBoundingClientRect() 即可得到视口坐标；
 * 原生端没有这套 API，返回 undefined，PanelBase 会退回默认定位。
 */

export interface IPanelAnchor {
    /** 视口坐标 */
    x: number;
    y: number;
    width: number;
    height: number;
}

export function getPressAnchor(e?: unknown): IPanelAnchor | undefined {
    try {
        const el = ((e as any)?.currentTarget ??
            (e as any)?.target) as DOMElement | undefined;
        if (el && typeof el.getBoundingClientRect === "function") {
            const b = el.getBoundingClientRect();
            if (b.width > 0 && b.height > 0) {
                return {
                    x: b.x,
                    y: b.y,
                    width: b.width,
                    height: b.height,
                };
            }
        }
    } catch {
        // 原生端：无 DOM 事件对象，走默认定位
    }
    return undefined;
}

interface DOMElement {
    getBoundingClientRect: () => {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}
