/**
 * 桌面端音乐行（表格形态：序号 / 封面 · 歌名·歌手 / 专辑 / 喜欢 / 时长 / 更多）
 *
 *   行高 56 · 封面 42（圆角 6） · 歌名 13.5/500 · 歌手 11.5/次要色
 *   定宽列（序号、喜欢、时长、更多）与表头共用 desktopColumns，改宽度只改一处。
 *
 * index / showAlbum 是可选能力：没有序号和专辑的场景（搜索结果、浮层里的
 * 匹配列表等）不传就不会多出这两列，避免窄容器里挤成一团。
 *
 * 所有用 <MusicList /> 的页面（播放记录、本地音乐、榜单详情、搜索结果…）在宽屏下
 * 自动换成这一套行，不需要每个页面各写一遍。
 */
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import FastImage from "@/components/base/fastImage";
import Icon from "@/components/base/icon";
import { getPressAnchor } from "@/components/panels/anchor";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import strings from "@/core/importPlaylist/strings";
import { ImportItemStatus } from "@/core/importPlaylist/types";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import TrackPlayer from "@/core/trackPlayer";
import { useTokens } from "@/theme";
import { isSameMediaItem } from "@/utils/mediaUtils";
import timeformat from "@/utils/timeformat";
import { columnFlex, columnSize } from "./desktopColumns";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

/** 导入占位项要跨过「喜欢 / 时长 / 更多」三列，宽度必须与那三列 + 两个列距相等 */
const importTailWidth =
    columnSize.like + columnSize.duration + columnSize.more + columnSize.gap * 2;

interface IDesktopMusicItemProps {
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    /** 第二行文案覆盖（本地音乐用它显示文件路径） */
    subtitle?: string;
    highlight?: boolean;
    /** 序号（01、02…），不传则不渲染序号列 */
    index?: number;
    /** 是否渲染专辑列 */
    showAlbum?: boolean;
    onPress?: () => void;
    /** 导入歌单占位项状态：置灰、禁止播放、显示重试 / 更多源 */
    importStatus?: ImportItemStatus;
    onImportRetry?: () => void;
    onImportSearchMore?: () => void;
}

