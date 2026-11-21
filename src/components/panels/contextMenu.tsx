/**
 * Windows 11 风格菜单（浮层通用基座）
 *
 * 桌面上所有「点一下弹出来的列表」都走这里：右键菜单、⋮ 菜单、
 * 音质 / 倍速 / 字号这类选择菜单。参照 Win11 原生规格，而不是把移动端
 * 抽屉缩一缩：
 *   · 外壳 8px 圆角 / 4px 内边距 / 1px 描边 / 大范围柔和投影
 *   · 行高 32，圆角 4，悬停只给极淡的一层填充
 *   · 图标 15 单色线稿（随文字色走），与文字间距 10
 *   · 勾选项的勾占据行首图标位（Win11 把勾放在行首，而不是行尾）
 *   · 分组之间一条两侧内缩的细线，靠上下 4px 留白隔开
 *   · 可选的组标题（Sort by 那种小节名），比行文字更小更淡
 *
 * 定位不测量 DOM：行高固定，菜单高度可以直接算出来，先算位置再绘制，
 * 不会出现「先画在错的地方再跳一下」。鼠标右键贴着指针右下展开，
 * 贴边时向内收；挂在按钮上时优先向下，放不下翻到上方。
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import Icon, { IIconName } from "@/components/base/icon";
import { useTokens } from "@/theme";
import type { IPanelAnchor } from "./anchor";

/** 行高 / 组标题 / 分隔线占位 / 外壳内边距，与样式里的数值必须一致 */
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 28;
const SEPARATOR_BLOCK = 9;
const SHELL_PADDING = 4;
/** 菜单离窗口边缘的最小距离 */
const EDGE = 8;
/** 右键时菜单左上角相对指针的偏移 */
const CURSOR_OFFSET = 2;
/** 挂在按钮上时与按钮的间距 */
const ANCHOR_GAP = 4;

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : null;

/**
 * 没有锚点时退回「贴着指针展开」。面板是从按钮的 onPress 里 showPanel 出来的，
 * 拿不到事件对象时指针就在触发按钮上，位置和 Win11 里键盘唤出菜单一致。
 */
const pointer = { x: 0, y: 0 };
if (isWeb) {
    window.addEventListener(
        "mousemove",
        (e: MouseEvent) => {
            pointer.x = e.clientX;
            pointer.y = e.clientY;
        },
        { passive: true },
    );
}

export interface IContextMenuItem {
    key: string;
    label: string;
    icon?: IIconName;
    /** 右侧灰色补充文字（文件大小、快捷键等） */
    hint?: string;
    /** 当前选中项：行首显示勾 */
    checked?: boolean;
    /** 不可用：文字转灰、不响应悬停与点击 */
    disabled?: boolean;
    /** 在本项之前画一条分组细线（第一项不画） */
    divider?: boolean;
    show?: boolean;
    /** 点完不收起（字号这种要边调边看效果的） */
    keepOpen?: boolean;
    onPress?: () => void;
}

interface IContextMenuProps {
    /** 展开位置：width/height 为 0 视为鼠标位置；不传则贴右下角 */
    anchor?: IPanelAnchor;
    items: IContextMenuItem[];
    /** 菜单顶部的组标题（音质、倍速这类需要说明来源的菜单） */
    title?: string;
    /** 菜单宽度，Windows 菜单在 240~300 之间 */
    width?: number;
    /**
     * 强制深色。播放页是常驻深色画面（黑底 + 封面模糊），
     * 浅色主题下菜单跟着变白会像贴上去的一张纸，所以由页面自己声明。
     */
    dark?: boolean;
    /** 冒烟测试锚点 */
    testID?: string;
    onClose: () => void;
}

export interface IMenuSkin {
    surface: string;
    border: string;
    hover: string;
    divider: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    accent: string;
    shadowOpacity: number;
}

/**
 * 菜单配色。默认跟随主题；forceDark 用于常驻深色的页面（播放页），
 * 那种页面上浅色菜单会像贴上去的一张白纸。
 */
