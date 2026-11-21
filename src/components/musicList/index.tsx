import { RequestStateCode } from "@/constants/commonConst";
import ImportPlaylist from "@/core/importPlaylist";
import {
    ImportItemStatus,
    IMPORT_KEY_FIELD,
    IMPORT_STATUS_FIELD,
} from "@/core/importPlaylist/types";
import TrackPlayer from "@/core/trackPlayer";
import rpx from "@/utils/rpx";
import { FlashList } from "@shopify/flash-list";
import React, { useRef, useCallback, useState, useEffect } from "react";
import { FlatListProps, Pressable, StyleSheet, View } from "react-native";
import ListEmpty from "../base/listEmpty";
import ListFooter from "../base/listFooter";
import MusicItem from "../mediaItem/musicItem";
import DesktopMusicItem from "./desktopItem";
import DesktopMusicHeader from "./desktopHeader";
import { columnSize } from "./desktopColumns";
import { useLayoutMode } from "@/components/layout";
import { isSameMediaItem } from "@/utils/mediaUtils";
import Icon from "../base/icon";
import { iconSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";

interface IMusicListProps {
    /** 顶部 */
    Header?: FlatListProps<IMusic.IMusicItem>["ListHeaderComponent"];
    /** 音乐列表 */
    musicList?: IMusic.IMusicItem[];
    /** 所在歌单 */
    musicSheet?: IMusic.IMusicSheetItem;
    /** 是否展示序号 */
    showIndex?: boolean;
    /**
     * 桌面端表格形态：加表头（# / 标题 / 专辑 / 喜欢 / 时长）和专辑列。
     * 只在整页级的歌单列表里开，浮层里的匹配列表太窄，开了会挤。
     */
    desktopTable?: boolean;
    /** 点击 */
    onItemPress?: (
        musicItem: IMusic.IMusicItem,
        musicList?: IMusic.IMusicItem[],
    ) => void;
    // 状态
    state: RequestStateCode;
    /** 高亮的音乐 */
    highlightMusicItem?: IMusic.IMusicItem | null;
    onRetry?: () => void;
    onLoadMore?: () => void;
    /** 桌面端列表内边距覆盖（例如播放记录页要把左侧缩到很窄） */
    desktopPadding?: { left?: number; right?: number };
    /**
     * 桌面端第二行文案覆盖。
     * 本地音乐的曲目一般没有 artist 标签，显示「未知歌手」等于没信息，
     * 调用方可以改成显示文件路径。
     */
    getSubtitle?: (musicItem: IMusic.IMusicItem) => string | undefined;
}
const ITEM_HEIGHT = rpx(120);

/** 音乐列表 */
export default function MusicList(props: IMusicListProps) {
    const {
        Header,
        musicList,
        musicSheet,
        showIndex,
        desktopTable,
        onItemPress,
        state,
        onRetry,
        onLoadMore,
        highlightMusicItem,
        getSubtitle,
    } = props;    
    const colors = useColors();
    const layoutMode = useLayoutMode();
    // 桌面端换成 64 高的紧凑行（44 封面、无序号、无分割线），移动端保持原样
    const isDesktop = layoutMode !== "tab";
    const flashListRef = useRef<FlashList<IMusic.IMusicItem>>(null);
    const [showBadge, setShowBadge] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout>();

    // 查找高亮项的索引
    const highlightIndex = React.useMemo(() => {
        if (!highlightMusicItem || !musicList) return -1;
        return musicList.findIndex(item => isSameMediaItem(item, highlightMusicItem));
    }, [highlightMusicItem, musicList]);    
    
    // 处理滚动开始
    const handleScrollBegin = useCallback(() => {
        if (highlightIndex !== -1) {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
            setShowBadge(true);
        }
    }, [highlightIndex]);
    
    // 处理滚动结束
    const handleScrollEnd = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        // 5秒后直接隐藏
        hideTimeoutRef.current = setTimeout(() => {
            setShowBadge(false);
        }, 5000);
    }, []);    
    
    // 滚动到高亮项
    const scrollToHighlight = useCallback(() => {
        if (highlightIndex !== -1 && flashListRef.current) {
            flashListRef.current.scrollToIndex({
                index: highlightIndex,
                animated: false,
                viewPosition: 0,
            });
            // 立即隐藏角标
            setShowBadge(false);
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        }
    }, [highlightIndex]);    
    
    // 清理定时器
    useEffect(() => {
        return () => {
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
            }
        };
    }, []);    
    
    return (
        <View style={styles.container}>
            {isDesktop && desktopTable ? (
                <View
                    style={[
                        styles.desktopHeader,
                        {
                            paddingLeft: props.desktopPadding?.left ?? 20,
                            paddingRight: props.desktopPadding?.right ?? 20,
                        },
                    ]}>
                    <DesktopMusicHeader showIndex showAlbum />
                </View>
            ) : null}
            <FlashList
                ref={flashListRef}
                /**
                 * 常驻滚动条：表头在滚动容器外面，只有滚动条宽度恒定为 8px，
                 * 表头补的那 8px 才永远对得上（见 desktopColumns.scrollbar）。
                 * 用 auto 的话，列表不满一屏时行区宽 8px，表头就偏右了。
                 * FlashList 自己的 style 不会落到滚动容器上，只有 overrideProps
                 * 会被拼进 ScrollView 的 props，所以只能从这里给。
                 */
                overrideProps={{
                    style: { minHeight: 1, minWidth: 1, overflowY: "scroll" },
                }}
                ListHeaderComponent={Header}
                ListEmptyComponent={<ListEmpty state={state} onRetry={onRetry} />}
                ListFooterComponent={
                    musicList?.length ? <ListFooter state={state} onRetry={onRetry} /> : null
                }
                extraData={highlightMusicItem}
                data={musicList ?? []}
                estimatedItemSize={isDesktop ? columnSize.rowHeight : ITEM_HEIGHT}
                contentContainerStyle={
                    isDesktop
                        ? ({
                            paddingHorizontal: 20,
                            paddingLeft: props.desktopPadding?.left ?? 20,
                            paddingRight: props.desktopPadding?.right ?? 20,
                            paddingTop: 4,
                            paddingBottom: 20,
                        } as any)
                        : undefined
                }
                onScrollBeginDrag={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                renderItem={({ index, item: musicItem }) => {
                    // 导入歌单的占位曲目：从歌曲自身字段读状态，
                    // 不依赖匹配任务是否还在内存里（重启 App 后依然能显示灰色/重试）
                    const importKey = musicItem[IMPORT_KEY_FIELD] as
                        | string
                        | undefined;
                    const importStatus = musicItem[IMPORT_STATUS_FIELD] as
                        | ImportItemStatus
                        | undefined;
                    const showImportState =
                        !!importKey && importStatus !== "resolved";
                    const sheetId = musicSheet?.id;
                    const onImportRetry =
                        importKey && sheetId
                            ? () =>
                                void ImportPlaylist.retry(sheetId, importKey)
                            : undefined;
                    const onImportSearchMore =
                        importKey && sheetId
                            ? () =>
                                void ImportPlaylist.searchMore(
                                    sheetId,
                                    importKey,
                                )
                            : undefined;

                    const handlePress = () => {
                        // 未匹配到音源的占位曲目不能进入播放列表
                        const playableList = (musicList ?? [musicItem]).filter(
                            it => !it[IMPORT_KEY_FIELD],
                        );
                        if (onItemPress) {
                            onItemPress(musicItem, playableList);
                        } else {
                            TrackPlayer.playWithReplacePlayList(
                                musicItem,
                                playableList.length
                                    ? playableList
                                    : [musicItem],
                            );
                        }
                    };

                    if (isDesktop) {
                        return (
                            <DesktopMusicItem
                                musicItem={musicItem}
                                musicSheet={musicSheet}
                                subtitle={getSubtitle?.(musicItem)}
                                index={showIndex ? index + 1 : undefined}
                                showAlbum={!!desktopTable}
                                highlight={isSameMediaItem(
                                    musicItem,
                                    highlightMusicItem,
                                )}
                                onPress={handlePress}
                                importStatus={
                                    showImportState ? importStatus : undefined
                                }
                                onImportRetry={onImportRetry}
                                onImportSearchMore={onImportSearchMore}
                            />
                        );
                    }

                    return (
                        <MusicItem
                            musicItem={musicItem}
                            index={showIndex ? index + 1 : undefined}
                            onItemPress={handlePress}
                            musicSheet={musicSheet}
                            highlight={isSameMediaItem(musicItem, highlightMusicItem)}
                            importStatus={
                                showImportState ? importStatus : undefined
                            }
                            onImportRetry={onImportRetry}
                            onImportSearchMore={onImportSearchMore}
                        />
                    );
                }}
                onEndReached={() => {
                    if (state === RequestStateCode.IDLE || state === RequestStateCode.PARTLY_DONE) {
                        onLoadMore?.();
                    }
                }}
                onEndReachedThreshold={0.1}
            />              
            {showBadge && (
                <View style={styles.badge} pointerEvents="box-none">
                    <Pressable
                        style={[styles.badgeButton, { backgroundColor: colors.notification }]}
                        onPress={scrollToHighlight}
                    >
                        <Icon
                            name="crosshair"
                            size={iconSizeConst.normal}
                            color={colors.text}
                        />
                    </Pressable>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    desktopContent: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 20,
    },
    desktopHeader: {
        paddingTop: 4,
    },
    badge: {
        position: "absolute",
        bottom: rpx(80),
        right: rpx(84),
        zIndex: 1000,
    },
    badgeButton: {
        width: rpx(64),
        height: rpx(64),
        borderRadius: rpx(32),
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});