export default function DesktopMusicItem(props: IDesktopMusicItemProps) {
    const {
        musicItem,
        musicSheet,
        subtitle,
        highlight,
        index,
        showAlbum,
        onPress,
        importStatus,
        onImportRetry,
        onImportSearchMore,
    } = props;
    const t = useTokens();
    const { t: translate } = useI18N();
    const favorite = useFavorite(musicItem);
    const [hovered, setHovered] = useState(false);
    const rowRef = useRef<any>(null);
    const isPlaceholder = !!importStatus && importStatus !== "resolved";
    const isMatching =
        importStatus === "pending" || importStatus === "matching";

    /**
     * 行的悬停高亮自己监听原生 pointerenter / pointerleave。
     *
     * 不能用 Pressable 的 onHoverIn / onHoverOut：RN-Web 的 Pressable 内部用的是
     * `contain: true` 的 useHover —— 指针进入子级 Pressable（收藏、更多）时，
     * 子级会派发一个冒泡的 hover lock 事件，父级收到后判定「指针已经离开自己」，
     * 直接结束 hover，于是整行高亮和 ⋮ 一起消失。
     *
     * pointerenter / pointerleave 不冒泡、也不会因为进入后代而触发，
     * 语义正好是「进入/离开这一行的范围」，绕开了那个 lock 机制。
     *
     * 右键菜单也挂在这里：行是列表回收复用的，闭包里直接取 musicItem 会拿到
     * 上一个租客的数据，所以用 ref 存最新一份，事件里只读 ref。
     */
    const rowDataRef = useRef({ musicItem, musicSheet, isPlaceholder });
    rowDataRef.current = { musicItem, musicSheet, isPlaceholder };

    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }
        const node: any = rowRef.current;
        if (!node?.addEventListener) {
            return;
        }
        const onEnter = () => setHovered(true);
        const onLeave = () => setHovered(false);
        /** 右键＝在鼠标位置弹出「更多」菜单，和 ⋮ 是同一个面板，只是没有按钮可挂 */
        const onContextMenu = (e: any) => {
            e?.preventDefault?.();
            const current = rowDataRef.current;
            if (current.isPlaceholder) {
                return;
            }
            showPanel("MusicItemOptions", {
                musicItem: current.musicItem,
                musicSheet: current.musicSheet,
                anchor: {
                    x: Math.round(e?.clientX ?? 0),
                    y: Math.round(e?.clientY ?? 0),
                    width: 0,
                    height: 0,
                },
            });
        };
        node.addEventListener("pointerenter", onEnter);
        node.addEventListener("pointerleave", onLeave);
        node.addEventListener("contextmenu", onContextMenu);
        return () => {
            node.removeEventListener("pointerenter", onEnter);
            node.removeEventListener("pointerleave", onLeave);
            node.removeEventListener("contextmenu", onContextMenu);
        };
    }, []);

    return (
        <Pressable
            ref={rowRef}
            onPress={
                isPlaceholder
                    ? undefined
                    : () => {
                        if (onPress) {
                            onPress();
                            return;
                        }
                        TrackPlayer.playWithReplacePlayList(musicItem, [
                            musicItem,
                        ]);
                    }
            }
            style={[
                styles.row,
                webCursor,
                hovered &&
                    !isPlaceholder && {
                    backgroundColor: t.isDark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.04)",
                },
            ]}>
            {typeof index === "number" ? (
                <Text
                    style={[
                        styles.index,
                        {
                            color: highlight
                                ? t.color.primary.base
                                : t.color.text.tertiary,
                        },
                    ]}>
                    {String(index).padStart(2, "0")}
                </Text>
            ) : null}

            <View style={styles.titleCell}>
                <FastImage
                    style={[styles.cover, isPlaceholder && styles.dimmed]}
                    source={musicItem.artwork}
                    placeholderSource={ImgAsset.albumDefault}
                />
                <View style={styles.meta}>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.title,
                            { color: t.color.text.primary },
                            highlight && { color: t.color.primary.base },
                            isPlaceholder && {
                                color: t.color.text.tertiary,
                            },
                        ]}>
                        {musicItem.title}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.artist,
                            { color: t.color.text.secondary },
                            isPlaceholder && { color: t.color.text.tertiary },
                        ]}>
                        {isPlaceholder
                            ? [
                                musicItem.artist,
                                isMatching
                                    ? strings.statusMatching
                                    : strings.statusFailed,
                            ]
                                .filter(Boolean)
                                .join(" · ")
                            : (subtitle ||
                              musicItem.artist ||
                              translate("common.unknownArtist"))}
                    </Text>
                </View>
            </View>

            {showAlbum ? (
                <Text
                    numberOfLines={1}
                    style={[
                        styles.album,
                        { color: t.color.text.secondary },
                        isPlaceholder && { color: t.color.text.tertiary },
                    ]}>
                    {musicItem.album?.trim() || "—"}
                </Text>
            ) : null}

            {isPlaceholder ? (
                <View style={styles.importTail}>
                    {isMatching ? (
                        <ActivityIndicator
                            size="small"
                            color={t.color.primary.base}
                        />
                    ) : (
                        <>
                            <Pressable
                                accessibilityLabel={strings.retry}
                                onPress={onImportRetry}
                                style={[styles.importButton, webCursor]}>
                                <Text style={styles.importButtonText}>
                                    {strings.retry}
                                </Text>
                            </Pressable>
                            <Pressable
                                accessibilityLabel={strings.searchMore}
                                onPress={onImportSearchMore}
                                style={[styles.importButton, webCursor]}>
                                <Text style={styles.importButtonText}>
                                    {strings.searchMoreShort}
                                </Text>
                            </Pressable>
                        </>
                    )}
                </View>
            ) : (
                <>
                    <View style={styles.likeCell}>
                        <Pressable
                            accessibilityLabel={
                                favorite ? "取消收藏" : "收藏"
                            }
                            onPress={() => {
                                if (favorite) {
                                    MusicSheet.removeMusic(
                                        MusicSheet.defaultSheet.id,
                                        musicItem,
                                    );
                                } else {
                                    MusicSheet.addMusic(
                                        MusicSheet.defaultSheet.id,
                                        musicItem,
                                    );
                                }
                            }}
                            style={[styles.tailButton, webCursor]}>
                            <Icon
                                name={favorite ? "heart" : "heart-outline"}
                                size={18}
                                color={
                                    favorite
                                        ? t.color.like
                                        : t.color.text.tertiary
                                }
                            />
                        </Pressable>
                    </View>

                    <Text
                        numberOfLines={1}
                        style={[
                            styles.duration,
                            { color: t.color.text.tertiary },
                        ]}>
                        {musicItem.duration > 0
                            ? timeformat(musicItem.duration)
                            : "—"}
                    </Text>

                    <View style={styles.moreCell}>
                        <Pressable
                            accessibilityLabel="更多"
                            onPress={e => {
                                showPanel("MusicItemOptions", {
                                    musicItem,
                                    musicSheet,
                                    anchor: getPressAnchor(e),
                                });
                            }}
                            /**
                             * 桌面端默认藏起「更多」，悬停该行才出现 —— 否则每一行都挂着
                             * 一个三点，列表看起来很吵（设计稿也是悬停才出）。
                             * 列宽常驻，出现/消失不会让「时长」左右跳。
                             * 原生端没有 hover 事件，保持常显，不然菜单永远点不到。
                             */
                            style={[
                                styles.tailButton,
                                webCursor,
                                Platform.OS === "web" &&
                                    !hovered && { opacity: 0 },
                            ]}>
                            <Icon
                                name="ellipsis-vertical"
                                size={18}
                                color={t.color.text.tertiary}
                            />
                        </Pressable>
                    </View>
                </>
            )}
        </Pressable>
    );
}

