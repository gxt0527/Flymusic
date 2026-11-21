import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutRectangle, Platform, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import useDelayFalsy from "@/hooks/useDelayFalsy";
import { FlatList, Gesture, GestureDetector, TapGestureHandler } from "react-native-gesture-handler";
import { fontSizeConst } from "@/constants/uiConst";
import Loading from "@/components/base/loading";
import globalStyle from "@/constants/globalStyle";
import { showPanel } from "@/components/panels/usePanel";
import TrackPlayer, { useCurrentMusic, useMusicState } from "@/core/trackPlayer";
import { musicIsPaused } from "@/utils/trackUtils";
import delay from "@/utils/delay";
import DraggingTime from "./draggingTime";
import LyricItemComponent from "./lyricItem";
import PersistStatus from "@/utils/persistStatus";
import LyricOperations from "./lyricOperations";
import { IParsedLrcItem } from "@/utils/lrcParser";
import { IconButtonWithGesture } from "@/components/base/iconButton.tsx";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import lyricManager, {
    useCurrentLyricItem,
    useLyricSeekVersion,
    useLyricState,
} from "@/core/lyricManager";
import { useI18N } from "@/core/i18n";
import { useAppConfig } from "@/core/appConfig";

const ITEM_HEIGHT = rpx(92);

interface IItemHeights {
    blankHeight?: number;
    [k: number]: number;
}

interface IProps {
    onTurnPageClick?: () => void;
}

export const fontSizeMap = {
    0: rpx(24),
    1: rpx(30),
    2: rpx(36),
    3: rpx(42),
} as Record<number, number>;

