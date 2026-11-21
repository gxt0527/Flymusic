/**
 * 我的收藏（本地歌单）桌面布局 —— 对齐桌面端设计基准
 *
 *   我的收藏
 *   歌曲 128   歌单 12   专辑 8        ← 选中项白字 + 2px 主色下划线
 *   [▶ 播放全部]  [♡ 管理]            ← 主色实心胶囊 / 描边胶囊
 *   [封面44] 歌名 / 歌手        ♡  ⋯   ← 行高 64，无分割线
 *
 * 移动端保持原样（大封面 Header + 系统列表），只在桌面布局下走这里。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    LayoutChangeEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    SharedValue,
    interpolate,
    useAnimatedStyle,
} from "react-native-reanimated";

import FastImage from "@/components/base/fastImage";
import Icon, { IIconName } from "@/components/base/icon";
import MenuButton from "@/components/base/menuButton";
import { showPanel } from "@/components/panels/usePanel";
import DesktopMusicItem from "@/components/musicList/desktopItem";
import DesktopMusicHeader from "@/components/musicList/desktopHeader";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import ImportPlaylist from "@/core/importPlaylist";
import importStrings from "@/core/importPlaylist/strings";
import {
    ImportItemStatus,
    IMPORT_KEY_FIELD,
    IMPORT_STATUS_FIELD,
} from "@/core/importPlaylist/types";
import MusicSheet, { useSheetItem, useSheetsBase } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate, useOpenSheetDetail, useParams } from "@/core/router";
import TrackPlayer, { useCurrentMusic } from "@/core/trackPlayer";
import { useTokens } from "@/theme";
import { useGrid } from "@/hooks/useGrid";
import { isSameMediaItem } from "@/utils/mediaUtils";
import InlineSheetSearch from "./components/inlineSearch";
import useSheetMenu from "./components/sheetMenu";

/** 歌单 / 专辑网格的固定列数与列距，卡片宽度由实测内容宽度算出来 */
const GRID_COLUMNS = 6;
const GRID_GAP = 12;
const GRID_MAX_CARD_WIDTH = 200;

type TabKey = "song" | "sheet" | "album";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

/**
 * 列表常驻滚动条。
 *
 * 表头在滚动容器外，行区只有恒定少 8px（columnSize.scrollbar）时，
 * 表头补的那 8px 才永远对得上；用 auto 的话「歌曲很少、不出现滚动条」时
 * 行区反而宽 8px，表头的「时长」就比下面的时间偏右一格。
 * RN 的类型定义里没有 overflowY（RN-Web 支持），所以不能写进 StyleSheet.create。
 */
const alwaysScrollStyle =
    Platform.OS === "web" ? ({ overflowY: "scroll" } as any) : null;

interface ISheetDetailDesktopProps {
    /** 操作行搜索栏的关键字：非空时列表只显示匹配项 */
    searchQuery?: string;
    onSearchChange?: (value: string) => void;
    /** 列表滚动进度（0~1）：驱动操作按钮收成图标 */
    collapseProgress?: SharedValue<number>;
}

/**
 * 可折叠的操作胶囊：滚动到深处时文字淡出、内边距收紧，
 * 只剩图标（34×34 的圆形按钮）。图标与点击行为始终不变。
 */