export function isHighlighted(
    current: IMusic.IMusicItem | null | undefined,
    item: IMusic.IMusicItem,
) {
    return !!current && isSameMediaItem(current, item);
}

const styles = StyleSheet.create({
    row: {
        height: columnSize.rowHeight,
        flexDirection: "row",
        alignItems: "center",
        gap: columnSize.gap,
        borderRadius: 8,
    },
    index: {
        width: columnSize.index,
        fontSize: 12.5,
        lineHeight: 17,
        textAlign: "center",
        includeFontPadding: false,
    },
    titleCell: {
        flexGrow: columnFlex.title,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
    },
    cover: {
        width: columnSize.cover,
        height: columnSize.cover,
        borderRadius: 6,
    },
    meta: {
        minWidth: 0,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    title: {
        fontSize: 13.5,
        lineHeight: 18,
        fontWeight: "500",
        includeFontPadding: false,
    },
    artist: {
        marginTop: 2,
        fontSize: 11.5,
        lineHeight: 15,
        includeFontPadding: false,
    },
    album: {
        flexGrow: columnFlex.album,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        fontSize: 12,
        lineHeight: 16,
        includeFontPadding: false,
    },
    duration: {
        width: columnSize.duration,
        paddingRight: columnSize.durationInset,
        fontSize: 12,
        lineHeight: 16,
        textAlign: "right",
        includeFontPadding: false,
    },
    likeCell: {
        width: columnSize.like,
        alignItems: "center",
        justifyContent: "center",
    },
    moreCell: {
        width: columnSize.more,
        /** 只把 ⋮ 的显示位置往左带近时长，不影响其它列宽（见 columnSize.morePull） */
        transform: [{ translateX: -columnSize.morePull }],
        alignItems: "center",
        justifyContent: "center",
    },
    /** 透明按钮扩大命中区，避免想点三点/收藏时误触播放 */
    tailButton: {
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
    },
    dimmed: {
        opacity: 0.35,
    },
    importTail: {
        width: importTailWidth,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        justifyContent: "flex-end",
    },
    importButton: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: "rgba(125,125,125,0.16)",
    },
    importButtonText: {
        fontSize: 11.5,
        lineHeight: 15,
        color: "#9A9A9A",
        includeFontPadding: false,
    },
});
