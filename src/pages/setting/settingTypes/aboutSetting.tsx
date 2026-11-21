/**
 * 关于
 *
 * 只保留必要信息：Logo、版本号、上游署名与开源地址。
 * 上游的社群 / 答疑 / 免责长文与本修改版无关，不再展示。
 * 保留原作者与上游链接是 AGPL-3.0 的要求。
 */
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, View } from "react-native";
import DeviceInfo from "react-native-device-info";

import LinkText from "@/components/base/linkText";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";

const SOURCE_URL = "https://github.com/maotoumao/MusicFree";
const PROJECT_URL = "https://github.com/gxt0527/Flymusic";

export default function AboutSetting() {
    const { t } = useI18N();
    const version = DeviceInfo.getVersion();

    return (
        <ScrollView
            style={style.scrollView}
            contentContainerStyle={style.container}>
            <Image source={ImgAsset.logo} style={style.logo} resizeMode="contain" />

            <ThemeText fontColor="textSecondary" style={style.version}>
                版本 {version}
            </ThemeText>

            <View style={style.infoBlock}>
                <ThemeText style={style.paragraph}>
                    {t("setting.about.basedOnPrefix" as any)}
                    <LinkText linkTo={SOURCE_URL} style={style.link}>
                        MusicFree
                    </LinkText>
                    {t("setting.about.licenseSuffix" as any)}
                </ThemeText>
                <ThemeText style={style.paragraph}>
                    {t("setting.about.sourceLabel" as any)}
                    <LinkText linkTo={PROJECT_URL} style={style.link}>
                        Flymusic
                    </LinkText>
                </ThemeText>
            </View>
        </ScrollView>
    );
}

const style = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 40,
        paddingBottom: 80,
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 22,
    },
    version: {
        marginTop: 20,
        fontSize: 13,
    },
    infoBlock: {
        marginTop: 14,
        gap: 6,
        alignItems: "center",
        ...(Platform.OS === "web" ? ({ cursor: "default" } as any) : null),
    },
    paragraph: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: "center",
    },
    link: {
        fontSize: 13,
        lineHeight: 20,
    },
});
