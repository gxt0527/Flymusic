import { Dimensions, Platform } from "react-native";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;
const minWindowEdge = Math.min(windowHeight, windowWidth);
const maxWindowEdge = Math.max(windowHeight, windowWidth);

/**
 * rpx 的设计基准是「750 宽的设计稿 = 屏幕短边」。
 *
 * 手机上短边 ≈ 375–430dp，这个换算成立；但桌面窗口短边动辄 800+，
 * 会把整个界面放大约 2 倍（字体巨大、间距松散）。
 *
 * 桌面端把基准压到 430：这个值让沿用 rpx 的旧组件几乎正好落回设计稿数值 ——
 *   rpx(32) 标题 ≈ 18px、rpx(26) 副标题 ≈ 15px、rpx(64) 搜索框 ≈ 37px、
 *   rpx(48) 页面留白 ≈ 28px、rpx(42) 图标 ≈ 24px。
 * 已经按设计稿重做的桌面组件全部用固定 px，不受这里影响。
 */
const baseEdge =
    Platform.OS === "web" ? Math.min(minWindowEdge, 430) : minWindowEdge;

export default function (rpx: number) {
    return (rpx / 750) * baseEdge;
}

export function vh(pct: number) {
    return (pct / 100) * Dimensions.get("window").height;
}

export function vw(pct: number) {
    return (pct / 100) * Dimensions.get("window").width;
}

export function vmin(pct: number) {
    return (pct / 100) * minWindowEdge;
}

export function vmax(pct: number) {
    return (pct / 100) * maxWindowEdge;
}

export function sh(pct: number) {
    return (pct / 100) * Dimensions.get("screen").height;
}

export function sw(pct: number) {
    return (pct / 100) * Dimensions.get("screen").width;
}
