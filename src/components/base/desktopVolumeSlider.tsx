/**
 * 桌面端音量滑条 —— Windows 交互三件套：点击定位 / 按住拖动 / 滚轮微调
 *
 * 之前两个播放条（首页底栏、播放页底栏）都只挂了一个 onPress，
 * 而 RN-Web 合成事件的 nativeEvent 里没有 locationX，结果永远是 0
 * —— 点哪儿都变静音，看起来就是「只能点喇叭开关」。
 *
 * 这里不走 RN 事件，直接在 DOM 节点上挂原生 PointerEvent / WheelEvent：
 *   pointerdown → 立刻按 clientX 定位，并 setPointerCapture 开始拖动
 *   pointermove → 拖动中持续更新
 *   wheel       → 每次 ±5%（preventDefault，避免页面跟着滚）
 * 非 Web 端（理论上不会用到）退回 Pressable + locationX。
 */
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
    LayoutChangeEvent,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from "react-native";

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 11;
/** 命中区高度：比轨道高得多，鼠标容易点中 */
const HIT_HEIGHT = 22;
/** 滚轮每一格的音量步进 */
const WHEEL_STEP = 0.05;

const isWeb = Platform.OS === "web";

export interface IDesktopVolumeSliderProps {
    /** 0 ~ 1 */
    value: number;
    onChange: (next: number) => void;
    /** 可视宽度 */
    width?: number;
    /** 轨道底色（建议传半透明色） */
    trackColor: string;
    /** 已播放部分 / 圆点颜色 */
    fillColor: string;
    /** 圆点描边色，让圆点在填充色上也有边界 */
    thumbRingColor?: string;
}

function clamp01(v: number) {
    return Math.min(1, Math.max(0, v));
}

function DesktopVolumeSlider(props: IDesktopVolumeSliderProps) {
    const {
        value,
        onChange,
        width = 132,
        trackColor,
        fillColor,
        thumbRingColor,
    } = props;

    const hitRef = useRef<any>(null);
    const [dragging, setDragging] = useState(false);
    const [hovered, setHovered] = useState(false);
    /** DOM 监听器里读最新的 value / onChange，避免每次变化重挂监听 */
    const latest = useRef({ value, onChange });
    latest.current = { value, onChange };

    const onLayout = useCallback((_e: LayoutChangeEvent) => {
        // 宽度由 props 决定，这里只是让节点完成布局后 getBoundingClientRect 可用
    }, []);

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const el = hitRef.current;
        if (!el || typeof el.addEventListener !== "function") {
            return;
        }

        let rect: { left: number; width: number } | null = null;
        let draggingNow = false;

        const readRect = () => {
            try {
                const r = el.getBoundingClientRect();
                if (r?.width) {
                    rect = { left: r.left, width: r.width };
                }
            } catch {
                rect = null;
            }
            return rect;
        };

        const applyClientX = (clientX: number) => {
            const r = rect ?? readRect();
            if (!r || !r.width) {
                return;
            }
            latest.current.onChange(clamp01((clientX - r.left) / r.width));
        };

        const onPointerDown = (e: PointerEvent) => {
            rect = readRect();
            draggingNow = true;
            setDragging(true);
            applyClientX(e.clientX);
            try {
                el.setPointerCapture?.(e.pointerId);
            } catch {
                // 某些环境不支持捕获，靠 window 上的监听兜底
            }
            e.preventDefault();
        };

        const onPointerMove = (e: PointerEvent) => {
            if (draggingNow) {
                applyClientX(e.clientX);
            }
        };

        const endDrag = () => {
            if (!draggingNow) {
                return;
            }
            draggingNow = false;
            setDragging(false);
        };

        const onWheel = (e: WheelEvent) => {
            // 滚轮事件落在滑条上时不要滚动页面
            e.preventDefault();
            e.stopPropagation();
            const dir = e.deltaY < 0 ? 1 : -1;
            const next = clamp01(
                Math.round((latest.current.value + dir * WHEEL_STEP) * 100) / 100,
            );
            latest.current.onChange(next);
        };

        const onEnter = () => setHovered(true);
        const onLeave = () => {
            setHovered(false);
            endDrag();
        };

        el.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);

        return () => {
            el.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", endDrag);
            window.removeEventListener("pointercancel", endDrag);
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("pointerenter", onEnter);
            el.removeEventListener("pointerleave", onLeave);
        };
    }, []);

    const trackH = hovered || dragging ? TRACK_HEIGHT + 1 : TRACK_HEIGHT;
    const trackTop = (HIT_HEIGHT - trackH) / 2;
    /** 已播放长度让圆点圆心正好落在 value 位置 */
    const fillWidth = Math.max(
        0,
        value * (width - THUMB_SIZE) + THUMB_SIZE / 2,
    );

    const body = (
        <View style={[styles.hit, { width, height: HIT_HEIGHT }]}>
            <View
                style={[
                    styles.track,
                    {
                        top: trackTop,
                        height: trackH,
                        borderRadius: trackH / 2,
                        backgroundColor: trackColor,
                    },
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.fill,
                    {
                        top: trackTop,
                        width: fillWidth,
                        height: trackH,
                        borderRadius: trackH / 2,
                        backgroundColor: fillColor,
                    },
                ]}
            />
            <View
                pointerEvents="none"
                style={[
                    styles.thumb,
                    {
                        left: value * (width - THUMB_SIZE),
                        top: (HIT_HEIGHT - THUMB_SIZE) / 2,
                        opacity: hovered || dragging ? 1 : 0.9,
                        transform: [
                            { scale: dragging ? 1.18 : hovered ? 1.08 : 1 },
                        ],
                        backgroundColor: fillColor,
                        borderColor: thumbRingColor ?? "transparent",
                    },
                ]}
            />
        </View>
    );

    if (isWeb) {
        return (
            <View ref={hitRef} testID="volume-slider" style={styles.webHit}>
                {body}
            </View>
        );
    }

    return (
        <Pressable
            ref={hitRef}
            accessibilityRole="adjustable"
            accessibilityLabel="音量"
            onLayout={onLayout}
            onPress={e => {
                const x = (e.nativeEvent as any).locationX ?? 0;
                onChange(clamp01(x / width));
            }}>
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    webHit: {
        // 拖动时不要选中文字 / 触发原生拖拽
        userSelect: "none",
        cursor: "pointer",
    } as any,
    hit: {
        position: "relative",
        justifyContent: "center",
    },
    track: {
        position: "absolute",
        left: 0,
        width: "100%",
    },
    fill: {
        position: "absolute",
        left: 0,
    },
    thumb: {
        position: "absolute",
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        borderWidth: 1.5,
    },
});

export default memo(DesktopVolumeSlider);
