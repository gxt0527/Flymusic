/**
 * 首页顶栏（仅移动端 / 窄屏）
 *
 * 桌面端的搜索胶囊已经上提到 DesktopShell 的 DesktopTopBar，
 * 全站常驻，所以这里在桌面布局下直接返回 null。
 * 移动端保持原样：品牌标 + 全宽搜索框。
 */
import { ROUTE_PATH } from "@/core/router";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Color from "color";
import IconButton from "@/components/base/iconButton";
import Icon from "@/components/base/icon.tsx";
import { useI18N } from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";

interface INavBarProps {
    /** 窄屏（无侧栏）时在左侧显示品牌标，宽屏由侧栏承担 */
    showBrand?: boolean;
}

export default function NavBar(props: INavBarProps) {
    const navigation = useNavigation<any>();
    const colors = useColors();
    const { t } = useI18N();
    const layoutMode = useLayoutMode();
    const isDesktop = Platform.OS === "web" && layoutMode !== "tab";

    // 桌面端的搜索栏已经上提到 DesktopShell（全局常驻，切页面不消失），
    // 这里再画一条就会重复，直接让位。
    if (isDesktop) {
        return null;
    }

    return (
        <View style={styles.appbar}>
            {props.showBrand ? (
                <Icon
                    name="musical-note"
                    size={rpx(40)}
                    color={colors.primary}
                    style={styles.brand}
                />
            ) : null}

            <Pressable
                style={[
                    styles.searchBar,
                    {
                        backgroundColor: colors.placeholder,
                    },
                ]}
                accessible
                accessibilityLabel={t("home.clickToSearch")}
                onPress={() => {
                    navigation.navigate(ROUTE_PATH.SEARCH_PAGE);
                }}>
                <Icon
                    accessible={false}
                    name="magnifying-glass"
                    size={rpx(32)}
                    color={Color(colors.text).alpha(0.6).toString()}
                />
                <ThemeText
                    accessible={false}
                    fontSize="subTitle"
                    style={[styles.text]}>
                    {t("home.clickToSearch")}
                </ThemeText>
            </Pressable>

            <IconButton
                accessibilityLabel={t("common.setting")}
                name="cog-8-tooth"
                style={styles.setting}
                color={colors.textSecondary}
                onPress={() => {
                    navigation.navigate(ROUTE_PATH.SETTING, { type: "basic" });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    appbar: {
        backgroundColor: "transparent",
        shadowColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: rpx(88),
    },
    searchBar: {
        marginHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        height: "72%",
        maxHeight: rpx(64),
        borderRadius: rpx(36),
        paddingHorizontal: rpx(20),
    },
    text: {
        marginLeft: rpx(12),
        opacity: 0.6,
    },
    brand: {
        marginLeft: rpx(24),
        marginRight: rpx(4),
    },
    setting: {
        marginRight: rpx(16),
    },
});
