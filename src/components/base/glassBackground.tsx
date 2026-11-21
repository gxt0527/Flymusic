/**
 * 磨砂玻璃背景层（零新增依赖、跨端）
 *
 * Web / Electron：RN-Web 的 StyleSheet 会把未识别的 camelCase 属性原样 hyphenate
 * 成 CSS（backdropFilter -> backdrop-filter），因此这里直接用浏览器原生高斯模糊，
 * 不需要 expo-blur，也不需要重新编译 Android / iOS 工程。
 * 模糊作用在「播放条背后的内容」上，配合半透明底色即可透出下面的颜色。
 *
 * Native：RN 没有 backdrop-filter，退化为「半透明底色 + 上沿高光」，
 * 靠玻璃色本身的透明度透出底下的页面底色。
 *
 * 用法：作为播放条 wrapper 的**第一个**子元素渲染（wrapper 需 overflow: hidden），
 * 后面再渲染真正的内容；wrapper 自身的 backgroundColor 由 glassColor() 半透明化。
 */
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Color from "color";

interface IGlassBackgroundProps {
    /** 播放条原本的不透明底色 */
    baseColor: string;
    /** 是否深色主题（影响高光与饱和度） */
    dark: boolean;
    /** Web 端高斯模糊半径，单位 px */
    blur?: number;
}

/**
 * 把不透明底色转成半透明色。
 * transparency 越大越透；下限 0.08 留给「几乎全透」的桌面播放条，
 * 对比度由背后更强的 backdrop blur 和高光描边补回来。
 * 移动端传 0.56（alpha 0.44）不受下限影响，桌面端用 0.9（alpha 0.1）。
 */
export function glassColor(baseColor: string, transparency = 0.5) {
    const alpha = Math.min(0.92, Math.max(0.08, 1 - transparency));
    return Color(baseColor).alpha(alpha).toString();
}

/**
 * Web / Electron 专用的真实 backdrop blur，Native 返回空对象。
 * 也可用于进度条这类细条：给较小的 blur 与独立的饱和度即可。
 */
export function webBackdropBlur(
    blur = 38,
    dark = true,
    saturation?: number,
): any {
    if (Platform.OS !== "web") {
        return {};
    }
    const sat = saturation ?? (dark ? 1.85 : 1.5);
    return {
        backdropFilter: `blur(${blur}px) saturate(${sat})`,
    };
}

export default function GlassBackground(props: IGlassBackgroundProps) {
    const { baseColor, dark, blur = 38 } = props;

    return (
        <View
            pointerEvents="none"
            style={[styles.layer, webBackdropBlur(blur, dark)]}>
            {/* 极淡的主色蒙版，避免纯透明时控件浮在背景上显得散 */}
            <View
                style={[
                    styles.tint,
                    {
                        backgroundColor: Color(baseColor)
                            .alpha(0.035)
                            .toString(),
                    },
                ]}
            />
            {/* 玻璃上沿高光：底色越透，边缘高光越要明显 */}
            <View
                style={[
                    styles.highlight,
                    {
                        backgroundColor: dark
                            ? "rgba(255,255,255,0.17)"
                            : "rgba(255,255,255,0.9)",
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    layer: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        overflow: "hidden",
    },
    tint: {        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    highlight: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: StyleSheet.hairlineWidth,
    },
});
