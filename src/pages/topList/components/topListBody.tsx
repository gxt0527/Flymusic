import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import PluginManager from "@/core/pluginManager";
import { TabBar, TabView } from "react-native-tab-view";
import { fontWeightConst } from "@/constants/uiConst";
import BoardPanelWrapper from "./boardPanelWrapper";
import useColors from "@/hooks/useColors";
import NoPlugin from "@/components/base/noPlugin";
import i18n from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";

export default function TopListBody() {
    const routes = PluginManager.getSortedPluginsWithAbility("getTopLists").map(_ => ({
        key: _.hash,
        title: _.name,
    }));
    const [index, setIndex] = useState(0);
    /** 与「推荐歌单」一致：点击立刻切换高亮与下划线，不等翻页动画结束 */
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => setActiveIndex(index), [index]);
    const colors = useColors();
    /** 桌面端不用 react-native-tab-view 自带的 TabBar：
     *  它在 web 下会把首个标签压成 30px（显示成「ku...」），
     *  改用和「推荐歌单」一致的自定义标签条 —— 高亮字 + 2px 主色下划线 */
    const isDesktop = useLayoutMode() !== "tab";

    const renderScene = useCallback(
        (props: { route: { key: string } }) => (
            <BoardPanelWrapper hash={props?.route?.key} />
        ),
        [],
    );

    if (!routes?.length) {
        return <NoPlugin notSupportType={i18n.t("topList.title")} />;
    }

    return (
        <TabView
            lazy
            navigationState={{
                index,
                routes,
            }}
            renderTabBar={props => {
                if (!isDesktop) {
                    return (
                        <TabBar
                            {...props}
                            style={styles.tabBarStyle}
                            tabStyle={styles.tabStyle}
                            scrollEnabled
                            inactiveColor={colors.text}
                            activeColor={colors.primary}
                            renderLabel={({ route, focused, color }) => (
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        width: rpx(160),
                                        fontWeight: focused
                                            ? fontWeightConst.bolder
                                            : fontWeightConst.medium,
                                        color,
                                        textAlign: "center",
                                    }}>
                                    {route.title}
                                </Text>
                            )}
                            indicatorStyle={{
                                backgroundColor: colors.primary,
                                height: rpx(4),
                            }}
                        />
                    );
                }
                return (
                    <View
                        testID="source-tabs"
                        style={[
                            styles.desktopTabs,
                            { borderBottomColor: colors.divider },
                        ]}>
                        {props.navigationState.routes.map((route, i) => {
                            const focused =
                                Math.min(
                                    activeIndex,
                                    props.navigationState.routes.length - 1,
                                ) === i;
                            return (
                                <Pressable
                                    key={route.key}
                                    testID={`source-tab-${i}`}
                                    onPress={() => {
                                        setActiveIndex(i);
                                        props.jumpTo(route.key);
                                    }}
                                    style={styles.desktopTab}>
                                    <Text
                                        testID={`source-tab-text-${i}`}
                                        numberOfLines={1}
                                        style={{
                                            fontSize: 14,
                                            lineHeight: 19,
                                            fontWeight: focused ? "500" : "400",
                                            color: focused
                                                ? colors.text
                                                : colors.textSecondary,
                                        }}>
                                        {route.title}
                                    </Text>
                                    {focused ? (
                                        <View
                                            testID="source-tab-underline"
                                            style={[
                                                styles.desktopUnderline,
                                                {
                                                    backgroundColor:
                                                        colors.primary,
                                                },
                                            ]}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                );
            }}
            renderScene={renderScene}
            onIndexChange={setIndex}
            initialLayout={{ width: rpx(750) }}
        />
    );
}

const styles = StyleSheet.create({
    tabBarStyle: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
        borderColor: "transparent",
    },
    tabStyle: {
        width: "auto",
    },
    /** 桌面：与列表同用 20 的左右边距；字号/间距与「推荐歌单」歌源条完全一致 */
    desktopTabs: {
        flexDirection: "row",
        gap: 26,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginHorizontal: 20,
        marginBottom: 4,
    },
    desktopTab: {
        paddingBottom: 11,
    },
    desktopUnderline: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        borderRadius: 2,
    },
});
