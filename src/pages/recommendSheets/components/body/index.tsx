import NoPlugin from "@/components/base/noPlugin";
import { useLayoutMode } from "@/components/layout";
import { fontWeightConst } from "@/constants/uiConst";
import { useI18N } from "@/core/i18n";
import PluginManager from "@/core/pluginManager";
import useColors from "@/hooks/useColors";
import rpx, { vw } from "@/utils/rpx";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TabBar, TabView } from "react-native-tab-view";
import SheetBody from "./sheetBody";

export default function Body() {
    const [index, setIndex] = useState(0);
    /**
     * TabView 的 onIndexChange 要等翻页动画结束才回调，导致下划线要「慢半拍」才挪过去。
     * 这里单独维护一个「视觉索引」：点击时立刻切换高亮 + 下划线，动画结束后再跟真实索引对齐。
     */
    const [activeIndex, setActiveIndex] = useState(0);
    useEffect(() => setActiveIndex(index), [index]);
    const colors = useColors();
    const layoutMode = useLayoutMode();
    const isDesktop = layoutMode !== "tab";
    const routes = PluginManager.getSortedPluginsWithAbility("getRecommendSheetsByTag").map(
        _ => ({
            key: _.hash,
            title: _.name,
        }),
    );
    const { t } = useI18N();

    const renderTabBar = (_: any) => {
        // 桌面：设计稿的下划线 Tab（白字选中 + 2px 主色下划线），不用 Android 的滑动指示器
        if (isDesktop) {
            return (
                <View
                    testID="source-tabs"
                    style={[
                        styles.desktopTabs,
                        { borderBottomColor: colors.divider },
                    ]}>
                    {_.navigationState.routes.map((route: any, i: number) => {
                        const focused =
                            Math.min(activeIndex, _.navigationState.routes.length - 1) === i;
                        return (
                            <Pressable
                                key={route.key}
                                testID={`source-tab-${i}`}
                                onPress={() => {
                                    setActiveIndex(i);
                                    _.jumpTo(route.key);
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
                                    {route.title ?? `(${t("common.unknownName")})`}
                                </Text>
                                {focused ? (
                                    <View
                                        testID="source-tab-underline"
                                        style={[
                                            styles.desktopUnderline,
                                            { backgroundColor: colors.primary },
                                        ]}
                                    />
                                ) : null}
                            </Pressable>
                        );
                    })}
                </View>
            );
        }
        return (
            <TabBar
                {..._}
                scrollEnabled
                style={{
                    backgroundColor: "transparent",
                    shadowColor: "transparent",
                    borderColor: "transparent",
                }}
                tabStyle={{
                    width: "auto",
                }}
                pressColor="transparent"
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
                        {route.title ?? `(${t("common.unknownName")})`}
                    </Text>
                )}
                indicatorStyle={{
                    backgroundColor: colors.primary,
                    height: rpx(4),
                }}
            />
        );
    };

    if (!routes?.length) {
        return <NoPlugin notSupportType={t("recommendSheet.title")} />;
    }
    return (
        <TabView
            lazy
            navigationState={{
                index,
                routes,
            }}
            renderTabBar={renderTabBar}
            renderScene={props => {
                return <SheetBody hash={props.route.key} />;
            }}
            onIndexChange={setIndex}
            initialLayout={{ width: vw(100) }}
        />
    );
}

const styles = StyleSheet.create({
    desktopTabs: {
        flexDirection: "row",
        gap: 26,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginHorizontal: 20,
        // 分类条自己带上/下间距，这里归零，避免两段留白叠加
        marginBottom: 0,
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
