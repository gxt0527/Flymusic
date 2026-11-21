/**
 * 宽屏侧栏（Expanded 200dp / Medium 收起为 76dp 图标栏）。
 *
 * 信息架构：
 *   首页 · 推荐歌单 · 听歌排行
 *   ──────── 分割线 ────────
 *   我的收藏 · 本地音乐 · 最近播放
 *
 * 底部不放用户区 —— 本 App 无登录体系，数据全部本地存储。
 * 插件管理不再常驻侧栏（顶栏齿轮 → 设置页左侧「插件管理」同样可达）。
 */
import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";

import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import NavItem from "./navItem";
import { INavItem, NAV_GROUPS } from "./navConfig";

interface ISidebarProps {
    activeKey: string;
    onSelect: (item: INavItem) => void;
    /** 收起为图标栏 */
    collapsed?: boolean;
}

function Sidebar(props: ISidebarProps) {
    const { activeKey, onSelect, collapsed } = props;
    const t = useTokens();
    const { t: translate } = useI18N();

    return (
        <View
            style={[
                style.wrapper,
                {
                    width: collapsed ? t.size.rail : t.size.sidebar,
                    backgroundColor: t.color.bg.raised,
                },
                collapsed && style.wrapperCollapsed,
            ]}>
            {/* 品牌区只留应用图标（去掉文字）：水平居中，上下留白与左右留白
                取同一个值，视觉上图标四周的间距是一致的 */}
            <View style={[style.brand, collapsed && style.brandCollapsed]}>
                <Image
                    testID="brand-logo"
                    source={ImgAsset.logo}
                    style={[
                        collapsed ? style.brandLogoCollapsed : style.brandLogo,
                        // 展开态整体左移 15px（图标栏保持居中，否则会明显偏左）
                        !collapsed && style.brandLogoShift,
                    ]}
                    resizeMode="contain"
                />
            </View>

            {/* 导航分组整体下移 20：品牌图标与第一项之间留出呼吸空间 */}
            <View style={style.navGroups}>
                {NAV_GROUPS.map((group, groupIndex) => (
                    <React.Fragment key={`nav-group-${groupIndex}`}>
                        {/* 分割线放在分组之外：group 上有 gap，放进来会被额外撑开 */}
                        {groupIndex > 0 ? (
                            <View
                                style={[
                                    style.split,
                                    { backgroundColor: t.color.divider },
                                ]}
                            />
                        ) : null}
                        <View style={style.group}>
                            {group.map(item => (
                                <NavItem
                                    key={item.key}
                                    icon={item.icon}
                                    iconActive={item.iconActive}
                                    label={translate(item.labelKey)}
                                    active={activeKey === item.key}
                                    iconOnly={collapsed}
                                    onPress={() => onSelect(item)}
                                />
                            ))}
                        </View>
                    </React.Fragment>
                ))}
            </View>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 12,
        paddingTop: 18,
        paddingBottom: 14,
    },
    wrapperCollapsed: {
        paddingHorizontal: 8,
        alignItems: "center",
    },
    brand: {
        alignItems: "center",
        justifyContent: "center",
        // 图标四周留白取同一值，视觉上四边间距一致
        padding: 12,
        marginTop: 8,
    },
    brandCollapsed: {
        paddingHorizontal: 0,
        justifyContent: "center",
    },
    /** 分组整体再下移 20px：上沿 paddingTop 之外单独给，不影响品牌区 */
    navGroups: {
        paddingTop: 20,
    },
    /** 分类项之间加大间距（每项高度 36，这里再留 8 的缝） */
    group: {
        gap: 8,
    },
    brandLogo: {
        width: 40,
        height: 40,
        borderRadius: 10,
    },
    /** 首页左上角 logo 左移，与侧栏左缘对齐（展开态） */
    brandLogoShift: {
        transform: [{ translateX: -30 }],
    },
    brandLogoCollapsed: {
        width: 32,
        height: 32,
        borderRadius: 8,
    },
    split: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 10,
        marginTop: 10,
        marginBottom: 12,
    },
});

export default memo(Sidebar);
