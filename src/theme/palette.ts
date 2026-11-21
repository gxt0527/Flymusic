/**
 * 语义色板 —— 设计的核心不是色值本身，而是「层级只用三档背景明度表达」。
 *
 * 两套基线（深/浅）是固定的；只有 primary 及其派生色跟随
 * 用户在「主题自定义」里选的主色，保证老的 20 色配置仍然生效。
 */
import Color from "color";

import { CustomizedColors } from "@/hooks/useColors";

export interface IPalette {
    mode: "dark" | "light";

    bg: {
        /** App 最外层（窗口底色，侧栏之外） */
        canvas: string;
        /** 内容区底色 */
        base: string;
        /** 侧栏、面板、卡片这类"抬起来"的表面 */
        raised: string;
        /** 底部播放条、Tab 栏 */
        overlay: string;
        /** 输入框、搜索框 */
        input: string;
        /** hover / 按下 */
        hover: string;
        /** 选中态（列表行） */
        active: string;
    };

    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        /** 主色按钮上的文字 */
        onPrimary: string;
    };

    primary: {
        base: string;
        press: string;
        /** 主色的低透明度填充，用于 chip、选中背景 */
        soft: string;
        /** 比主色亮一档，用于深色背景上的图标，避免被光晕吃掉 */
        bright: string;
    };

    divider: string;
    border: string;
    /** 弹窗蒙层 */
    scrim: string;
    skeleton: string;
    shadow: string;

    like: string;
    success: string;
    danger: string;
    info: string;

    /** 磨砂玻璃层：白色渐变 + 高光描边 */
    glass: {
        fillTop: string;
        fillMid: string;
        fillBottom: string;
        stroke: string;
        highlight: string;
    };

    /** 主色光晕：设计稿实测为均匀 alpha 0.25 主色 + 图标处一点高光 */
    glow: {
        /** 选中项底色（铺满整个胶囊） */
        fill: string;
        /** 图标附近的额外亮部，向外淡出 */
        center: string;
        /** 亮部的中间衰减点 */
        mid: string;
    };
}

function alpha(color: string, value: number) {
    return Color(color).alpha(value).toString();
}

/** 深色基线：三档背景明度 #101213 → #1F2122 → #2A2A2A */
const darkBase = {
    canvas: "#101213",
    base: "#1F2122",
    raised: "#2A2A2A",
    overlay: "#232627",
    input: "#34383B",
    hover: "#3A3A3A",
    active: "rgba(255,255,255,0.07)",
    text: "#FFFFFF",
    textSecondary: "#9A9A9A",
    textTertiary: "#6E6E6E",
    divider: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.10)",
    scrim: "rgba(0,0,0,0.55)",
    skeleton: "rgba(255,255,255,0.06)",
    shadow: "#000000",
    onPrimary: "#07231A",
    like: "#FF4D6A",
    success: "#4CC38A",
    danger: "#F26D6D",
    info: "#4FA9D8",
    glassTop: "rgba(255,255,255,0.06)",
    glassMid: "rgba(255,255,255,0.055)",
    glassBottom: "rgba(255,255,255,0.05)",
    glassStroke: "rgba(255,255,255,0.09)",
    glassHighlight: "rgba(255,255,255,0.10)",
} as const;

/**
 * 浅色基线：底比卡亮一档，靠 material 的明度差 + border 分层，不用投影。
 *
 * 卡片不再是纯白 #FFFFFF：大面积纯白在浅色主题里是最亮的一块，
 * 切换页面时任何一帧没画上内容都会和这块亮色产生反差（深色主题下反过来是
 * 暗块），观感就是「屏幕闪一下」。压到 #F2F3F4 后整页最高亮度降下来，
 * 与底色 #FAFAFA 仍有可辨的层次，靠 border 也能看清边界。
 */
const lightBase = {
    canvas: "#EDEFF0",
    base: "#FAFAFA",
    raised: "#F2F3F4",
    overlay: "#FFFFFF",
    input: "#EFEFEF",
    hover: "rgba(0,0,0,0.05)",
    active: "rgba(0,0,0,0.06)",
    text: "#1A1A1A",
    textSecondary: "#6B6B6B",
    textTertiary: "#9E9E9E",
    divider: "rgba(0,0,0,0.08)",
    border: "rgba(0,0,0,0.06)",
    scrim: "rgba(0,0,0,0.30)",
    skeleton: "rgba(0,0,0,0.05)",
    shadow: "#000000",
    onPrimary: "#FFFFFF",
    like: "#E33B5C",
    success: "#1FA97C",
    danger: "#E5484D",
    info: "#0A7FB8",
    glassTop: "rgba(255,255,255,0.72)",
    glassMid: "rgba(255,255,255,0.55)",
    glassBottom: "rgba(255,255,255,0.42)",
    glassStroke: "rgba(0,0,0,0.06)",
    glassHighlight: "rgba(255,255,255,0.90)",
} as const;

/** 深色主色 #5DD3A9 / 浅色 #1FA97C —— 浅色下压暗一档保证 4.5:1 对比度 */
export const DEFAULT_PRIMARY_DARK = "#5DD3A9";
export const DEFAULT_PRIMARY_LIGHT = "#1FA97C";

export function buildPalette(
    colors: Partial<CustomizedColors>,
    dark: boolean,
): IPalette {
    const b = dark ? darkBase : lightBase;
    const primary =
        colors.primary ?? (dark ? DEFAULT_PRIMARY_DARK : DEFAULT_PRIMARY_LIGHT);

    return {
        mode: dark ? "dark" : "light",
        bg: {
            canvas: b.canvas,
            base: b.base,
            raised: b.raised,
            overlay: b.overlay,
            input: b.input,
            hover: b.hover,
            active: b.active,
        },
        text: {
            primary: colors.text ?? b.text,
            secondary: b.textSecondary,
            tertiary: b.textTertiary,
            onPrimary: b.onPrimary,
        },
        primary: {
            base: primary,
            press: Color(primary).darken(0.12).toString(),
            soft: alpha(primary, dark ? 0.16 : 0.12),
            bright: dark ? Color(primary).lighten(0.22).toString() : primary,
        },
        divider: b.divider,
        border: b.border,
        scrim: b.scrim,
        skeleton: b.skeleton,
        shadow: b.shadow,
        like: b.like,
        success: b.success,
        danger: b.danger,
        info: b.info,
        glass: {
            fillTop: b.glassTop,
            fillMid: b.glassMid,
            fillBottom: b.glassBottom,
            stroke: b.glassStroke,
            highlight: b.glassHighlight,
        },
        glow: {
            /**
             * 设计稿逐点采样：选中项左/中/右/上/下五处的合成色都对应
             * 主色 alpha 0.22–0.25（那点"亮部"其实是图标本身），
             * 所以底色是均匀的，不需要大跨度渐变。
             */
            fill: alpha(primary, dark ? 0.25 : 0.13),
            center: alpha(primary, dark ? 0.12 : 0.06),
            mid: alpha(primary, 0),
        },
    };
}
