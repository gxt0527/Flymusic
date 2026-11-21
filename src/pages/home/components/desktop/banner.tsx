/**
 * 首页 Hero Banner（对齐桌面端设计基准）
 *
 * 结构（自下而上）：
 *   左侧文案区：小标签 / 两行大标题（宋体斜体）/ 副标题
 *   底部居中：胶囊指示点（当前项 18×3 主色）
 *   右下：52 白底圆形播放键
 *
 * 高度 clamp(150, 22vh, 200)：桌面窗口普遍比设计稿矮，
 * 压低 Banner 能给下方两行歌单卡片多留一些首屏空间。
 */
import React, { useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";

import FadeImage from "@/components/base/fadeImage";
import Icon from "@/components/base/icon";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import TrackPlayer from "@/core/trackPlayer";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { resolveImportedAssetOrPath } from "@/utils/fileUtils";

const MAX_SLIDES = 4;
const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export default function HomeBanner() {
    const navigate = useNavigate();
    const { t } = useI18N();
    const history = useMusicHistory();
    const [index, setIndex] = useState(0);
    const { height: windowHeight } = useWindowDimensions();

    const bannerHeight = Math.round(
        Math.min(200, Math.max(150, windowHeight * 0.22)),
    );

    const slides = useMemo(() => history.slice(0, MAX_SLIDES), [history]);
    const current = slides[Math.min(index, slides.length - 1)];

    const coverUri = useMemo(() => {
        const resolved = resolveImportedAssetOrPath(current?.artwork);
        return typeof resolved === "string" ? resolved : undefined;
    }, [current]);

    const hasCover = typeof coverUri === "string" && coverUri.length > 0;
    const title = current?.title ?? "在风里，\n听见自由";
    const tag = current ? "Fly音乐 · 继续收听" : "Fly音乐 · 独家推荐";
    /**
     * 有播放记录时副标题只留歌手：上一行的小标签已经是「Fly音乐 · 继续收听」，
     * 这里再拼一次「继续收听」就重复了一句。
     */
    const sub = current
        ? current.artist ?? t("common.unknownArtist")
        : "每周精选 · 为你而选";

    return (
        <View style={[styles.container, { height: bannerHeight }]}>
            {hasCover ? (
                <FadeImage
                    source={{ uri: coverUri as string }}
                    style={StyleSheet.absoluteFill as any}
                    resizeMode="cover"
                />
            ) : (
                <LinearGradient
                    colors={["#2B4A44", "#1B302C", "#141A19"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill as any}
                />
            )}

            {/* 左侧压暗 + 底部压暗，保证文案可读（设计稿 .shade）；
                没有封面时用浅一档的遮罩，否则整块 Banner 会黑成一片 */}
            <LinearGradient
                colors={
                    hasCover
                        ? [
                            "rgba(8,10,11,0.82)",
                            "rgba(8,10,11,0.46)",
                            "rgba(8,10,11,0.12)",
                            "rgba(8,10,11,0.34)",
                        ]
                        : [
                            "rgba(8,10,11,0.42)",
                            "rgba(8,10,11,0.10)",
                            "rgba(8,10,11,0.02)",
                            "rgba(8,10,11,0.16)",
                        ]
                }
                locations={[0, 0.32, 0.58, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill as any}
            />
            <LinearGradient
                colors={["rgba(8,10,11,0.5)", "rgba(8,10,11,0)"]}
                locations={[0, 0.42]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill as any}
            />

            <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.tag}>
                    {tag}
                </Text>
                <Text numberOfLines={2} style={styles.title}>
                    {title}
                </Text>
                <Text numberOfLines={1} style={styles.sub}>
                    {sub}
                </Text>
            </View>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.play")}
                onPress={() => {
                    if (current) {
                        TrackPlayer.play(current);
                    } else {
                        navigate(ROUTE_PATH.RECOMMEND_SHEETS);
                    }
                }}
                style={({ pressed }) => [
                    styles.playButton,
                    webCursor,
                    pressed && { transform: [{ scale: 0.96 }] },
                ]}>
                <Icon name="play" size={20} color="#111111" style={styles.playIcon} />
            </Pressable>

            {slides.length > 1 ? (
                <View style={styles.dots} pointerEvents="box-none">
                    {slides.map((_, i) => (
                        <Pressable
                            key={i}
                            accessibilityLabel={`第 ${i + 1} 张`}
                            onPress={() => setIndex(i)}
                            style={[
                                styles.dot,
                                i === index
                                    ? styles.dotActive
                                    : { backgroundColor: "rgba(255,255,255,0.3)" },
                            ]}
                        />
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: "hidden",
        justifyContent: "flex-end",
        backgroundColor: "#151719",
    },
    copy: {
        position: "absolute",
        left: 28,
        bottom: 26,
        right: 100,
    },
    tag: {
        fontSize: 11,
        lineHeight: 15,
        letterSpacing: 0.4,
        color: "rgba(255,255,255,0.72)",
        marginBottom: 8,
    },
    title: {
        fontFamily:
            Platform.OS === "web"
                ? "\"Songti SC\",\"STSong\",\"SimSun\",Georgia,serif"
                : undefined,
        fontStyle: "italic",
        fontSize: 30,
        lineHeight: 40,
        fontWeight: "500",
        letterSpacing: 1,
        color: "#FFFFFF",
    },
    sub: {
        marginTop: 10,
        fontSize: 11.5,
        lineHeight: 16,
        color: "rgba(255,255,255,0.7)",
    },
    playButton: {
        position: "absolute",
        right: 20,
        bottom: 20,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
        justifyContent: "center",
    },
    playIcon: {
        marginLeft: 2,
    },
    dots: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 14,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
    },
    dot: {
        width: 14,
        height: 3,
        borderRadius: 2,
    },
    dotActive: {
        width: 18,
        height: 3,
        borderRadius: 2,
        backgroundColor: "#5DD3A9",
    },
});
