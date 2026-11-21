/**
 * Compact 形态（手机竖屏 < 600dp）的底部 Tab，只放 4 个高频入口：
 * 首页 / 推荐 / 收藏 / 本地。最近播放与听歌排行只在侧栏出现。
 */
import React, { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import NavItem from "./navItem";
import { INavItem, TAB_ITEMS } from "./navConfig";

interface IBottomTabProps {
    activeKey: string;
    onSelect: (item: INavItem) => void;
}

function BottomTab(props: IBottomTabProps) {
    const { activeKey, onSelect } = props;
    const t = useTokens();
    const { t: translate } = useI18N();

    return (
        <View
            style={[
                style.wrapper,
                {
                    height: t.size.tabBar,
                    backgroundColor: t.color.bg.overlay,
                    borderTopColor: t.color.divider,
                },
            ]}>
            {TAB_ITEMS.map(item => (
                <NavItem
                    key={item.key}
                    icon={item.icon}
                    iconActive={item.iconActive}
                    label={translate(item.labelKey)}
                    active={activeKey === item.key}
                    stacked
                    onPress={() => onSelect(item)}
                />
            ))}
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});

export default memo(BottomTab);
