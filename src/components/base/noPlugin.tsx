import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";

interface IProps {
    notSupportType?: string;
}

/**
 * 桌面端把字号压回正常版面字号：
 * 主题里的 title/subTitle 是按手机屏 rpx 缩放的，宽屏上会显得又大又笨。
 */
const isDesktop = Platform.OS === "web";

export default function NoPlugin(props: IProps) {
    const { t } = useI18N();

    return (
        <View style={style.wrapper}>
            <ThemeText
                fontSize="title"
                style={isDesktop ? style.titleDesktop : undefined}>
                {props.notSupportType ? t("noPlugin.titleWithType", {
                    type: props.notSupportType,
                }) : t("noPlugin.title")}
            </ThemeText>
            <ThemeText
                style={[style.mt, isDesktop ? style.descDesktop : null]}
                fontSize="subTitle"
                fontColor="textSecondary">
                {t("noPlugin.description")}
            </ThemeText>
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: rpx(48),
    },
    mt: {
        marginTop: rpx(24),
    },
    titleDesktop: {
        fontSize: 16,
        lineHeight: 23,
        textAlign: "center",
    },
    descDesktop: {
        fontSize: 13,
        lineHeight: 19,
        marginTop: 10,
        textAlign: "center",
    },
});