export default function Lyric(props: IProps) {
    const { onTurnPageClick } = props;

    const { loading, meta, lyrics, hasTranslation } =
        useLyricState();
    const currentLrcItem = useCurrentLyricItem();
    const seekVersion = useLyricSeekVersion();
    const showTranslation = PersistStatus.useValue(
        "lyric.showTranslation",
        false,
    );
    const fontSizeKey = PersistStatus.useValue("lyric.detailFontSize", 1);
    /**
     * 设置页「歌词」分区的四个滑块在 Windows 端原本只喂给状态栏歌词，
     * 而桌面端 LyricUtil 是空实现，导致它们完全无效。这里改为让播放页
     * 歌词直接读取同一份配置，拖动滑块即时生效；移动端保持原行为。
     */
    const desktopLeftPercent = useAppConfig("lyric.leftPercent");
    const desktopTopPercent = useAppConfig("lyric.topPercent");
    const desktopWidthPercent = useAppConfig("lyric.widthPercent");
    const desktopFontSize = useAppConfig("lyric.fontSize");
    const desktopAlign = useAppConfig("lyric.align");

    const fontSizeStyle = useMemo(
        () => ({
            fontSize:
                Platform.OS === "web" && desktopFontSize
                    ? desktopFontSize
                    : fontSizeMap[fontSizeKey!],
        }),
        [fontSizeKey, desktopFontSize],
    );

    /** 左右距离 → 歌词区水平内边距；歌词宽度 → 歌词列表最大宽度 */
    const desktopLyricStyle = useMemo(() => {
        if (Platform.OS !== "web") {
            return null;
        }
        const lp = desktopLeftPercent ?? 0.5;
        const wp = desktopWidthPercent ?? 1;
        return {
            paddingHorizontal: Math.round(lp * 40),
            maxWidth: `${Math.max(30, Math.min(100, Math.round(wp * 100)))}%` as any,
            alignSelf: "center" as const,
        };
    }, [desktopLeftPercent, desktopWidthPercent]);

    /** 上下距离 → 歌词列表顶部留白 */
    const desktopLyricContentStyle = useMemo(() => {
        if (Platform.OS !== "web") {
            return null;
        }
        return { paddingTop: Math.round((desktopTopPercent ?? 0) * 160) };
    }, [desktopTopPercent]);

    /** 对齐方式（NativeTextAlignment: 3 左 / 5 右 / 17 居中） */
    const desktopLyricAlign = useMemo(() => {
        if (Platform.OS !== "web") {
            return undefined;
        }
        if (desktopAlign === 3) {
            return "left" as const;
        }
        if (desktopAlign === 5) {
            return "right" as const;
        }
        return "center" as const;
    }, [desktopAlign]);

    const [draggingIndex, setDraggingIndex, setDraggingIndexImmi] =
        useDelayFalsy<number | undefined>(undefined, 2000);
    const musicState = useMusicState();
    const { t } = useI18N();

    const [layout, setLayout] = useState<LayoutRectangle>();

    const listRef = useRef<FlatList<IParsedLrcItem> | null>();

    const currentMusicItem = useCurrentMusic();
    const associateMusicItem = getMediaExtraProperty(currentMusicItem, "associatedLrc");

    // 是否展示拖拽
    const dragShownRef = useRef(false);

    // 组件是否挂载
    const isMountedRef = useRef(true);

    // 用来缓存高度
    const itemHeightsRef = useRef<IItemHeights>({});

    // 设置空白组件，获取组件高度
    const blankComponent = useMemo(() => {
        return (
            <View
                style={styles.empty}
                onLayout={evt => {
                    itemHeightsRef.current.blankHeight =
                        evt.nativeEvent.layout.height;
                }}
            />
        );
    }, []);

    const handleLyricItemLayout = useCallback(
        (index: number, height: number) => {
            itemHeightsRef.current[index] = height;
        },
        [],
    );

    // 滚到当前item
    const scrollToCurrentLrcItem = useCallback(() => {
        if (!listRef.current) {
            return;
        }
        const currentLyricItem = lyricManager.currentLyricItem;
        const currentLyrics = lyricManager.lyricState?.lyrics;
        if (currentLyricItem?.index === -1 || !currentLyricItem) {
            listRef.current?.scrollToIndex({
                index: 0,
                viewPosition: 0.5,
            });
        } else {
            listRef.current?.scrollToIndex({
                index: Math.min(currentLyricItem.index ?? 0, currentLyrics.length - 1),
                viewPosition: 0.5,
            });
        }
    }, []);

    const delayedScrollToCurrentLrcItem = useMemo(() => {
        let sto: number;

        return () => {
            if (sto) {
                clearTimeout(sto);
            }
            sto = setTimeout(() => {
                if (isMountedRef.current) {
                    scrollToCurrentLrcItem();
                }
            }, 200) as any;
        };
    }, []);

    useEffect(() => {
        // 暂停且拖拽才返回
        if (
            lyrics.length === 0 ||
            draggingIndex !== undefined ||
            (draggingIndex === undefined && musicIsPaused(musicState)) ||
            lyrics[lyrics.length - 1].time < 1
        ) {
            return;
        }
        if (currentLrcItem?.index === -1 || !currentLrcItem) {
            listRef.current?.scrollToIndex({
                index: 0,
                viewPosition: 0.5,
            });
        } else {
            listRef.current?.scrollToIndex({
                index: Math.min(currentLrcItem.index ?? 0, lyrics.length - 1),
                viewPosition: 0.5,
            });
        }
        // 音乐暂停状态不应该影响到滑动，所以不放在依赖里，但是这样写不好。。
    }, [currentLrcItem, lyrics, draggingIndex]);

    useEffect(() => {
        scrollToCurrentLrcItem();
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * 手动跳转播放进度（点/拖进度条）后：立刻快滑到目标行。
     * 不走上面那个 effect —— 它为了「暂停时不打断用户翻歌词」做了暂停拦截，
     * 而点击进度条正是希望暂停状态下歌词也跟着跳。
     */
    useEffect(() => {
        if (!seekVersion) {
            return;
        }
        // 等一帧：atom 刚更新时 currentLyricItem 已经落库，但列表可能还没重排
        const timer = setTimeout(() => {
            if (isMountedRef.current) {
                scrollToCurrentLrcItem();
            }
        }, 0) as any;
        return () => clearTimeout(timer);
    }, [seekVersion, scrollToCurrentLrcItem]);

    /**
     * 歌词滚动条：默认不可见，鼠标进入歌词区域才显示（与歌词字号/偏移工具同一套交互）。
     * 样式在 web/index.html 的 .fly-lyric-scroll 里，这里只负责把 class 挂到
     * FlatList 真正的滚动节点上；虚拟列表重建节点后需要重新挂一次。
     */
    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }
        const node: any = (listRef.current as any)?.getScrollableNode?.();
        if (node?.classList && !node.classList.contains("fly-lyric-scroll")) {
            node.classList.add("fly-lyric-scroll");
        }
    }, [lyrics, layout]);

    // 开始滚动时拖拽生效
    const onScrollBeginDrag = () => {
        dragShownRef.current = true;
    };

    const onScrollEndDrag = async () => {
        if (draggingIndex !== undefined) {
            setDraggingIndex(undefined);
        }
        dragShownRef.current = false;
    };

    const onScroll = (e: any) => {
        if (dragShownRef.current) {
            const offset =
                e.nativeEvent.contentOffset.y +
                e.nativeEvent.layoutMeasurement.height / 2;

            const itemHeights = itemHeightsRef.current;
            let height = itemHeights.blankHeight!;
            if (offset <= height) {
                setDraggingIndex(0);
                return;
            }
            for (let i = 0; i < lyrics.length; ++i) {
                height += itemHeights[i] ?? 0;
                if (height > offset) {
                    setDraggingIndex(i);
                    return;
                }
            }
        }
    };

    const onLyricSeekPress = async () => {
        if (draggingIndex !== undefined) {
            const time = lyrics[draggingIndex].time + +(meta?.offset ?? 0);
            if (time !== undefined && !isNaN(time)) {
                await TrackPlayer.seekTo(time);
                await TrackPlayer.play();
                setDraggingIndexImmi(undefined);
            }
        }
    };

    const tapGesture = Gesture.Tap()
        .onStart(() => {
            onTurnPageClick?.();
        })
        .runOnJS(true);

    const unlinkTapGesture = Gesture.Tap()
        .onStart(() => {
            if (currentMusicItem) {
                lyricManager.unassociateLyric(currentMusicItem);
            }
        })
        .runOnJS(true);

    /**
     * 歌词操作行，只在移动端渲染（放在底部，贴着播放控制，符合拇指操作）。
     *
     * 桌面端不渲染这一整排：字号与「歌词进度偏移」都挪到了底部播放条右侧，
     * 搜索歌词 / 翻译 / 更多 三项已在桌面端移除，不再渲染这排图标。
     */
    const operationsNode = (
        <View style={styles.operationsWrap}>
            <LyricOperations scrollToCurrentLrcItem={delayedScrollToCurrentLrcItem} />
        </View>
    );

    return (
        <>
            <GestureDetector gesture={tapGesture}>
                <View
                    style={[
                        globalStyle.fwflex1,
                        desktopLyricStyle,
                        desktopLyricContentStyle,
                    ]}>
                    {loading ? (
                        // 歌词还在拉取时，就在歌词显示位置给一句提示，加载完自然消失
                        <Loading color="white" text={t("lyric.loadingLyric")} />
                    ) : lyrics?.length ? (
                        <FlatList
                            ref={_ => {
                                listRef.current = _;
                            }}
                            onLayout={e => {
                                setLayout(e.nativeEvent.layout);
                            }}
                            viewabilityConfig={{
                                itemVisiblePercentThreshold: 100,
                            }}
                            onScrollToIndexFailed={({ index }) => {
                                delay(120).then(() => {
                                    listRef.current?.scrollToIndex({
                                        index: Math.min(
                                            index ?? 0,
                                            lyrics.length - 1,
                                        ),
                                        viewPosition: 0.5,
                                    });
                                });
                            }}
                            fadingEdgeLength={120}
                            ListHeaderComponent={
                                <>
                                    {blankComponent}
                                    <View style={styles.lyricMeta}>
                                        {associateMusicItem ? (
                                            <>
                                                <Text
                                                    style={[
                                                        styles.lyricMetaText,
                                                        fontSizeStyle,
                                                    ]}
                                                    ellipsizeMode="middle"
                                                    numberOfLines={1}>
                                                    {t("lyric.lyricLinkedFrom", {
                                                        platform: associateMusicItem.platform,
                                                        title: associateMusicItem.title || "",
                                                    })}

                                                </Text>

                                                <GestureDetector
                                                    gesture={unlinkTapGesture}>
                                                    <Text
                                                        style={[
                                                            styles.linkText,
                                                            fontSizeStyle,
                                                        ]}>
                                                        {t("lyric.unlinkLyric")}
                                                    </Text>
                                                </GestureDetector>
                                            </>
                                        ) : null}
                                    </View>
                                </>
                            }
                            ListFooterComponent={blankComponent}
                            onScrollBeginDrag={onScrollBeginDrag}
                            onMomentumScrollEnd={onScrollEndDrag}
                            onScroll={onScroll}
                            scrollEventThrottle={32}
                            style={styles.wrapper}
                            data={lyrics}
                            initialNumToRender={30}
                            overScrollMode="never"
                            extraData={currentLrcItem}
                            renderItem={({ item, index }) => {
                                let text = item.lrc;
                                if (showTranslation && hasTranslation) {
                                    text += `\n${item?.translation ?? ""}`;
                                }

                                return (
                                    <LyricItemComponent
                                        index={index}
                                        text={text}
                                        fontSize={fontSizeStyle.fontSize}
                                        textAlign={desktopLyricAlign}
                                        onLayout={handleLyricItemLayout}
                                        light={draggingIndex === index}
                                        highlight={
                                            currentLrcItem?.index === index
                                        }
                                    />
                                );
                            }}
                        />
                    ) : (
                        <View style={globalStyle.fullCenter}>
                            <Text
                                style={[
                                    styles.white,
                                    fontSizeStyle,
                                    desktopLyricAlign
                                        ? { textAlign: desktopLyricAlign }
                                        : null,
                                ]}>
                                {t("lyric.noLyric")}
                            </Text>
                            <TapGestureHandler
                                onActivated={() => {
                                    showPanel("SearchLrc", {
                                        musicItem:
                                            TrackPlayer.currentMusic,
                                    });
                                }}>
                                <Text
                                    style={[styles.searchLyric, fontSizeStyle]}>
                                    {t("lyric.searchLyric")}
                                </Text>
                            </TapGestureHandler>
                        </View>
                    )}
                    {draggingIndex !== undefined && (
                        <View
                            style={[
                                styles.draggingTime,
                                layout?.height
                                    ? {
                                        top:
                                            (layout.height - ITEM_HEIGHT) / 2,
                                    }
                                    : null,
                            ]}>
                            <DraggingTime
                                time={
                                    (lyrics[draggingIndex]?.time ?? 0) +
                                    +(meta?.offset ?? 0)
                                }
                            />
                            <View style={styles.singleLine} />

                            <IconButtonWithGesture
                                style={styles.playIcon}
                                sizeType='normal'
                                name="play"
                                onPress={onLyricSeekPress}
                            />
                        </View>
                    )}
                </View>
            </GestureDetector>
            {Platform.OS === "web" ? null : operationsNode}
        </>
    );
}