export function useMenuSkin(forceDark?: boolean): IMenuSkin {
    const t = useTokens();
    const dark = forceDark ?? t.isDark;

    return useMemo(() => {
        if (dark) {
            return {
                surface: "#2B2B2B",
                border: "rgba(255,255,255,0.09)",
                hover: "rgba(255,255,255,0.06)",
                divider: "rgba(255,255,255,0.08)",
                textPrimary: "#FFFFFF",
                textSecondary: "#9A9A9A",
                textTertiary: "#6E6E6E",
                accent: t.color.primary.bright,
                shadowOpacity: 0.44,
            };
        }
        return {
            surface: "#FFFFFF",
            border: "rgba(0,0,0,0.10)",
            hover: "rgba(0,0,0,0.05)",
            divider: t.color.divider,
            textPrimary: t.color.text.primary,
            textSecondary: t.color.text.secondary,
            textTertiary: t.color.text.tertiary,
            accent: t.color.primary.base,
            shadowOpacity: 0.16,
        };
    }, [dark, t]);
}

export default function ContextMenu(props: IContextMenuProps) {
    const { anchor, items, title, width = 256, dark, testID, onClose } = props;
    const win = useWindowDimensions();
    const menuRef = useRef<any>(null);

    const visible = useMemo(
        () => items.filter(item => item.show !== false),
        [items],
    );
    const separatorCount = visible.filter(
        (item, index) => item.divider && index > 0,
    ).length;

    const headerHeight = title ? HEADER_HEIGHT : 0;
    const contentHeight =
        visible.length * ROW_HEIGHT + separatorCount * SEPARATOR_BLOCK;
    const limit = Math.max(
        ROW_HEIGHT * 4,
        win.height - EDGE * 2 - SHELL_PADDING * 2 - headerHeight,
    );
    const listHeight = Math.min(contentHeight, limit);
    const menuHeight = listHeight + headerHeight + SHELL_PADDING * 2;
    const scrollable = contentHeight > listHeight;

    const { left, top } = useMemo(() => {
        const ax = anchor?.x ?? pointer.x;
        const ay = anchor?.y ?? pointer.y;
        const aw = anchor?.width ?? 0;
        const ah = anchor?.height ?? 0;
        const isCursor = aw === 0 && ah === 0;

        let x: number;
        let y: number;

        if (isCursor) {
            /** 右键：从指针右下方展开，右边/下边放不下就翻到指针的左侧/上方 */
            x = ax + CURSOR_OFFSET;
            y = ay + CURSOR_OFFSET;
            if (y + menuHeight > win.height - EDGE) {
                y = ay - menuHeight - CURSOR_OFFSET;
            }
            if (x + width > win.width - EDGE) {
                x = ax - width - CURSOR_OFFSET;
            }
        } else {
            /** 挂在按钮上：靠右半边就右对齐展开，下方放不下就翻到上方 */
            x = ax + aw / 2 >= win.width / 2 ? ax + aw - width : ax;
            y = ay + ah + ANCHOR_GAP;
            if (y + menuHeight > win.height - EDGE) {
                y = ay - menuHeight - ANCHOR_GAP;
            }
        }

        x = Math.max(EDGE, Math.min(x, win.width - EDGE - width));
        y = Math.max(EDGE, Math.min(y, win.height - EDGE - menuHeight));
        return { left: x, top: y };
    }, [anchor, win.width, win.height, width, menuHeight]);

    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withTiming(1, {
            duration: 110,
            easing: Easing.out(Easing.quad),
        });
    }, []);

    const appear = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: 0.98 + progress.value * 0.02 }],
    }));

    /**
     * Esc 关闭；滚轮滚到菜单外面（底下列表被滚走）时也关 —— 系统菜单同样行为。
     * 事件挂在 window 上，且用 capture：底下列表自己会吞掉滚轮。
     */
    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        const onWheel = (e: any) => {
            const node = menuRef.current as any;
            if (
                node &&
                e?.target &&
                typeof node.contains === "function" &&
                node.contains(e.target)
            ) {
                return;
            }
            onClose();
        };
        const onBlur = () => onClose();

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("wheel", onWheel, {
            capture: true,
            passive: true,
        });
        window.addEventListener("blur", onBlur);
        window.addEventListener("resize", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("wheel", onWheel, true);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("resize", onBlur);
        };
    }, [onClose]);

    const maskRef = useRef<any>(null);
    /** RN 的 Pressable 没有 onContextMenu：右键拦截层要直接挂原生事件 */
    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node = maskRef.current as any;
        if (!node?.addEventListener) {
            return;
        }
        const onContext = (e: any) => {
            e?.preventDefault?.();
            onClose();
        };
        node.addEventListener("contextmenu", onContext);
        return () => node.removeEventListener("contextmenu", onContext);
    }, [onClose]);

    const skin = useMenuSkin(dark);

    return (
        <View style={style.layer} pointerEvents="box-none">
            {/* 透明拦截层：点空白处关闭，同时挡住下层列表的悬停 */}
            <Pressable
                ref={maskRef}
                style={StyleSheet.absoluteFill}
                onPress={onClose}
            />

            <Animated.View
                ref={menuRef}
                testID={testID}
                style={[
                    style.menu,
                    {
                        width,
                        left,
                        top,
                        backgroundColor: skin.surface,
                        borderColor: skin.border,
                        shadowOpacity: skin.shadowOpacity,
                    },
                    appear,
                ]}>
                {title ? (
                    <Text
                        numberOfLines={1}
                        style={[
                            style.header,
                            { color: skin.textTertiary },
                        ]}>
                        {title}
                    </Text>
                ) : null}
                <ScrollView
                    bounces={false}
                    showsVerticalScrollIndicator={scrollable}
                    style={[style.scroll, { height: listHeight }]}>
                    {visible.map((item, index) => (
                        <React.Fragment key={item.key}>
                            {item.divider && index > 0 ? (
                                <View
                                    style={[
                                        style.separator,
                                        { backgroundColor: skin.divider },
                                    ]}
                                />
                            ) : null}
                            <MenuRow
                                item={item}
                                skin={skin}
                                onClose={onClose}
                            />
                        </React.Fragment>
                    ))}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

interface IMenuRowProps {
    item: IContextMenuItem;
    skin: IMenuSkin;
    onClose: () => void;
}

function MenuRow(props: IMenuRowProps) {
    const { item, skin, onClose } = props;
    const [hovered, setHovered] = useState(false);
    const disabled = !!item.disabled || !item.onPress;

    /** 勾优先占行首：Win11 的选中项就是把图标换成勾 */
    const leading = item.checked ? "check" : item.icon;
    const leadingColor = disabled
        ? skin.textTertiary
        : item.checked
            ? skin.accent
            : hovered
                ? skin.textPrimary
                : skin.textSecondary;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.label}
            disabled={disabled}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPress={() => {
                if (disabled) {
                    return;
                }
                /**
                 * 先收菜单再执行：后续 showPanel 才能拿到干净状态。
                 * 边调边看效果的项（字号）例外。
                 */
                if (!item.keepOpen) {
                    onClose();
                }
                item.onPress?.();
            }}
            style={[
                style.row,
                !disabled && webCursor,
                hovered && !disabled && { backgroundColor: skin.hover },
            ]}>
            <View style={style.iconBox}>
                {leading ? (
                    <Icon
                        name={leading as IIconName}
                        size={15}
                        color={leadingColor}
                    />
                ) : null}
            </View>
            <Text
                numberOfLines={1}
                style={[
                    style.label,
                    { color: disabled ? skin.textTertiary : skin.textPrimary },
                ]}>
                {item.label}
            </Text>
            {item.hint ? (
                <Text
                    numberOfLines={1}
                    style={[style.hint, { color: skin.textTertiary }]}>
                    {item.hint}
                </Text>
            ) : null}
        </Pressable>
    );
}

const style = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 15040,
    },
    menu: {
        position: "absolute",
        padding: SHELL_PADDING,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: "#000000",
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    header: {
        height: HEADER_HEIGHT,
        paddingHorizontal: 8,
        fontSize: 11.5,
        lineHeight: 16,
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    scroll: {
        flexGrow: 0,
    },
    row: {
        height: ROW_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    iconBox: {
        width: 15,
        marginRight: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    label: {
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 18,
        includeFontPadding: false,
    },
    hint: {
        marginLeft: 12,
        fontSize: 11.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 8,
        marginVertical: 4,
    },
});
