/**
 * 桌面端常驻播放条（首页/歌单页底部）—— 尺寸与播放页底栏完全一致
 *
 * 与移动端 MusicBar 的差别不只是「变大变小」，是控件集合不同：
 *   移动端：封面 + 歌名 → 环形进度播放键 + 播放列表（4 个元素，大触控区）
 *   桌面端：封面 · 歌名/歌手 · 收藏 ┊ 播放顺序/上一首/播放/下一首/播放列表（居中） ┊ 音量
 *
 * 尺寸（比播放页底栏更紧凑，常驻条不该抢内容区的空间）：
 *   高 78 · 播放键 40 · 上下曲 23 · 图标按钮 30 · 音量条 112 · 歌名 15.5 / 歌手 12
 * 中间三键用绝对定位整体居中，左右两栏不参与它的计算（否则窄窗口会偏）。
 *
 * 只由 DesktopShell 挂载一次，页面内的 <MusicBar /> 在桌面布局下返回 null。
 */
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
    LayoutChangeEvent,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import Color from "color";
import FastImage from "@/components/base/fastImage";

import Icon from "@/components/base/icon";
import DesktopVolumeSlider from "@/components/base/desktopVolumeSlider";
import { showPanel } from "@/components/panels/usePanel";
import { ImgAsset } from "@/constants/assetsConst";
import repeatModeConst, { MusicRepeatMode } from "@/constants/repeatModeConst";
import MusicSheet, { useFavorite } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import TrackPlayer, {
    useCurrentMusic,
    useMusicState,
    useProgress,
    useRepeatMode,
} from "@/core/trackPlayer";
import { useTokens } from "@/theme";
import measureNodeRect from "@/utils/measureNode";
import { musicIsPaused } from "@/utils/trackUtils";

const BAR_HEIGHT = 78;
const COVER_SIZE = 46;
const PLAY_SIZE = 40;
const VOLUME_WIDTH = 112;

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

