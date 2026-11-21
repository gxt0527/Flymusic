/**
 * 导航项：侧栏与底部 Tab 共用。
 *
 * 选中态是三层叠加（见 docs/ui-implementation-plan.md §1.5）：
 *  1. 玻璃底 —— 半透明白 + 1px 高光描边
 *  2. 主色光晕 —— Svg 径向/线性渐变，左右各溢出 8dp，形成"发散"
 *  3. 图标 —— 换成实心版本，颜色提亮一档（否则会被绿雾吃掉）
 *
 * RN 里没有 backdrop-filter / filter:blur，这里用「渐变 + 溢出」模拟，
 * 侧栏背后是纯色面板，真模糊看不出差别；等播放页浮层需要透出封面时再引入 expo-blur。
 */
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import Icon, { IIconName } from "@/components/base/icon";
import { useTokens } from "@/theme";

export interface INavItemProps {
    icon: IIconName;
    iconActive: IIconName;
    label: string;
    active: boolean;
    /** 图标栏形态：只显示图标，居中 */
    iconOnly?: boolean;
    /** 底部 Tab 形态：图标在上、文字在下 */
    stacked?: boolean;
    onPress: () => void;
    onLongPress?: () => void;
}

function NavItem(props: INavItemProps) {
    const { icon, iconActive, label, active, iconOnly, stacked, onPress, onLongPress } =
        props;
    const t = useTokens();

    const iconColor = active ? t.color.primary.bright : t.color.text.secondary;
    const iconSize = iconOnly || stacked ? t.size.iconLg : t.size.icon;

    const main = (
        <>
            <Icon name={active ? iconActive : icon} size={iconSize} color={iconColor} />
            {iconOnly ? null : (
                <Text
                    numberOfLines={1}
                    style={[
                        stacked ? style.tabLabel : style.label,
                        {
                            fontSize: stacked ? t.font.badge.size : t.font.nav.size,
                            lineHeight: stacked ? t.font.badge.lineHeight : t.font.nav.lineHeight,
                            fontWeight: active ? "500" : t.font.nav.weight,
                            color: active ? t.color.text.primary : t.color.text.secondary,
                        },
                    ]}>
                    {label}
                </Text>
            )}
        </>
    );

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={({ pressed }) => [
                stacked ? style.tab : style.item,
                !stacked && {
                    height: t.size.navItem,
                    borderRadius: t.size.navItemRadius,
                },
                iconOnly && style.itemIconOnly,
                active && {
                    borderRadius: iconOnly
                        ? t.size.navItemRadius + 3
                        : t.size.navItemRadius,
                },
                pressed && !active && { backgroundColor: t.color.bg.hover },
            ]}>
            {active ? (
                /**
                 * 选中态 = 均匀主色底（设计稿实测 alpha 0.25）+ 图标处一点外扩高光 + 磨砂白。
                 * 不做「溢出容器的高斯模糊」：RN 没有 filter:blur，溢出的渐变边缘 alpha 仍高，
                 * 会在邻项区域露出方形色块。这里用圆角裁剪，光晕边界就是胶囊边界 —— 与设计稿一致。
                 */
                <View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        {
                            borderRadius: iconOnly
                                ? t.size.navItemRadius + 3
                                : t.size.navItemRadius,
                            overflow: "hidden",
                            backgroundColor: t.color.glow.fill,
                        },
                    ]}>
                    {/* 图标附近的亮部，向外淡出 —— 这是"光从图标发散"的唯一来源 */}
                    <Svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none">
                        <Defs>
                            <RadialGradient id="navGlow" cx="12%" cy="46%" r="58%">
                                <Stop offset="0" stopColor={t.color.glow.center} />
                                <Stop offset="0.6" stopColor={t.color.glow.mid} />
                                <Stop offset="1" stopColor={t.color.glow.mid} />
                            </RadialGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100" height="100" fill="url(#navGlow)" />
                    </Svg>
                    {/* 磨砂玻璃 + 高光描边 */}
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                backgroundColor: t.color.glass.fillMid,
                                borderWidth: t.glass.borderWidth,
                                borderColor: t.color.glass.stroke,
                            },
                        ]}
                    />
                </View>
            ) : null}
            {main}
        </Pressable>
    );
}

const style = StyleSheet.create({
    item: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 10,
        borderWidth: 0,
        overflow: "visible",
    },
    itemIconOnly: {
        width: 44,
        paddingHorizontal: 0,
        justifyContent: "center",
    },
    label: {
        flexShrink: 1,
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 6,
    },
    tabLabel: {
        textAlign: "center",
    },
});

export default memo(NavItem);
