import React from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import AppBar from "@/components/base/appBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import Icon, { IIconName } from "@/components/base/icon";
import StatusBar from "@/components/base/statusBar";
import { useLayoutMode } from "@/components/layout";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { useTokens } from "@/theme";
import SettingDesktop from "./desktop";
import settingTypes from "./settingTypes";

/** 设置子页的唯一清单：分栏导航与路由参数都从这里取 */
const ALL_SECTIONS: Array<{
    key: string;
    i18nKey: string;
    icon: IIconName;
}> = [
    { key: "basic", i18nKey: "sidebar.basicSettings", icon: "cog-8-tooth" },
    {
        key: "plugin",
        i18nKey: "sidebar.pluginManagement",
        icon: "puzzle-piece",
    },
    { key: "theme", i18nKey: "sidebar.themeSettings", icon: "t-shirt-outline" },
    {
        key: "backup",
        i18nKey: "sidebar.backupAndResume",
        icon: "arrow-down-tray",
    },
    { key: "about", i18nKey: "common.about", icon: "information-circle" },
];

/** Windows 端没有本地备份/恢复能力，这一栏直接不显示 */
const SECTIONS =
    Platform.OS === "web"
        ? ALL_SECTIONS.filter(section => section.key !== "backup")
        : ALL_SECTIONS;

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface ISectionNavProps {
    active: string;
    onSelect: (key: string) => void;
    /** 宽屏：左侧竖栏；窄屏：顶部横向 chips */
    vertical: boolean;
}

function SectionNav({ active, onSelect, vertical }: ISectionNavProps) {
    const { t } = useI18N();
    const tokens = useTokens();

    const items = SECTIONS.map(section => {
        const selected = section.key === active;
        return (
            <Pressable
                key={section.key}
                accessibilityRole="button"
                accessibilityLabel={t(section.i18nKey as any)}
                onPress={() => onSelect(section.key)}
                style={({ pressed }) => [
                    vertical ? styles.sideItem : styles.tabItem,
                    webCursor,
                    !selected && !vertical
                        ? { backgroundColor: tokens.color.bg.input }
                        : null,
                    selected
                        ? {
                            backgroundColor: vertical
                                ? tokens.color.bg.active
                                : tokens.color.primary.base,
                        }
                        : null,
                    pressed && { opacity: 0.75 },
                ]}>
                {vertical && selected ? (
                    <View
                        style={[
                            styles.sideIndicator,
                            { backgroundColor: tokens.color.primary.base },
                        ]}
                    />
                ) : null}
                <Icon
                    name={section.icon}
                    size={17}
                    color={
                        selected && !vertical
                            ? tokens.color.text.onPrimary
                            : selected
                                ? tokens.color.primary.base
                                : tokens.color.text.secondary
                    }
                />
                <Text
                    numberOfLines={1}
                    style={[
                        styles.navLabel,
                        vertical ? styles.sideLabel : styles.tabLabel,
                        {
                            color:
                                selected && !vertical
                                    ? tokens.color.text.onPrimary
                                    : selected
                                        ? tokens.color.text.primary
                                        : tokens.color.text.secondary,
                        },
                    ]}>
                    {t(section.i18nKey as any)}
                </Text>
            </Pressable>
        );
    });

    return vertical ? (
        <View
            style={[
                styles.sideNav,
                { borderRightColor: tokens.color.divider },
            ]}>
            {items}
        </View>
    ) : (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[
                styles.tabBar,
                { borderBottomColor: tokens.color.divider },
            ]}
            contentContainerStyle={styles.tabBarContent}>
            {items}
        </ScrollView>
    );
}

function MobileSetting() {
    // 桌面端可能直接打开 setting 而未带参数（深链/自动化），给个兜底避免整页崩溃
    const params = useParams<"setting">();
    const rawType = params?.type ?? "basic";
    // 桌面端隐藏了「备份与恢复」，深链/历史参数带 type=backup 时回退到基本设置
    const type =
        Platform.OS === "web" && rawType === "backup" ? "basic" : rawType;
    const settingItem = settingTypes[type] ?? settingTypes.basic;

    const { t } = useI18N();
    const navigation = useNavigation<any>();
    // 600–840dp 是图标栏形态，再塞一列左栏会挤掉内容，只在 >=840dp 分栏
    const vertical = useLayoutMode() === "sidebar";

    const onSelect = (key: string) => {
        if (key === type) {
            return;
        }
        // 同一路由内切参数，不往导航栈里堆新页面
        navigation.setParams({ type: key });
    };

    return (
        <SafeAreaView edges={["bottom", "top"]} style={styles.wrapper}>
            <StatusBar />
            <View style={[styles.body, vertical && styles.bodyRow]}>
                <SectionNav
                    active={type}
                    onSelect={onSelect}
                    vertical={vertical}
                />
                <View style={styles.main}>
                    {settingItem.showNav === false ? null : (
                        <AppBar>{t(settingItem.i18nKey as any)}</AppBar>
                    )}
                    {type === "plugin" ? (
                        <View style={styles.pluginBody}>
                            <settingItem.component />
                        </View>
                    ) : (
                        <HorizontalSafeAreaView style={styles.wrapper}>
                            {/* 桌面宽屏下限宽居中，否则标签和值会拉到相隔近千像素 */}
                            <View style={styles.measure}>
                                <settingItem.component />
                            </View>
                        </HorizontalSafeAreaView>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

/** 桌面端整体换用 Windows 设置版式，移动端保留原来的分组列表 */
export default function Setting() {
    return Platform.OS === "web" ? <SettingDesktop /> : <MobileSetting />;
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    bodyRow: {
        flexDirection: "row",
    },
    main: {
        flex: 1,
        minWidth: 0,
    },
    pluginBody: {
        flex: 1,
        minHeight: 0,
    },
    measure: {
        flex: 1,
        width: "100%",
        ...(Platform.OS === "web"
            ? { maxWidth: 860, alignSelf: "center" as const }
            : null),
    },
    sideNav: {
        width: 196,
        flexShrink: 0,
        paddingTop: 14,
        paddingHorizontal: 12,
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    sideItem: {
        height: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 2,
        overflow: "hidden",
    },
    sideIndicator: {
        position: "absolute",
        left: 0,
        top: 11,
        bottom: 11,
        width: 3,
        borderRadius: 2,
    },
    navLabel: {
        includeFontPadding: false,
    },
    sideLabel: {
        fontSize: 13.5,
        fontWeight: "500",
    },
    tabBar: {
        flexGrow: 0,
        flexShrink: 0,
        maxHeight: 52,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabBarContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        alignItems: "center",
    },
    tabItem: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: 999,
    },
    tabLabel: {
        fontSize: 12.5,
    },
});