const styles = StyleSheet.create({
    /**
     * 歌词操作行的容器。只有移动端渲染，整行铺满、图标两端分布。
     */
    operationsWrap: {
        width: "100%",
    },
    wrapper: {
        width: "100%",
        marginVertical: rpx(48),
        flex: 1,
    },
    empty: {
        paddingTop: "70%",
    },
    white: {
        color: "white",
    },
    lyricMeta: {
        position: "absolute",
        width: "100%",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        left: 0,
        paddingHorizontal: rpx(48),
        bottom: rpx(48),
    },
    lyricMetaText: {
        color: "white",
        opacity: 0.8,
        maxWidth: "80%",
    },
    linkText: {
        color: "#66ccff",
        textDecorationLine: "underline",
    },
    draggingTime: {
        position: "absolute",
        width: "100%",
        height: ITEM_HEIGHT,
        top: "40%",
        marginTop: rpx(48),
        paddingHorizontal: rpx(18),
        right: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    draggingTimeText: {
        color: "#dddddd",
        fontSize: fontSizeConst.description,
        width: rpx(90),
    },
    singleLine: {
        width: "67%",
        height: 1,
        backgroundColor: "#cccccc",
        opacity: 0.4,
    },
    playIcon: {
        width: rpx(100),
        textAlign: "right",
        color: "white",
    },
    searchLyric: {
        /** 按内容自适应宽度：字号调大 / 歌词宽度调小时不要把「搜索歌词」挤折行 */
        minWidth: rpx(180),
        marginTop: rpx(14),
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(10),
        textAlign: "center",
        alignSelf: "center",
        color: "#5DD3A9",
        textDecorationLine: "underline",
    },
});
