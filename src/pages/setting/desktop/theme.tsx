/**
 * 桌面「主题设置」。
 *
 * 移动端是三张小卡片 + rpx 间距，宽屏上会缩成一小撮；这里改成
 * Windows 设置里「个性化 → 颜色」那种大预览卡，选中态用主色描边 + 勾。
 *
 * 只保留浅色 / 深色两套预设：自定义背景（背景图 + 逐项配色）已移除，
 * 它在桌面端依赖的相册选择器不可用，配色也会让控件对比度失控。
 */
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import Icon from "@/components/base/icon";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import Theme from "@/core/theme";
import { useTokens } from "@/theme";
import { SettingGroup, SettingsPage } from "./components";

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : null;

interface IThemeCardProps {
    label: string;
    preview: string;
    selected: boolean;
    onPress: () => void;
    testID?: string;
}

function ThemeCard({
    label,
    preview,
    selected,
    onPress,
    testID,
}: IThemeCardProps) {
    const t = useTokens();
    return (
        <Pressable
            testID={testID}
            onPress={onPress}
            style={[
                styles.card,
                {
                    backgroundColor: t.color.bg.raised,
                    borderColor: selected ? t.color.primary.base : t.color.border,
                },
                webCursor,
            ]}>
            <View
                style={[
                    styles.preview,
                    { backgroundColor: preview, borderColor: t.color.border },
                ]}>
                {selected ? (
                    <View
                        style={[
                            styles.check,
                            { backgroundColor: t.color.primary.base },
                        ]}>
                        <Icon
                            name="check"
                            size={12}
                            color={t.color.text.onPrimary}
                        />
                    </View>
                ) : null}
            </View>
            <Text
                style={[styles.cardLabel, { color: t.color.text.primary }]}>
                {label}
            </Text>
        </Pressable>
    );
}

export default function ThemeSettingDesktop() {
    const { t } = useI18N();
    const selectedTheme = useAppConfig("theme.selectedTheme");

    return (
        <SettingsPage
            title={t("sidebar.themeSettings" as any)}
            description={t("setting.desktop.themeDescription" as any)}>
            <SettingGroup title={t("themeSettings.setTheme" as any)}>
                <View style={styles.cardsRow}>
                    <ThemeCard
                        testID="setting-theme-light"
                        label={t("themeSettings.lightMode" as any)}
                        preview="#FFFFFF"
                        selected={selectedTheme === "p-light"}
                        onPress={() => {
                            if (selectedTheme !== "p-light") {
                                Theme.setTheme("p-light");
                                Config.setConfig("theme.followSystem", false);
                            }
                        }}
                    />
                    <ThemeCard
                        testID="setting-theme-dark"
                        label={t("themeSettings.darkMode" as any)}
                        preview="#131313"
                        selected={selectedTheme === "p-dark"}
                        onPress={() => {
                            if (selectedTheme !== "p-dark") {
                                Theme.setTheme("p-dark");
                                Config.setConfig("theme.followSystem", false);
                            }
                        }}
                    />
                </View>
            </SettingGroup>
        </SettingsPage>
    );
}

const styles = StyleSheet.create({
    cardsRow: {
        flexDirection: "row",
        gap: 12,
        padding: 16,
        flexWrap: "wrap",
    },
    card: {
        // 固定宽度：跟着卡片容器等分的话，720 限宽下每张会拉到 290+ 宽，
        // 缩略图大到和实际窗口比例失真，视觉重心也压过下面的文字说明。
        width: 196,
        flexGrow: 0,
        flexShrink: 0,
        borderWidth: 2,
        borderRadius: 8,
        padding: 8,
    },
    preview: {
        height: 68,
        borderRadius: 5,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 6,
        alignItems: "flex-end",
    },
    check: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    cardLabel: {
        fontSize: 13,
        lineHeight: 19,
        marginTop: 10,
        marginBottom: 2,
        includeFontPadding: false,
    },
});
