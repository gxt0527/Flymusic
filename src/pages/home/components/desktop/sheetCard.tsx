/**
 * 歌单卡片（对齐桌面端设计基准）
 *
 * 方形封面（圆角 8）+ 左下角 26 白色播放键 + 13/500 标题 + 11 灰色副标题。
 * 宽度由外部网格计算后传入，不再写死 152 —— 设计稿是「5 列铺满」，
 * 卡片宽度必须跟着内容区走，否则窗口一宽右边就空一大截。
 */
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import FadeImage from "@/components/base/fadeImage";
import Icon, { IIconName } from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import { resolveImportedAssetOrPath } from "@/utils/fileUtils";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export interface ISheetCardData {
    id: string;
    title: string;
    subtitle?: string;
    cover?: string;
    /** 无封面时显示的占位图标 */
    placeholderIcon?: IIconName;
}

interface ISheetCardProps {
    data: ISheetCardData;
    width?: number;
    onPress?: () => void;
    onPlay?: () => void;
}

export default function SheetCard(props: ISheetCardProps) {
    const { data, width, onPress, onPlay } = props;
    const [hovered, setHovered] = useState(false);
    const [coverFailed, setCoverFailed] = useState(false);

    const uri = resolveImportedAssetOrPath(data.cover);
    const hasCover = typeof uri === "string" && uri.length > 0;
    // 插件图床常因防盗链取不到图；失败时回退到占位图标，而不是留一块黑底
    useEffect(() => setCoverFailed(false), [uri]);
    const showCover = hasCover && !coverFailed;

    return (
        <Pressable
            style={[styles.container, width ? { width } : { flex: 1 }, webCursor]}
            onPress={onPress}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}>
            <View style={styles.coverWrapper}>
                {showCover ? (
                    <FadeImage
                        source={{ uri: uri as string }}
                        style={[
                            StyleSheet.absoluteFill as any,
                            hovered && { transform: [{ scale: 1.04 }] },
                        ]}
                        resizeMode="cover"
                        onError={() => setCoverFailed(true)}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Icon
                            name={data.placeholderIcon ?? "musical-note"}
                            size={36}
                            color="rgba(255,255,255,0.26)"
                        />
                    </View>
                )}

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`播放 ${data.title}`}
                    style={({ pressed }) => [
                        styles.playButton,
                        webCursor,
                        pressed && { transform: [{ scale: 0.94 }] },
                    ]}
                    onPress={onPlay}>
                    <Icon name="play" size={11} color="#111111" style={styles.playIcon} />
                </Pressable>
            </View>

            <ThemeText style={styles.title} numberOfLines={1}>
                {data.title}
            </ThemeText>
            {data.subtitle ? (
                <ThemeText
                    fontColor="textSecondary"
                    style={styles.subtitle}
                    numberOfLines={1}>
                    {data.subtitle}
                </ThemeText>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        minWidth: 0,
    },
    coverWrapper: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    placeholder: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#232526",
    },
    playButton: {
        position: "absolute",
        left: 8,
        bottom: 8,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.88)",
    },
    playIcon: {
        marginLeft: 1,
    },
    title: {
        marginTop: 9,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "500",
    },
    subtitle: {
        marginTop: 3,
        fontSize: 11,
        lineHeight: 15,
    },
});
