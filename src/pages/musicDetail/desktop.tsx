/**
 * 播放页桌面布局
 *
 *   ⌄                                         ↗   ⋯   ─ □ ✕
 *
 *     ███        海屿你
 *    █████      求你别离开我
 *     ███       专辑: xxx
 *               歌手: xxx
 *               来源: xxx
 *               作词: xxx
 *               作曲: xxx
 *
 *   ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (进度条)
 *   海屿你  ♥       ⏮ (▶) ⏭ ⟳ 字号        🔊 ────  ☰
 *   马也
 *
 * 布局要点：
 *   - 左侧是黑胶唱片（唱臂已移除，后续单独设计）
 *   - 控制键只保留「上一首 / 播放 / 下一首 / 循环 / 字号」——
 *     随机（shuffle）与循环同属播放顺序控制，语义重复，只保留循环
 *   - 歌词字号从歌词区工具栏挪到循环键之后
 *   - 顶栏「更多」不再弹底部面板，改为右上角向下展开的菜单
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    LayoutChangeEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Share from "react-native-share";

import Icon from "@/components/base/icon";
import DesktopVolumeSlider from "@/components/base/desktopVolumeSlider";
import { webBackdropBlur } from "@/components/base/glassBackground";
import { hidePanel, showPanel } from "@/components/panels/usePanel";
import ContextMenu, {
    IContextMenuItem,
} from "@/components/panels/contextMenu";
import type { IPanelAnchor } from "@/components/panels/anchor";
import { B64Asset } from "@/constants/assetsConst";
import repeatModeConst, { MusicRepeatMode } from "@/constants/repeatModeConst";
import globalStyle from "@/constants/globalStyle";
import WindowControls from "@/components/layout/windowControls";
import { useI18N } from "@/core/i18n";
import downloader from "@/core/downloader";
import LocalMusicSheet from "@/core/localMusicSheet";
import lyricManager from "@/core/lyricManager";
import mediaCache from "@/core/mediaCache";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
    useRepeatMode,
} from "@/core/trackPlayer";
import { useTokens } from "@/theme";
import measureNodeRect from "@/utils/measureNode";
import PersistStatus from "@/utils/persistStatus";
import Toast from "@/utils/toast";
import { musicIsPaused } from "@/utils/trackUtils";
import Lyric, { fontSizeMap } from "./components/content/lyric";
import Config from "@/core/appConfig";
import Background from "./components/background";
import Vinyl from "./components/vinyl";

/** 底栏高度：控制区留足呼吸空间 */
const BAR_HEIGHT = 104;
const VOLUME_WIDTH = 132;

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export default function DesktopMusicDetail() {
    const musicItem = useCurrentMusic();
    const navigation = useNavigation();
    const { t } = useI18N();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const tokens = useTokens();

    const musicState = useMusicState();
    const repeatMode = useRepeatMode();
    const progress = useProgress(1000);
    const favorite = useFavorite(musicItem ?? null);

    const paused = musicIsPaused(musicState);

    /**
     * 播放页从底部向上展开，仿 macOS 音乐播放器。
     * Web 上 native-stack 只做 display 切换、没有原生转场，
     * 所以这里自己驱动位移 / 缩放 / 淡入，退出时反向收起再放行 goBack。
     */
    const expand = useRef(new Animated.Value(0)).current;
    const closingRef = useRef(false);
    const expandTranslateY = expand.interpolate({
        inputRange: [0, 1],
        outputRange: [windowHeight, 0],
        extrapolate: "clamp",
    });
    const expandScale = expand.interpolate({
        inputRange: [0, 1],
        outputRange: [0.96, 1],
        extrapolate: "clamp",
    });
    const expandOpacity = expand.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 1],
        extrapolate: "clamp",
    });

    useFocusEffect(
        useCallback(() => {
            closingRef.current = false;
            expand.setValue(0);
            const anim = Animated.timing(expand, {
                toValue: 1,
                duration: 420,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            });
            anim.start();
            return () => anim.stop();
        }, [expand]),
    );

    useEffect(() => {
        return navigation.addListener("beforeRemove", e => {
            if (closingRef.current) {
                return;
            }
            e.preventDefault();
            closingRef.current = true;
            Animated.timing(expand, {
                toValue: 0,
                duration: 260,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: false,
            }).start(() => {
                navigation.dispatch(e.data.action);
            });
        });
    }, [navigation, expand]);

    const [menuAnchor, setMenuAnchor] = useState<IPanelAnchor | null>(null);
    const menuOpen = !!menuAnchor;

    /** 「更多」菜单挂在触发按钮上，坐标在点击时量 */
    const moreBtnRef = useRef<any>(null);

    /**
     * 歌词工具默认隐藏：鼠标进入歌词区域才浮出来。
     * 用 DOM 的 mouseenter/mouseleave 而不是 Pressable 的 onHoverIn ——
     * 歌词区里有拖拽手势（GestureDetector），外面再套一层 Pressable 会抢响应者。
     */
    const lyricZoneRef = useRef<any>(null);
    const [toolsVisible, setToolsVisible] = useState(false);
    const toolsOpacity = useRef(new Animated.Value(0)).current;

    /** 播放列表浮层挂在底栏「播放列表」按钮正上方 */
    const playlistBtnRef = useRef<any>(null);
    const openPlayList = useCallback(() => {
        const anchor = measureNodeRect(playlistBtnRef.current);
        showPanel("PlayList", anchor ? { anchor } : undefined);
    }, []);

    useEffect(() => {
        Animated.timing(toolsOpacity, {
            toValue: toolsVisible ? 1 : 0,
            duration: 150,
            useNativeDriver: false,
        }).start();
    }, [toolsOpacity, toolsVisible]);

    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }
        const el = lyricZoneRef.current;
        if (!el?.addEventListener) {
            return;
        }
        const enter = () => setToolsVisible(true);
        const leave = () => setToolsVisible(false);
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
        return () => {
            el.removeEventListener("mouseenter", enter);
            el.removeEventListener("mouseleave", leave);
        };
    }, []);

    /** 唱片直径：宽度、高度双约束，比例为 0.9 的收缩系数，右移见 bodyPadLeft */
    const coverSize = useMemo(() => {
        const byWidth = windowWidth * 0.33;
        const byHeight = (windowHeight - 130) * 0.565;
        const base = Math.min(400, Math.max(200, Math.min(byWidth, byHeight)));
        return Math.round(base * 0.9);
    }, [windowWidth, windowHeight]);

    /**
     * 唱片右移 45px：缩了 10% 之后如果位置不动，左缘会明显往左退。
     * 同时把唱片与信息区之间的间隙拉到窗口宽的 5%，让右侧歌曲信息整体右移一截。
     */
    const bodyPadLeft = Math.round(windowWidth * 0.045) + 45;
    const bodyGap = Math.round(windowWidth * 0.05);

    const percent = useMemo(() => {
        if (!progress?.duration) {
            return 0;
        }
        return Math.min(100, (progress.position / progress.duration) * 100);
    }, [progress?.position, progress?.duration]);

    const [volume, setVolume] = useState(1);

    /** 播放页进度条也能点击跳转（原来只是一层纯展示 View） */
    const [progressTrackWidth, setProgressTrackWidth] = useState(0);
    const progressHitRef = useRef<any>(null);
    const onProgressLayout = useCallback((e: LayoutChangeEvent) => {
        setProgressTrackWidth(e.nativeEvent.layout.width || 0);
    }, []);
    const seekByX = useCallback(
        (x: number) => {
            if (!musicItem || !progress?.duration || progressTrackWidth <= 0) {
                return;
            }
            const ratio = Math.min(1, Math.max(0, x / progressTrackWidth));
            const target = ratio * progress.duration;
            TrackPlayer.seekTo(target);
            /** 立刻重算当前歌词行并让歌词列表快滑过去（暂停时进度事件不会触发） */
            lyricManager.syncProgress(target);
        },
        [musicItem, progress?.duration, progressTrackWidth],
    );
    /** 与首页播放条一致：用 DOM 矩形 + clientX 反算横坐标，避免 locationX 为 0 */
    const onProgressPress = useCallback(
        (e: any) => {
            /**
             * RN-Web 的 Pressable 在 web 上把原生 DOM 事件（MouseEvent）直接交给 onPress，
             * 这层事件没有 nativeEvent 包装 —— 之前只读 e.nativeEvent.locationX，
             * 结果恒为 undefined → 每次点击都被当成 x=0，播放直接跳回开头。
             */
            const ne = e?.nativeEvent ?? e ?? {};
            const rect = measureNodeRect(progressHitRef.current);
            let x = ne.locationX;
            if (rect && typeof ne.clientX === "number") {
                x = ne.clientX - rect.x;
            }
            seekByX(typeof x === "number" ? x : 0);
        },
        [seekByX],
    );
    const applyVolume = useCallback((next: number) => {
        const safe = Math.min(1, Math.max(0, next));
        setVolume(safe);
        TrackPlayer.setVolume(safe);
    }, []);

    const toggleFavorite = useCallback(() => {
        if (!musicItem) {
            return;
        }
        if (favorite) {
            MusicSheet.removeMusic(MusicSheet.defaultSheet.id, musicItem);
        } else {
            MusicSheet.addMusic(MusicSheet.defaultSheet.id, musicItem);
        }
    }, [favorite, musicItem]);

    const album = musicItem?.album;
    const artist = musicItem?.artist;
    /** 本地文件没有插件，platform 是字面量 "local"，直接展示会显示成英文 */
    const source =
        musicItem?.platform === "local" ? t("common.local") : musicItem?.platform;

    const downloaded = !!(musicItem && LocalMusicSheet.isLocalMusic(musicItem));

    const menuItems: IContextMenuItem[] = useMemo(() => {
        if (!musicItem) {
            return [];
        }
        return [
            {
                key: "next",
                icon: "motion-play",
                label: t("musicListEditor.addToNextPlay"),
                onPress: () => {
                    TrackPlayer.addNext(musicItem);
                },
            },
            {
                key: "sheet",
                icon: "folder-plus",
                label: t("musicListEditor.addToSheet"),
                onPress: () => {
                    showPanel("AddToMusicSheet", { musicItem });
                },
            },
            {
                key: "download",
                divider: true,
                icon: "arrow-down-tray",
                label: downloaded
                    ? t("panel.musicItemOptions.downloaded")
                    : t("common.download"),
                disabled: downloaded,
                onPress: () => {
                    showPanel("MusicQuality", {
                        musicItem,
                        type: "download",
                        onQualityPress(quality: IMusic.IQualityKey) {
                            downloader.download(musicItem, quality);
                        },
                    });
                },
            },
            {
                key: "lrc",
                divider: true,
                icon: "link",
                label: t("panel.musicItemOptions.associateLyric"),
                onPress: () => {
                    showPanel("SearchLrc", { musicItem });
                },
            },
            {
                key: "cache",
                divider: true,
                icon: "archive-box-x-mark",
                label: t("panel.musicItemOptions.clearPluginCache"),
                onPress: () => {
                    mediaCache.removeMediaCache(musicItem);
                    Toast.success(t("panel.musicItemOptions.cacheCleared"));
                },
            },
        ];
    }, [downloaded, musicItem, t]);

    return (
        <Animated.View
            style={[
                styles.transitionRoot,
                {
                    opacity: expandOpacity,
                    transform: [
                        { translateY: expandTranslateY },
                        { scale: expandScale },
                    ],
                },
            ]}>
            <Background />
            <View style={styles.scrim} pointerEvents="none" />

            <SafeAreaView style={globalStyle.fwflex1} edges={["top", "bottom"]}>
                {/* 顶栏 */}
                <View style={styles.topBar} testID="app-titlebar">
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="收起"
                        onPress={() => navigation.goBack()}
                        style={[styles.roundButton, webCursor]}>
                        <Icon name="chevron-down" size={20} color="#FFFFFF" />
                    </Pressable>

                    <View style={styles.grow} />

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="分享"
                        onPress={async () => {
                            try {
                                await Share.open({
                                    type: "image/jpeg",
                                    title: "Fly音乐-一个插件化的免费音乐播放器",
                                    message: "Fly音乐-一个插件化的免费音乐播放器",
                                    url: B64Asset.share,
                                    subject: "Fly音乐分享",
                                });
                            } catch {}
                        }}
                        style={[styles.roundButton, webCursor]}>
                        <Icon name="share" size={17} color="rgba(255,255,255,0.78)" />
                    </Pressable>

                    <Pressable
                        ref={moreBtnRef}
                        accessibilityRole="button"
                        accessibilityLabel="更多"
                        onPress={() => {
                            if (menuAnchor) {
                                setMenuAnchor(null);
                                return;
                            }
                            const rect = measureNodeRect(moreBtnRef.current);
                            setMenuAnchor(
                                rect ?? {
                                    x: windowWidth - 60,
                                    y: 8,
                                    width: 34,
                                    height: 34,
                                },
                            );
                        }}
                        style={[
                            styles.roundButton,
                            webCursor,
                            menuOpen && styles.roundButtonActive,
                        ]}>
                        <Icon
                            name="ellipsis-vertical"
                            size={17}
                            color={menuOpen ? "#FFFFFF" : "rgba(255,255,255,0.78)"}
                        />
                    </Pressable>

                    <WindowControls color="rgba(255,255,255,0.72)" />
                </View>

                {/* 主体：黑胶左 / 信息+歌词右 */}
                <View
                    style={[
                        styles.body,
                        { paddingLeft: bodyPadLeft, gap: bodyGap },
                    ]}>
                    <View testID="player-vinyl-wrap" style={{ width: coverSize }}>
                        <Vinyl
                            size={coverSize}
                            artwork={musicItem?.artwork}
                            playing={!paused}
                        />
                    </View>

                    <View style={styles.info}>
                        <Text
                            testID="player-title"
                            numberOfLines={1}
                            style={styles.title}>
                            {musicItem?.title ?? "--"}
                        </Text>

                        {musicItem?.alias ? (
                            <Text numberOfLines={1} style={styles.subtitle}>
                                {musicItem.alias}
                            </Text>
                        ) : null}

                        {/* 专辑 / 歌手 / 来源，一行一项，长文案各自省略 */}
                        <View style={styles.metaRow}>
                            {album ? (
                                <Text numberOfLines={1} style={styles.metaText}>
                                    {t("playerPage.album")}: {album}
                                </Text>
                            ) : null}
                            {artist ? (
                                <Text numberOfLines={1} style={styles.metaText}>
                                    {t("playerPage.artist")}: {artist}
                                </Text>
                            ) : null}
                            {source ? (
                                <Text numberOfLines={1} style={styles.metaText}>
                                    {t("playerPage.source")}: {source}
                                </Text>
                            ) : null}
                        </View>

                        {/* 歌词区同时也是工具显隐的热区：鼠标进来才浮出工具 */}
                        <View
                            ref={lyricZoneRef}
                            style={styles.lyricWrap}
                            testID="lyric-hover-zone">
                            {/* 歌词整体左移 20px：用 transform 而不是改内边距，
                                这样只挪歌词本身，CD、歌曲信息、右侧歌词工具都不动 */}
                            <View style={styles.lyricShift}>
                                <Lyric />
                            </View>

                            <Animated.View
                                style={[
                                    styles.infoTools,
                                    { opacity: toolsOpacity },
                                ]}
                                pointerEvents={toolsVisible ? "auto" : "none"}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="歌词进度调整"
                                    onPress={() => {
                                        const currentMusic =
                                            TrackPlayer.currentMusic;
                                        if (!currentMusic) {
                                            return;
                                        }
                                        showPanel("SetLyricOffset", {
                                            musicItem: currentMusic,
                                            dark: true,
                                            onSubmit(offset: number) {
                                                lyricManager.updateLyricOffset(
                                                    currentMusic,
                                                    offset,
                                                );
                                                hidePanel();
                                            },
                                        });
                                    }}
                                    style={[styles.toolButton, webCursor]}>
                                    <Icon
                                        name="arrows-left-right"
                                        size={16}
                                        color="rgba(255,255,255,0.55)"
                                    />
                                </Pressable>

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="歌词字号"
                                    onPress={() => {
                                        // 与设置页「歌词-字体大小」共用同一份配置，
                                        // 免得两处各存一份字号、互相覆盖。
                                        const cfgSize =
                                            Config.getConfig("lyric.fontSize");
                                        let defaultSelect =
                                            PersistStatus.get(
                                                "lyric.detailFontSize",
                                            ) ?? 1;
                                        if (cfgSize) {
                                            let bestDiff = Infinity;
                                            for (const key of [0, 1, 2, 3]) {
                                                const diff = Math.abs(
                                                    fontSizeMap[key] - cfgSize,
                                                );
                                                if (diff < bestDiff) {
                                                    bestDiff = diff;
                                                    defaultSelect = key;
                                                }
                                            }
                                        }
                                        showPanel("SetFontSize", {
                                            defaultSelect,
                                            dark: true,
                                            onSelectChange(value: number) {
                                                PersistStatus.set(
                                                    "lyric.detailFontSize",
                                                    value,
                                                );
                                                Config.setConfig(
                                                    "lyric.fontSize",
                                                    fontSizeMap[value],
                                                );
                                            },
                                        });
                                    }}
                                    style={[styles.toolButton, webCursor]}>
                                    <Icon
                                        name="font-size"
                                        size={16}
                                        color="rgba(255,255,255,0.55)"
                                    />
                                </Pressable>
                            </Animated.View>
                        </View>
                    </View>

                </View>

                {/* 底栏：进度条 + 单行控制 */}
                <View style={styles.bar}>
                    <Pressable
                        ref={progressHitRef}
                        accessibilityRole="adjustable"
                        accessibilityLabel="播放进度"
                        onLayout={onProgressLayout}
                        onPress={onProgressPress}
                        style={[styles.progressHit, webCursor]}>
                        <View
                            pointerEvents="none"
                            style={[
                                styles.progressTrack,
                                webBackdropBlur(14, true, 1.45),
                            ]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${percent}%` },
                                ]}>
                                <View style={styles.progressHighlight} />
                            </View>
                        </View>
                    </Pressable>

                    <View style={styles.barRow}>
                        {/* 左：歌名 / 歌手 + 收藏 */}
                        <View style={styles.barLeft}>
                            <View style={styles.nowPlaying}>
                                <Text
                                    numberOfLines={1}
                                    style={styles.nowTitle}
                                    ellipsizeMode="tail">
                                    {musicItem?.title ?? "--"}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={styles.nowArtist}
                                    ellipsizeMode="tail">
                                    {artist ?? ""}
                                </Text>
                            </View>

                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={favorite ? "取消收藏" : "收藏"}
                                onPress={toggleFavorite}
                                style={[styles.iconButton, webCursor]}>
                                <Icon
                                    name={favorite ? "heart" : "heart-outline"}
                                    size={25}
                                    color={
                                        favorite
                                            ? tokens.color.like
                                            : "rgba(255,255,255,0.72)"
                                    }
                                />
                            </Pressable>
                        </View>

                        {/* 中：上一首 / 播放 / 下一首 —— 绝对居中。
                            播放顺序（循环）挂在上一首左侧，用绝对定位脱离布局，
                            否则它会参与居中计算，把播放键挤偏。 */}
                        <View style={styles.centerRow} pointerEvents="box-none">
                            {/* 外层 box-none 在 Web 上等于 pointer-events:none 且会被继承，
                                这里必须显式给 auto，否则整簇控制键都点不动 */}
                            <View style={styles.controls} pointerEvents="auto">
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        repeatModeConst[repeatMode].text
                                    }
                                    onPress={() => {
                                        TrackPlayer.toggleRepeatMode();
                                    }}
                                    style={[styles.cycleButton, webCursor]}>
                                    <Icon
                                        name={repeatModeConst[repeatMode].icon}
                                        size={19}
                                        color={
                                            repeatMode === MusicRepeatMode.QUEUE
                                                ? "rgba(255,255,255,0.72)"
                                                : tokens.color.primary.base
                                        }
                                    />
                                </Pressable>

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="上一首"
                                    onPress={() => {
                                        TrackPlayer.skipToPrevious();
                                    }}
                                    style={[styles.iconButton, webCursor]}>
                                    <Icon
                                        name="skip-left"
                                        size={27}
                                        color="#E6E6E6"
                                    />
                                </Pressable>

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={paused ? "播放" : "暂停"}
                                    onPress={() => {
                                        if (paused) {
                                            TrackPlayer.play();
                                        } else {
                                            TrackPlayer.pause();
                                        }
                                    }}
                                    style={({ pressed }) => [
                                        styles.playButton,
                                        webCursor,
                                        pressed && {
                                            transform: [{ scale: 0.96 }],
                                        },
                                    ]}>
                                    <Icon
                                        name={paused ? "play" : "pause"}
                                        size={22}
                                        color="#111111"
                                        style={
                                            paused ? styles.playIcon : undefined
                                        }
                                    />
                                </Pressable>

                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="下一首"
                                    onPress={() => {
                                        TrackPlayer.skipToNext();
                                    }}
                                    style={[styles.iconButton, webCursor]}>
                                    <Icon
                                        name="skip-right"
                                        size={27}
                                        color="#E6E6E6"
                                    />
                                </Pressable>

                                {/* 播放列表：挂在下一首右侧，同样绝对定位，不参与居中计算 */}
                                <Pressable
                                    ref={playlistBtnRef}
                                    accessibilityRole="button"
                                    accessibilityLabel="播放列表"
                                    onPress={openPlayList}
                                    style={[styles.playlistButton, webCursor]}>
                                    <Icon
                                        name="playlist"
                                        size={19}
                                        color="rgba(255,255,255,0.72)"
                                    />
                                </Pressable>
                            </View>
                        </View>

                        {/* 右：音量 + 播放列表 */}
                        <View style={styles.barRight}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={volume > 0 ? "静音" : "取消静音"}
                                onPress={() => applyVolume(volume > 0 ? 0 : 0.8)}
                                style={[styles.iconButton, webCursor]}>
                                <Icon
                                    name="speaker-wave"
                                    size={19}
                                    color="rgba(255,255,255,0.72)"
                                />
                            </Pressable>

                            <DesktopVolumeSlider
                                value={volume}
                                onChange={applyVolume}
                                width={VOLUME_WIDTH}
                                trackColor="rgba(255,255,255,0.22)"
                                fillColor="#E9E9E9"
                                thumbRingColor="rgba(0,0,0,0.35)"
                            />
                        </View>
                    </View>
                </View>

                {/* 更多：挂在按钮上向下展开的 Win11 菜单 */}
                {menuAnchor && musicItem ? (
                    <ContextMenu
                        anchor={menuAnchor}
                        items={menuItems}
                        width={236}
                        /** 播放页常驻深色，浅色主题下菜单也要跟着深 */
                        dark
                        onClose={() => setMenuAnchor(null)}
                    />
                ) : null}
            </SafeAreaView>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    scrim: {
        ...StyleSheet.absoluteFillObject,
        /** 播放页是「深灰底 + 极淡色晕」，遮罩不能压太黑 */
        backgroundColor: "rgba(0,0,0,0.18)",
    },
    topBar: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 4,
        zIndex: 10,
    },
    grow: {
        flex: 1,
    },
    roundButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    roundButtonActive: {
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    body: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 40,
        minHeight: 0,
    },
    info: {
        flex: 1,
        minWidth: 0,
        alignSelf: "stretch",
        justifyContent: "center",
        /** 歌曲详情（歌名 / 副标题 / 专辑·歌手·来源）整体右移：20 + 30 + 30 = 80 */
        paddingLeft: 80,
        /** 歌曲详情整体上移 30（56 → 26）：顶部这首歌词块跟着往上收，歌词区自然变高 */
        paddingTop: 26,
        paddingBottom: 8,
    },
    title: {
        fontSize: 28,
        lineHeight: 38,
        fontWeight: "500",
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    subtitle: {
        marginTop: 6,
        fontSize: 14,
        lineHeight: 20,
        color: "rgba(255,255,255,0.58)",
        includeFontPadding: false,
    },
    /** 展开动画根容器：铺满屏幕，位移 / 缩放 / 淡入都由它承载 */
    transitionRoot: {
        flex: 1,
        minHeight: 0,
    },
    metaRow: {
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        marginTop: 12,
        maxWidth: "100%",
    },
    metaText: {
        fontSize: 13,
        lineHeight: 18,
        color: "rgba(255,255,255,0.5)",
        includeFontPadding: false,
        /** column 下 flexShrink 只管纵轴，横向截断要靠 maxWidth */
        maxWidth: "100%",
    },
    lyricWrap: {
        flex: 1,
        minHeight: 0,
        marginTop: 20,
    },
    /** 歌词自身左移（视觉微调），不影响同区域内的悬浮工具 */
    lyricShift: {
        flex: 1,
        minHeight: 0,
        transform: [{ translateX: -20 }],
    },
    bar: {
        height: BAR_HEIGHT,
        paddingHorizontal: 40,
    },
    /** 14px 透明命中区，点击即可跳转到对应播放位置 */
    progressHit: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 14,
        zIndex: 3,
    },
    progressTrack: {
        /** 通栏贴边，与桌面常驻播放条保持同一套玻璃质感 */
        width: "100%",
        height: 4,
        backgroundColor: "rgba(255,255,255,0.07)",
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        backgroundColor: "rgba(255,255,255,0.62)",
        overflow: "hidden",
    },
    progressHighlight: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.42)",
    },
    barRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    barLeft: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        minWidth: 0,
        paddingRight: 12,
    },
    nowPlaying: {
        minWidth: 0,
        maxWidth: 380,
        /** 窄窗口下让位给绝对居中的控制键，避免文字压到播放键上 */
        flexShrink: 1,
    },
    nowTitle: {
        fontSize: 17,
        lineHeight: 23,
        fontWeight: "500",
        color: "#FFFFFF",
        includeFontPadding: false,
    },
    nowArtist: {
        marginTop: 3,
        fontSize: 12.5,
        lineHeight: 17,
        color: "rgba(255,255,255,0.55)",
        includeFontPadding: false,
    },
    /** 中间控制区：绝对铺满、三个键整体居中；左右两栏不参与它的计算 */
    centerRow: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        /** 压过左右两栏，否则下一首 / 播放列表会被右侧音量区盖住点不动 */
        zIndex: 2,
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 26,
    },
    /** 播放顺序：挂在 controls 左边界之外，不占据 flex 空间 */
    cycleButton: {
        position: "absolute",
        right: "100%",
        marginRight: 18,
        top: 0,
        bottom: 0,
        width: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    /** 播放列表：挂在 controls 右边界之外，与 cycleButton 镜像 */
    playlistButton: {
        position: "absolute",
        left: "100%",
        marginLeft: 18,
        top: 0,
        bottom: 0,
        width: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    /** 歌词工具：挂在歌词区右下角（相对歌词区，不再相对整块主体），竖排 */
    infoTools: {
        position: "absolute",
        right: 64,
        bottom: 34,
        alignItems: "center",
        gap: 2,
        zIndex: 6,
    },
    toolButton: {
        width: 26,
        height: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#EDEDED",
        alignItems: "center",
        justifyContent: "center",
    },
    playIcon: {
        marginLeft: 2,
    },
    iconButton: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    barRight: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        paddingLeft: 12,
    },
});
