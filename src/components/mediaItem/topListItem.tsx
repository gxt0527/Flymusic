import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import FadeImage from "@/components/base/fadeImage";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { useLayoutMode } from "@/components/layout";
import ListItem from "@/components/base/listItem";
import { ImgAsset } from "@/constants/assetsConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { useTokens } from "@/theme";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface ITopListResultsProps {
    pluginHash: string;
    topListItem: IMusic.IMusicSheetItemBase;
}

/**
 * 桌面行版式：64 方形封面 + 两行可截断描述。
 * 通用 ListItem 是移动规格（rpx 缩放后封面不到 30px、描述单行不换行），
 * 在宽窗口下会挤成竖条并让文字溢出，所以桌面单独排。
 */
function DesktopTopListItem(props: ITopListResultsProps) {
    const { pluginHash, topListItem } = props;
    const navigate = useNavigate();
    const tokens = useTokens();
    const [coverFailed, setCoverFailed] = useState(false);
    const [hovered, setHovered] = useState(false);

    const uri = topListItem?.coverImg;
    const showCover =
        !coverFailed && typeof uri === "string" && uri.length > 0;

    return (
        <Pressable
            accessibilityRole="button"
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPress={() => {
                navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                    pluginHash,
                    topList: topListItem,
                });
            }}
            style={[styles.row, webCursor, hovered && styles.rowHover]}>
            <View style={styles.coverBox}>
                {showCover ? (
                    <FadeImage
                        source={{ uri: uri as string }}
                        style={styles.cover}
                        resizeMode="cover"
                        onError={() => setCoverFailed(true)}
                    />
                ) : (
                    <Icon
                        name="musical-note"
                        size={26}
                        color={tokens.color.text.tertiary}
                    />
                )}
            </View>
            <View style={styles.info}>
                <ThemeText numberOfLines={1} style={styles.title}>
                    {topListItem?.title ?? ""}
                </ThemeText>
                {topListItem?.description ? (
                    <ThemeText
                        numberOfLines={2}
                        fontColor="textSecondary"
                        style={styles.desc}>
                        {topListItem.description}
                    </ThemeText>
                ) : null}
            </View>
        </Pressable>
    );
}

/** 移动端保持原样，不影响 RN 端 */
function MobileTopListItem(props: ITopListResultsProps) {
    const { pluginHash, topListItem } = props;
    const navigate = useNavigate();

    return (
        <ListItem
            withHorizontalPadding
            onPress={() => {
                navigate(ROUTE_PATH.TOP_LIST_DETAIL, {
                    pluginHash: pluginHash,
                    topList: topListItem,
                });
            }}>
            <ListItem.ListItemImage
                uri={topListItem?.coverImg}
                fallbackImg={ImgAsset.albumDefault}
            />
            <ListItem.Content
                title={topListItem.title}
                description={`${topListItem.description ?? ""}`}
            />
        </ListItem>
    );
}

export default function TopListItem(props: ITopListResultsProps) {
    const isDesktop = useLayoutMode() !== "tab";
    return isDesktop ? (
        <DesktopTopListItem {...props} />
    ) : (
        <MobileTopListItem {...props} />
    );
}

const styles = StyleSheet.create({
    row: {
        width: "100%",
        minHeight: 84,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    rowHover: {
        backgroundColor: "rgba(125,125,125,0.14)",
    },
    coverBox: {
        width: 64,
        height: 64,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "rgba(125,125,125,0.16)",
        alignItems: "center",
        justifyContent: "center",
    },
    cover: {
        width: 64,
        height: 64,
    },
    info: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 15,
        lineHeight: 21,
        fontWeight: "500",
    },
    desc: {
        marginTop: 4,
        fontSize: 12.5,
        lineHeight: 18,
    },
});