function CollapsibleAction(props: {
    progress?: SharedValue<number>;
    icon: IIconName;
    label: string;
    onPress: () => void;
    /** 主色实心（播放全部） */
    primary?: boolean;
    iconColor: string;
    labelColor: string;
    borderColor?: string;
}) {
    const {
        progress,
        icon,
        label,
        onPress,
        primary,
        iconColor,
        labelColor,
        borderColor,
    } = props;
    const t = useTokens();

    const pillStyle = useAnimatedStyle(() => {
        const p = progress ? progress.value : 0;
        const pad = interpolate(p, [0, 1], [18, 10]);
        return {
            paddingLeft: pad,
            paddingRight: pad,
        };
    });

    const labelStyle = useAnimatedStyle(() => {
        const p = progress ? progress.value : 0;
        return {
            /**
             * 用 maxWidth 而不是定宽：文字自然宽度不变形，
             * 收起来的过程只是「被裁掉」+ 淡出，不会出现字被压扁
             */
            maxWidth: interpolate(p, [0, 1], [140, 0]),
            marginLeft: interpolate(p, [0, 1], [7, 0]),
            opacity: interpolate(p, [0, 1], [1, 0]),
        };
    });

    return (
        <Animated.View
            style={[
                styles.collapsiblePill,
                primary
                    ? { backgroundColor: t.color.primary.base }
                    : { borderWidth: 1, borderColor },
                pillStyle,
            ]}>
            <Icon name={icon} size={15} color={iconColor} />
            <Animated.View style={[styles.pillLabelHost, labelStyle]}>
                <Text
                    numberOfLines={1}
                    style={[styles.pillText, { color: labelColor }]}>
                    {label}
                </Text>
            </Animated.View>
            {/* 透明触摸层：整颗胶囊都能点，且不吃掉图标/文字的布局 */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={onPress}
                style={[StyleSheet.absoluteFill, webCursor]}
            />
        </Animated.View>
    );
}

export default function SheetDetailDesktop(props: ISheetDetailDesktopProps) {
    const {
        searchQuery = "",
        onSearchChange,
        collapseProgress,
    } = props;
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const sheet = useSheetItem(id);
    const allLocalSheets = useSheetsBase();
    const currentMusic = useCurrentMusic();
    const navigate = useNavigate();
    const openSheetDetail = useOpenSheetDetail();
    const t = useTokens();
    const { t: translate } = useI18N();
    const sheetMenu = useSheetMenu(id, sheet);

    /**
     * 歌单 / 专辑网格：与「推荐歌单」一致 —— 宽窗口一排 6 个、方图海报。
     * 宽度不用窗口算，而是量列表内容区——列表一旦出现竖向滚动条，
     * 可用宽度会比窗口推算值少十几像素，照窗口算最后一张就会被切掉。
     */
    const { columns: gridColumns, cardWidth: estimatedCardWidth } =
        useGrid(GRID_COLUMNS);
    const [gridContentWidth, setGridContentWidth] = useState(0);
    const gridCardWidth = useMemo(() => {
        const width =
            gridContentWidth > 0
                ? gridContentWidth
                : estimatedCardWidth * gridColumns +
                  GRID_GAP * (gridColumns - 1);
        return Math.min(
            Math.floor((width - GRID_GAP * (gridColumns - 1)) / gridColumns),
            GRID_MAX_CARD_WIDTH,
        );
    }, [gridContentWidth, estimatedCardWidth, gridColumns]);
    /** 方图海报（与推荐歌单同比例），高度 = 卡片宽度 */
    const gridCoverHeight = gridCardWidth;
    const gridMeasure = useCallback(
        (e: LayoutChangeEvent) =>
            setGridContentWidth(Math.round(e.nativeEvent.layout.width)),
        [],
    );

    const [tab, setTab] = useState<TabKey>("song");
    const [albumFilter, setAlbumFilter] = useState<string | null>(null);

    /** 「我的收藏」才有歌单栏；普通歌单没有 */
    const isFavoriteSheet = id === MusicSheet.defaultSheet.id;

    /**
     * 同一路由切换歌单（从「我的收藏 → 歌单」点开某个歌单）时组件不会重建，
     * tab 会停在上一个歌单的「歌单」网格上，看着像没打开。切歌单就回到歌曲页。
     */
    useEffect(() => {
        setTab("song");
        setAlbumFilter(null);
    }, [id]);

    /**
     * 换标签页 / 换歌单 / 改筛选时列表会重置到顶部，
     * 折叠进度必须跟着归零，否则会停在收起状态（标题一直不出现）。
     */
    useEffect(() => {
        if (collapseProgress) {
            collapseProgress.value = 0;
        }
    }, [id, tab, albumFilter]);

    const musicList = sheet?.musicList ?? [];

    const albums = useMemo(() => {
        const map = new Map<
            string,
            { name: string; artist?: string; cover?: string; count: number }
        >();
        musicList.forEach(item => {
            const name = item.album?.trim();
            if (!name) {
                return;
            }
            const prev = map.get(name);
            if (prev) {
                prev.count += 1;
            } else {
                map.set(name, {
                    name,
                    artist: item.artist,
                    cover: item.artwork,
                    count: 1,
                });
            }
        });
        return Array.from(map.values());
    }, [musicList]);

    const visibleList = useMemo(() => {
        let list = musicList;
        if (albumFilter) {
            list = list.filter(it => it.album?.trim() === albumFilter);
        }
        const keyword = searchQuery.trim().toLowerCase();
        if (keyword) {
            list = list.filter(it =>
                `${it.title} ${it.artist ?? ""} ${it.album ?? ""}`
                    .toLowerCase()
                    .includes(keyword),
            );
        }
        return list;
    }, [musicList, albumFilter, searchQuery]);

    /**
     * 搜索只针对歌曲列表：正在看「歌单 / 专辑」网格时一开始输入就切回歌曲页，
     * 否则搜索框敲了字、下面还是网格，看着像没生效。
     */
    useEffect(() => {
        if (searchQuery.trim()) {
            setTab("song");
            setAlbumFilter(null);
        }
    }, [searchQuery]);

    /**
     * 「歌单」标签页：列出我创建/导入的本地歌单（不含内置的「我喜欢」）。
     * 以前这里写死 count 0 + 空态，导致导入歌单保存后在「我的收藏」里
     * 完全看不到，用户以为导入失败。
     */
    const mySheets = useMemo(
        () =>
            (allLocalSheets ?? []).filter(
                it => it.id !== MusicSheet.defaultSheet.id,
            ),
        [allLocalSheets],
    );

    const playAll = () => {
        // 还没匹配到音源的占位曲目不能进播放列表
        const playableList = visibleList.filter(
            item => !item[IMPORT_KEY_FIELD],
        );
        if (!playableList.length) {
            return;
        }
        TrackPlayer.playWithReplacePlayList(playableList[0], playableList);
    };

    const searching = !!searchQuery.trim();
    const tabs: Array<{ key: TabKey; label: string; count: number }> = [
        {
            key: "song",
            label: translate("sheetDetail.song"),
            // 搜索中显示命中数，否则「歌曲 26」和下面 3 行对不上
            count: searching ? visibleList.length : musicList.length,
        },
        // 「歌单」这一栏只在「我的收藏」里出现：普通歌单下面再列一遍歌单没有意义，
        // 而且从收藏页点进某个歌单后 tab 还停在「歌单」，看起来就像"点不开"。
        ...(isFavoriteSheet
            ? [
                {
                    key: "sheet" as TabKey,
                    label: translate("sheetDetail.sheet"),
                    count: mySheets.length,
                },
            ]
            : []),
        { key: "album", label: translate("sheetDetail.album"), count: albums.length },
    ];

    return (
        <View style={styles.container}>
            {/* Tab 行（标题由顶栏负责，见 components/navBar.tsx） */}
            <View style={[styles.tabs, { borderBottomColor: t.color.divider }]}>
                {tabs.map(item => {
                    const active = tab === item.key;
                    return (
                        <Pressable
                            key={item.key}
                            onPress={() => {
                                setTab(item.key);
                                if (item.key !== "song") {
                                    setAlbumFilter(null);
                                }
                            }}
                            style={[styles.tab, webCursor]}>
                            <Text
                                style={[
                                    styles.tabLabel,
                                    {
                                        color: active
                                            ? t.color.text.primary
                                            : t.color.text.secondary,
                                        fontWeight: active ? "500" : "400",
                                    },
                                ]}>
                                {item.label}
                                <Text style={styles.tabCount}> {item.count}</Text>
                            </Text>
                            {active ? (
                                <View
                                    style={[
                                        styles.tabUnderline,
                                        { backgroundColor: t.color.primary.base },
                                    ]}
                                />
                            ) : null}
                        </Pressable>
                    );
                })}
            </View>

            {/* 操作行：「歌单」标签下换成歌单相关操作，避免播放全部/管理对歌单列表无效 */}
            <View style={styles.actions}>
                {tab === "sheet" ? (
                    <Pressable
                        onPress={() => showPanel("CreateMusicSheet")}
                        style={({ pressed }) => [
                            styles.pill,
                            styles.pillPrimary,
                            { backgroundColor: t.color.primary.base },
                            webCursor,
                            pressed && {
                                backgroundColor: t.color.primary.press,
                            },
                        ]}>
                        <Icon
                            name="plus"
                            size={15}
                            color={t.color.text.onPrimary}
                        />
                        <Text
                            style={[
                                styles.pillText,
                                { color: t.color.text.onPrimary },
                            ]}>
                            新建歌单
                        </Text>
                    </Pressable>
                ) : (
                    <>
                        <CollapsibleAction
                            progress={collapseProgress}
                            icon="play"
                            label={translate("playAllBar.title")}
                            onPress={playAll}
                            primary
                            iconColor={t.color.text.onPrimary}
                            labelColor={t.color.text.onPrimary}
                        />
                        <CollapsibleAction
                            progress={collapseProgress}
                            icon="heart-outline"
                            label={translate("common.manage")}
                            onPress={() =>
                                navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                                    musicSheet: sheet,
                                    musicList,
                                } as never)
                            }
                            iconColor={t.color.text.secondary}
                            labelColor={t.color.text.secondary}
                            borderColor="rgba(255,255,255,0.14)"
                        />
                    </>
                )}

                {/* 歌单详情页常驻导入入口（首页之外也能直接发起导入） */}
                <CollapsibleAction
                    progress={collapseProgress}
                    icon="inbox-arrow-down"
                    label={importStrings.title}
                    onPress={() => showPanel("ImportPlaylist")}
                    iconColor={t.color.primary.base}
                    labelColor={t.color.primary.base}
                    borderColor="rgba(255,255,255,0.14)"
                />

                {/**
                 * 搜索与 ⋮ 放在行尾：标题栏会被滚动收起，这两个是常驻操作，
                 * 跟着标题一起收走就没法用了。左推靠右对齐，搜索栏仍向左展开。
                 */}
                <View style={styles.actionsSpacer} />
                <InlineSheetSearch
                    value={searchQuery}
                    onChange={onSearchChange ?? (() => {})}
                />
                <MenuButton
                    menu={sheetMenu}
                    color={t.color.text.secondary}
                    iconSize={20}
                    style={styles.menuButton}
                />
            </View>

            {tab === "album" ? (
                <FlatList
                    /** 列数随窗口变，换列数必须 remount，否则 FlatList 沿用旧的行缓存 */
                    key={`album-grid-${gridColumns}`}
                    data={albums}
                    keyExtractor={item => item.name}
                    style={styles.gridScroll}
                    contentContainerStyle={styles.albumGrid}
                    numColumns={gridColumns}
                    columnWrapperStyle={{ gap: GRID_GAP }}
                    ListHeaderComponent={<View onLayout={gridMeasure} />}
                    ListHeaderComponentStyle={styles.gridMeasure}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {translate("sheetDetail.emptyAlbum")}
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => {
                                setAlbumFilter(item.name);
                                setTab("song");
                            }}
                            style={({ pressed }) => [
                                styles.albumCard,
                                { width: gridCardWidth },
                                webCursor,
                                pressed && { opacity: 0.85 },
                            ]}>
                            <FastImage
                                style={[
                                    styles.albumCover,
                                    { height: gridCoverHeight },
                                ]}
                                source={item.cover}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                            <Text numberOfLines={1} style={styles.albumTitle}>
                                {item.name}
                            </Text>
                            <Text numberOfLines={1} style={styles.albumSub}>
                                {item.artist ?? ""}
                            </Text>
                        </Pressable>
                    )}
                />
            ) : tab === "sheet" ? (
                <FlatList
                    key={`sheet-grid-${gridColumns}`}
                    data={mySheets}
                    keyExtractor={item => item.id}
                    style={styles.gridScroll}
                    numColumns={gridColumns}
                    columnWrapperStyle={{ gap: GRID_GAP }}
                    contentContainerStyle={styles.albumGrid}
                    ListHeaderComponent={<View onLayout={gridMeasure} />}
                    ListHeaderComponentStyle={styles.gridMeasure}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>
                                还没有自建歌单，新建一个或导入平台歌单吧
                            </Text>
                            <View style={styles.sheetEmptyActions}>
                                <Pressable
                                    onPress={() =>
                                        showPanel("CreateMusicSheet")
                                    }
                                    style={[
                                        styles.pill,
                                        styles.pillOutline,
                                        {
                                            borderColor:
                                                "rgba(255,255,255,0.14)",
                                        },
                                        webCursor,
                                    ]}>
                                    <Text
                                        style={[
                                            styles.pillText,
                                            { color: t.color.text.secondary },
                                        ]}>
                                        新建歌单
                                    </Text>
                                </Pressable>
                                <Pressable
                                    onPress={() =>
                                        showPanel("ImportPlaylist")
                                    }
                                    style={[
                                        styles.pill,
                                        styles.pillOutline,
                                        {
                                            borderColor:
                                                t.color.primary.base,
                                        },
                                        webCursor,
                                    ]}>
                                    <Text
                                        style={[
                                            styles.pillText,
                                            { color: t.color.primary.base },
                                        ]}>
                                        {importStrings.title}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            accessibilityLabel={`打开歌单 ${item.title ?? ""}`}
                            onPress={() =>
                                openSheetDetail({
                                    id: item.id,
                                })
                            }
                            style={({ pressed }) => [
                                styles.albumCard,
                                { width: gridCardWidth },
                                webCursor,
                                pressed && { opacity: 0.85 },
                            ]}>
                            <FastImage
                                style={[
                                    styles.albumCover,
                                    { height: gridCoverHeight },
                                ]}
                                source={item.coverImg ?? item.artwork}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                            <Text numberOfLines={1} style={styles.albumTitle}>
                                {item.title}
                            </Text>
                            <Text numberOfLines={1} style={styles.albumSub}>
                                {translate("home.songCount", {
                                    count: item.worksNum ?? 0,
                                })}
                            </Text>
                        </Pressable>
                    )}
                />
            ) : (
                <>
                    {albumFilter ? (
                        <Pressable
                            onPress={() => setAlbumFilter(null)}
                            style={[styles.filterChip, webCursor]}>
                            <Text style={styles.filterText}>
                                专辑：{albumFilter} · 清除筛选
                            </Text>
                            <Icon
                                name="x-mark"
                                size={13}
                                color={t.color.text.secondary}
                            />
                        </Pressable>
                    ) : null}
                    {/* 表格表头：列宽与行共用 desktopColumns，两处必须一起出现 */}
                    <DesktopMusicHeader showIndex showAlbum />
                    <FlatList
                        data={visibleList}
                        keyExtractor={(item, index) => `${item.platform}-${item.id}-${index}`}
                        style={[styles.list, alwaysScrollStyle]}
                        contentContainerStyle={styles.listContent}
                        /**
                         * 滚动进度驱动折叠头部：前 110px 完成收起，
                         * 再往下滚保持收起，回顶部自然展开。
                         */
                        onScroll={e => {
                            if (!collapseProgress) {
                                return;
                            }
                            const offset = e.nativeEvent.contentOffset.y;
                            collapseProgress.value = Math.max(
                                0,
                                Math.min(1, offset / 110),
                            );
                        }}
                        scrollEventThrottle={16}
                        ListEmptyComponent={
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>
                                    {searchQuery.trim()
                                        ? `没有匹配「${searchQuery.trim()}」的歌曲`
                                        : translate("sheetDetail.emptyMusic")}
                                </Text>
                            </View>
                        }
                        renderItem={({ item, index }) => {
                            const importKey = item[IMPORT_KEY_FIELD] as
                                | string
                                | undefined;
                            const importStatus = item[
                                IMPORT_STATUS_FIELD
                            ] as ImportItemStatus | undefined;
                            const showImportState =
                                !!importKey && importStatus !== "resolved";
                            const sheetId = sheet.id;
                            return (
                                <DesktopMusicItem
                                    musicItem={item}
                                    musicSheet={sheet as IMusic.IMusicSheetItem}
                                    index={index + 1}
                                    showAlbum
                                    highlight={
                                        !!currentMusic &&
                                        isSameMediaItem(currentMusic, item)
                                    }
                                    importStatus={
                                        showImportState
                                            ? importStatus
                                            : undefined
                                    }
                                    onImportRetry={
                                        importKey && sheetId
                                            ? () =>
                                                void ImportPlaylist.retry(
                                                    sheetId,
                                                    importKey,
                                                )
                                            : undefined
                                    }
                                    onImportSearchMore={
                                        importKey && sheetId
                                            ? () =>
                                                void ImportPlaylist.searchMore(
                                                    sheetId,
                                                    importKey,
                                                )
                                            : undefined
                                    }
                                    onPress={() => {
                                        TrackPlayer.playWithReplacePlayList(
                                            item,
                                            visibleList.filter(
                                                it => !it[IMPORT_KEY_FIELD],
                                            ),
                                        );
                                    }}
                                />
                            );
                        }}
                    />
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 0,
    },
    tabs: {
        flexDirection: "row",
        gap: 26,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: 14,
    },
    tab: {
        paddingBottom: 9,
    },
    tabLabel: {
        fontSize: 14,
        lineHeight: 19,
        includeFontPadding: false,
    },
    tabCount: {
        fontSize: 12.5,
        opacity: 0.85,
    },
    tabUnderline: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        borderRadius: 2,
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    /** 把搜索 + ⋮ 推到操作行最右端 */
    actionsSpacer: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
    },
    menuButton: {
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    pill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        height: 34,
        paddingHorizontal: 18,
        borderRadius: 999,
    },
    /** 可折叠胶囊：内边距交给动画样式，这里只定形状 */
    collapsiblePill: {
        flexDirection: "row",
        alignItems: "center",
        height: 34,
        borderRadius: 999,
        overflow: "hidden",
    },
    /** 文字外壳：宽度由 maxWidth 动画控制，超出部分裁掉 */
    pillLabelHost: {
        flexShrink: 0,
        overflow: "hidden",
    },
    pillPrimary: {},
    pillOutline: {
        borderWidth: 1,
    },
    pillText: {
        fontSize: 13.5,
        lineHeight: 18,
        fontWeight: "500",
        includeFontPadding: false,
    },
    list: {
        flex: 1,
    },
    gridScroll: {
        flex: 1,
    },
    listContent: {
        flexGrow: 1,
        paddingBottom: 24,
    },
    albumGrid: {
        gap: GRID_GAP,
        paddingBottom: 24,
    },
    /** 零高度的量尺：量列表内容区的真实宽度（已扣掉滚动条）。
     *  负 marginTop 抵掉 contentContainer 的 gap，避免白白多出 12px */
    gridMeasure: {
        height: 0,
        marginTop: -GRID_GAP,
    },
    albumCard: {
        minWidth: 0,
    },
    albumCover: {
        width: "100%",
        // 高度由 gridCoverHeight 给出 = 卡片宽度（方图，和推荐歌单同比例）。
        // 不能用 aspectRatio + flex：RN-Web 的 numColumns 行会把父级纵向
        // 拉伸，封面会变成竖长条、名称被挤出可视区
        borderRadius: 10,
    },
    albumTitle: {
        marginTop: 8,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "500",
        color: "#FFFFFF",
    },
    albumSub: {
        marginTop: 3,
        fontSize: 11,
        lineHeight: 15,
        color: "#9A9A9A",
    },
    filterChip: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 28,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.06)",
        marginBottom: 8,
    },
    filterText: {
        fontSize: 12,
        color: "#9A9A9A",
    },
    emptyBox: {
        flexGrow: 1,
        width: "100%",
        paddingVertical: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    sheetEmptyActions: {
        flexDirection: "row",
        gap: 10,
        marginTop: 4,
    },
    emptyText: {
        fontSize: 13,
        color: "#9A9A9A",
        textAlign: "center",
        paddingVertical: 24,
    },
});