function DesktopMusicBar() {
    const t = useTokens();
    const navigate = useNavigate();
    const musicItem = useCurrentMusic();
    const hasMusic = !!musicItem;
    const musicState = useMusicState();
    const repeatMode = useRepeatMode();
    const progress = useProgress(1000);
    const favorite = useFavorite(musicItem ?? null);

    const [volume, setVolume] = useState(1);
    /** 进度条点击区域宽度，用于把点击位置换算成播放秒数 */
    const [progressWidth, setProgressWidth] = useState(0);
    const progressHitRef = useRef<any>(null);

    /** 播放列表浮层要挂在这个按钮正上方，先量出它的位置 */
    const playlistBtnRef = useRef<any>(null);
    const openPlayList = useCallback(() => {
        const anchor = measureNodeRect(playlistBtnRef.current);
        showPanel("PlayList", anchor ? { anchor } : undefined);
    }, []);

    const paused = musicIsPaused(musicState);

    const percent = useMemo(() => {
        if (!progress?.duration) {
            return 0;
        }
        return Math.min(100, (progress.position / progress.duration) * 100);
    }, [progress?.position, progress?.duration]);

    const applyVolume = useCallback((next: number) => {
        const safe = Math.min(1, Math.max(0, next));
        setVolume(safe);
        TrackPlayer.setVolume(safe);
    }, []);

    const onProgressLayout = useCallback((e: LayoutChangeEvent) => {
        setProgressWidth(e.nativeEvent.layout.width || 0);
    }, []);

    /** 点击/拖动进度条任意位置跳转到对应播放时间 */
    const seekByX = useCallback(
        (x: number) => {
            if (!hasMusic || !progress?.duration || progressWidth <= 0) {
                return;
            }
            const ratio = Math.min(1, Math.max(0, x / progressWidth));
            TrackPlayer.seekTo(ratio * progress.duration);
        },
        [hasMusic, progress?.duration, progressWidth],
    );

    /**
     * RN-Web 某些版本的合成 click 不给 locationX，直接用 DOM 矩形 + clientX
     * 反算点击横坐标，真实鼠标点击与自动化点击都能得到正确比例。
     * 注意：web 上 onPress 收到的就是原生 DOM 事件，没有 nativeEvent 包装，
     * 只读 e.nativeEvent 会让 x 恒为 undefined（= 每次都跳到开头）。
     */
    const onProgressPress = useCallback(
        (e: any) => {
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

    /**
     * 桌面端底栏常驻：以前「没有当前歌曲就 return null」，重启 App 或清空
     * 播放队列后底部整条消失，看起来像玻璃层把播放栏弄没了。
     * 这里改成无歌曲时显示占位态，控件灰显但仍保留一条完整的玻璃播放条。
     */
    return (
        <View
            style={[
                styles.wrapper,
                {
                    height: BAR_HEIGHT,
                    /**
                     * 桌面播放条用实心底色，不再叠 backdrop-filter 玻璃层。
                     *
                     * 之前这里是「半透明底色 + blur(20px) saturate(1.85)」。
                     * backdrop-filter 会把这一条变成独立合成层，而且每次背后的
                     * 内容变化都要重新抓一次背景重新模糊 —— 切页时背后整块重绘，
                     * 这一条就要重算一遍，重算期间该层可能显示成未初始化的浅色，
                     * 深色主题下就是整条亮一下再恢复。播放条是常驻的，所以
                     * 「切哪个页面都会闪」；有音源之后页面里有图、背景更复杂，
                     * 重算更慢，也就更容易看见。
                     *
                     * 深色页面上背后本来是大面积纯色，模糊几乎看不出差别，
                     * 换成实心底色 + 上沿高光观感一致，且不参与背景重算。
                     */
                    backgroundColor: t.color.bg.raised,
                    borderTopColor: t.color.border,
                },
            ]}>
            <View
                pointerEvents="none"
                style={[
                    styles.highlight,
                    {
                        backgroundColor: t.isDark
                            ? "rgba(255,255,255,0.16)"
                            : "rgba(255,255,255,0.9)",
                    },
                ]}
            />
            {/* 进度条：14px 高的透明命中区（可点击跳转）+ 4px 玻璃轨道 */}
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
                        {
                            backgroundColor: t.isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.07)",
                        },
                    ]}>
                    <View
                        style={[
                            styles.progressFill,
                            {
                                width: `${percent}%`,
                                backgroundColor: Color(t.color.primary.base)
                                    .alpha(0.5)
                                    .toString(),
                            },
                        ]}>
                        <View style={styles.progressHighlight} />
                    </View>
                </View>
            </Pressable>

            <View style={styles.barRow}>
                {/* 左：封面 + 歌名/歌手 + 收藏，点击进播放页 */}
                <View style={styles.barLeft}>
                    {musicItem ? (
                        <Pressable
                            accessibilityLabel={`${musicItem.title} - ${musicItem.artist ?? ""}`}
                            onPress={() => navigate(ROUTE_PATH.MUSIC_DETAIL)}
                            style={({ pressed }) => [
                                styles.trackInfo,
                                webCursor,
                                pressed && { opacity: 0.85 },
                            ]}>
                            <FastImage
                                style={styles.cover}
                                source={musicItem.artwork}
                                placeholderSource={ImgAsset.albumDefault}
                            />
                            <View style={styles.meta}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.title,
                                        { color: t.color.text.primary },
                                    ]}
                                    ellipsizeMode="tail">
                                    {musicItem.title}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.artist,
                                        { color: t.color.text.secondary },
                                    ]}
                                    ellipsizeMode="tail">
                                    {musicItem.artist ?? ""}
                                </Text>
                            </View>
                        </Pressable>
                    ) : (
                        <View style={styles.trackInfo}>
                            <View
                                style={[
                                    styles.cover,
                                    styles.idleCover,
                                    {
                                        backgroundColor: t.color.bg.hover,
                                        borderColor: t.color.border,
                                    },
                                ]}>
                                <Icon
                                    name="musical-note"
                                    size={20}
                                    color={t.color.text.tertiary}
                                />
                            </View>
                            <View style={styles.meta}>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.title,
                                        { color: t.color.text.primary },
                                    ]}>
                                    暂无播放
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.artist,
                                        { color: t.color.text.secondary },
                                    ]}>
                                    选择一首歌曲开始聆听
                                </Text>
                            </View>
                        </View>
                    )}

                    {musicItem ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={favorite ? "取消收藏" : "收藏"}
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
                            style={[styles.iconButton, webCursor]}>
                            <Icon
                                name={favorite ? "heart" : "heart-outline"}
                                size={21}
                                color={
                                    favorite
                                        ? t.color.like
                                        : t.color.text.secondary
                                }
                            />
                        </Pressable>
                    ) : null}
                </View>

                {/* 中：上一首 / 播放 / 下一首 —— 绝对居中。
                    播放顺序挂在上一首左侧、播放列表挂在下一首右侧，
                    都用绝对定位脱离布局，否则会把播放键挤偏。 */}
                <View style={styles.centerRow} pointerEvents="box-none">
                    <View
                        /**
                         * 必须显式给 auto：外层 centerRow 是 box-none（Web 上等于
                         * pointer-events:none），CSS 的 pointer-events 会被子元素继承，
                         * 不给 auto 的话整簇控制键（含播放列表）全都点不动。
                         */
                        pointerEvents="auto"
                        style={[
                            styles.controls,
                            !hasMusic && styles.controlsDisabled,
                        ]}>
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
                                size={17}
                                color={
                                    repeatMode === MusicRepeatMode.QUEUE
                                        ? t.color.text.secondary
                                        : t.color.primary.base
                                }
                            />
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="上一首"
                            onPress={() => {
                                // 空队列时不要调用播放器，避免抛错
                                if (!hasMusic) {
                                    return;
                                }
                                TrackPlayer.skipToPrevious();
                            }}
                            style={[styles.iconButton, webCursor]}>
                            <Icon
                                name="skip-left"
                                size={23}
                                color={t.color.text.primary}
                            />
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={paused ? "播放" : "暂停"}
                            onPress={() => {
                                if (!hasMusic) {
                                    return;
                                }
                                if (paused) {
                                    TrackPlayer.play();
                                } else {
                                    TrackPlayer.pause();
                                }
                            }}
                            style={({ pressed }) => [
                                styles.playButton,
                                {
                                    // 浅色主题下白圆盘 + 白底等于看不见，
                                    // 改成深色圆盘配白图标，两种主题都够对比
                                    backgroundColor: t.isDark
                                        ? "#EDEDED"
                                        : "#1A1A1A",
                                },
                                webCursor,
                                pressed && { transform: [{ scale: 0.96 }] },
                            ]}>
                            <Icon
                                name={paused ? "play" : "pause"}
                                size={19}
                                color={t.isDark ? "#111111" : "#FFFFFF"}
                                style={
                                    paused ? styles.playIcon : undefined
                                }
                            />
                        </Pressable>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="下一首"
                            onPress={() => {
                                if (!hasMusic) {
                                    return;
                                }
                                TrackPlayer.skipToNext();
                            }}
                            style={[styles.iconButton, webCursor]}>
                            <Icon
                                name="skip-right"
                                size={23}
                                color={t.color.text.primary}
                            />
                        </Pressable>

                        <Pressable
                            ref={playlistBtnRef}
                            accessibilityRole="button"
                            accessibilityLabel="播放列表"
                            onPress={openPlayList}
                            style={[styles.playlistButton, webCursor]}>
                            <Icon
                                name="playlist"
                                size={17}
                                color={t.color.text.secondary}
                            />
                        </Pressable>
                    </View>
                </View>

                {/* 右：音量 */}
                <View style={styles.barRight}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={volume > 0 ? "静音" : "取消静音"}
                        onPress={() => applyVolume(volume > 0 ? 0 : 0.8)}
                        style={[styles.iconButton, webCursor]}>
                        <View style={styles.volumeIconBox}>
                            <Icon
                                name="speaker-wave"
                                size={17}
                                color={
                                    volume > 0
                                        ? t.color.text.secondary
                                        : t.color.text.tertiary
                                }
                            />
                            {/* 静音态：喇叭上压一道斜线（图标集里没有带斜线的版本） */}
                            {volume <= 0 ? (
                                <View
                                    style={[
                                        styles.muteSlash,
                                        {
                                            backgroundColor:
                                                t.color.text.secondary,
                                        },
                                    ]}
                                />
                            ) : null}
                        </View>
                    </Pressable>

                    <DesktopVolumeSlider
                        value={volume}
                        onChange={applyVolume}
                        width={VOLUME_WIDTH}
                        trackColor={
                            t.isDark
                                ? "rgba(255,255,255,0.16)"
                                : "rgba(0,0,0,0.14)"
                        }
                        fillColor={Color(t.color.primary.base)
                            .alpha(0.95)
                            .toString()}
                        thumbRingColor={Color(t.color.primary.base)
                            .alpha(0.35)
                            .toString()}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 28,
        // 上移一点点盖住内容区底边，去掉内容与底栏之间的缝
        marginTop: -10,
        zIndex: 10,
        overflow: "hidden",
    },
    highlight: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: StyleSheet.hairlineWidth,
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
        gap: 12,
        minWidth: 0,
        paddingRight: 12,
    },
    trackInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        maxWidth: 380,
        flexShrink: 1,
        minWidth: 0,
    },
    cover: {
        width: COVER_SIZE,
        height: COVER_SIZE,
        borderRadius: 8,
    },
    idleCover: {
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: "center",
        justifyContent: "center",
    },
    meta: {
        minWidth: 0,
        flexShrink: 1,
        justifyContent: "center",
    },
    title: {
        fontSize: 15.5,
        lineHeight: 21,
        fontWeight: "500",
        includeFontPadding: false,
    },
    artist: {
        marginTop: 2,
        fontSize: 12,
        lineHeight: 16,
        includeFontPadding: false,
    },
    /** 透明点击区：比 4px 轨道高得多，鼠标容易点中；压在控制区之上 */
    progressHit: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 14,
        zIndex: 3,
    },
    progressTrack: {
        /** 通栏贴边的 4px 视觉轨道 */
        width: "100%",
        height: 4,
        overflow: "hidden",
    },
    progressFill: {
        height: 4,
        overflow: "hidden",
    },
    /** 填充层顶部的 1px 高光，让半透明进度条有玻璃质感 */
    progressHighlight: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.42)",
    },
    /** 中间控制区：绝对铺满、整体居中；左右两栏不参与它的计算 */
    centerRow: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        /**
         * 必须压过左右两栏：左右两栏是 flex:1 的普通节点，DOM 上排在 centerRow
         * 之后，会盖住绝对定位的控制键 —— 表现为「下一首 / 播放列表」点不动。
         */
        zIndex: 2,
    },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        gap: 22,
    },
    controlsDisabled: {
        opacity: 0.42,
    },
    cycleButton: {
        position: "absolute",
        right: "100%",
        marginRight: 14,
        top: 0,
        bottom: 0,
        width: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    playlistButton: {
        position: "absolute",
        left: "100%",
        marginLeft: 14,
        top: 0,
        bottom: 0,
        width: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    playButton: {
        width: PLAY_SIZE,
        height: PLAY_SIZE,
        borderRadius: PLAY_SIZE / 2,
        alignItems: "center",
        justifyContent: "center",
    },
    playIcon: {
        marginLeft: 2,
    },
    iconButton: {
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
    },
    /** 喇叭 + 静音斜线的叠放容器，尺寸比图标略大，斜线才不会顶到边界 */
    volumeIconBox: {
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    muteSlash: {
        position: "absolute",
        width: 21,
        height: 1.5,
        borderRadius: 1,
        /** 从右上到左下的一道斜线 */
        transform: [{ rotate: "-45deg" }],
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
export default memo(DesktopMusicBar);
