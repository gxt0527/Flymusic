import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import { ImgAsset } from "@/constants/assetsConst";
import FastImage from "@/components/base/fastImage";
import PlayAllBar from "@/components/base/playAllBar";
import useColors from "@/hooks/useColors";
import { useLayoutMode } from "@/components/layout";
import { useTokens } from "@/theme";
import { useI18N } from "@/core/i18n";

interface IHeaderProps {
    musicSheet: IMusic.IMusicSheetItem | null;
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
}
export default function Header(props: IHeaderProps) {
    const { musicSheet, musicList, canStar } = props;
    const colors = useColors();
    const tokens = useTokens();
    const { t } = useI18N();
    /** 宽屏：封面放大到 148、标题 22，避免整页还是手机的 120 封面 + 15 字号 */
    const desktop = useLayoutMode() !== "tab";

    const [maxLines, setMaxLines] = useState<number | undefined>(6);

    const toggleShowMore = () => {
        if (maxLines) {
            setMaxLines(undefined);
        } else {
            setMaxLines(6);
        }
    };

    const countText = `${
        musicSheet?.worksNum ?? (musicList ? musicList.length ?? 0 : "-")
    }`;

    if (desktop) {
        return (
            <View
                style={[
                    styles.desktopWrapper,
                    { backgroundColor: colors.card },
                ]}>
                <View style={styles.desktopContent}>
                    <FastImage
                        style={styles.coverDesktop}
                        source={musicSheet?.artwork ?? musicSheet?.coverImg}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    <View style={styles.desktopDetails}>
                        <Text
                            numberOfLines={2}
                            style={[
                                styles.titleDesktop,
                                { color: tokens.color.text.primary },
                            ]}>
                            {musicSheet?.title}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.captionDesktop,
                                { color: tokens.color.text.secondary },
                            ]}>
                            {t("sheetDetail.totalMusicCount", {
                                count: countText,
                            })}
                        </Text>
                        {musicSheet?.description ? (
                            <Pressable onPress={toggleShowMore}>
                                <Text
                                    numberOfLines={maxLines ?? 6}
                                    style={[
                                        styles.descDesktop,
                                        {
                                            color: tokens.color.text.secondary,
                                        },
                                    ]}>
                                    {musicSheet.description}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
                <PlayAllBar
                    canStar={canStar}
                    musicList={musicList}
                    musicSheet={musicSheet}
                />
            </View>
        );
    }

    return (
        <View style={{ backgroundColor: colors.card }}>
            <View style={style.wrapper}>
                <View style={style.content}>
                    <FastImage
                        style={style.coverImg}
                        source={musicSheet?.artwork ?? musicSheet?.coverImg}
                        placeholderSource={ImgAsset.albumDefault}
                    />
                    <View style={style.details}>
                        <ThemeText numberOfLines={3}>
                            {musicSheet?.title}
                        </ThemeText>
                        <ThemeText
                            fontColor="textSecondary"
                            fontSize="description">
                            共
                            {musicSheet?.worksNum ??
                                (musicList ? musicList.length ?? 0 : "-")}
                            首{" "}
                        </ThemeText>
                    </View>
                </View>
                {musicSheet?.description ? (
                    <Pressable onPress={toggleShowMore}>
                        <View style={style.albumDesc}>
                            <ThemeText
                                fontColor="textSecondary"
                                fontSize="description"
                                numberOfLines={maxLines}>
                                {musicSheet.description}
                            </ThemeText>
                        </View>
                    </Pressable>
                ) : null}
            </View>
            <PlayAllBar
                canStar={canStar}
                musicList={musicList}
                musicSheet={musicSheet}
            />
        </View>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        padding: rpx(24),
        justifyContent: "center",
        alignItems: "flex-start",
    },
    content: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
    },
    coverImg: {
        width: rpx(210),
        height: rpx(210),
        borderRadius: rpx(24),
    },
    details: {
        flex: 1,
        height: rpx(140),
        paddingHorizontal: rpx(36),
        justifyContent: "space-between",
    },
    divider: {
        marginVertical: rpx(18),
    },

    albumDesc: {
        width: "100%",
        marginTop: rpx(28),
    },
});

const styles = StyleSheet.create({
    desktopWrapper: {
        width: "100%",
        paddingTop: 12,
        paddingBottom: 4,
    },
    desktopContent: {
        flexDirection: "row",
        alignItems: "center",
        gap: 24,
        /** 与列表行的封面左缘对齐（外层列表容器已有 20 的留白） */
        paddingHorizontal: 6,
    },
    coverDesktop: {
        width: 148,
        height: 148,
        borderRadius: 12,
    },
    desktopDetails: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
        paddingVertical: 6,
    },
    titleDesktop: {
        fontSize: 22,
        lineHeight: 30,
        fontWeight: "600",
        includeFontPadding: false,
    },
    captionDesktop: {
        marginTop: 6,
        fontSize: 12.5,
        lineHeight: 17,
        includeFontPadding: false,
    },
    descDesktop: {
        marginTop: 10,
        fontSize: 12.5,
        lineHeight: 19,
        includeFontPadding: false,
    },
});
