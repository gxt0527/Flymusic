/**
 * 桌面「关于」。
 *
 * 「其他」里保留上游署名、协议与本仓库地址（AGPL-3.0 要求），
 * 版式改成与其他设置页一致的分组卡片。
 */
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import DeviceInfo from "react-native-device-info";

import LinkText from "@/components/base/linkText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import { SettingGroup, SettingsPage } from "./components";

const SOURCE_URL = "https://github.com/maotoumao/MusicFree";
const PROJECT_URL = "https://github.com/gxt0527/Flymusic";

export default function AboutSettingDesktop() {
    const { t } = useI18N();
    const tokens = useTokens();
    const version = DeviceInfo.getVersion();
    const linkColor = tokens.color.primary.base;

    return (
        <SettingsPage
            title={t("common.about" as any)}
            description={t("setting.desktop.aboutDescription" as any)}>
            <SettingGroup>
                <View style={styles.aboutRow}>
                    <Image
                        source={ImgAsset.logo}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View style={styles.aboutText}>
                        <Text
                            style={[
                                styles.appName,
                                { color: tokens.color.text.primary },
                            ]}>
                            {DeviceInfo.getApplicationName()}
                        </Text>
                        <Text
                            style={[
                                styles.version,
                                { color: tokens.color.text.secondary },
                            ]}>
                            {`版本 ${version}`}
                        </Text>
                    </View>
                </View>
            </SettingGroup>

            <SettingGroup title={t("common.other" as any)}>
                <View style={styles.infoBlock}>
                    <Text
                        style={[
                            styles.paragraph,
                            { color: tokens.color.text.primary },
                        ]}>
                        {t("setting.about.basedOnPrefix" as any)}
                        <LinkText linkTo={SOURCE_URL} linkColor={linkColor} style={styles.link}>
                            MusicFree
                        </LinkText>
                        {t("setting.about.licenseSuffix" as any)}
                    </Text>
                    <Text
                        style={[
                            styles.paragraph,
                            { color: tokens.color.text.primary },
                        ]}>
                        {t("setting.about.sourceLabel" as any)}
                        <LinkText linkTo={PROJECT_URL} linkColor={linkColor} style={styles.link}>
                            Flymusic
                        </LinkText>
                    </Text>
                </View>
            </SettingGroup>
        </SettingsPage>
    );
}

const styles = StyleSheet.create({
    aboutRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 16,
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 14,
    },
    aboutText: {
        flexShrink: 1,
    },
    appName: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "500",
        includeFontPadding: false,
    },
    version: {
        fontSize: 12.5,
        lineHeight: 18,
        marginTop: 4,
        includeFontPadding: false,
    },
    infoBlock: {
        padding: 16,
        gap: 6,
    },
    paragraph: {
        fontSize: 13,
        lineHeight: 22,
        includeFontPadding: false,
    },
    link: {
        fontSize: 13,
        lineHeight: 22,
        includeFontPadding: false,
    },
});
