import useColors from "@/hooks/useColors";
import useOrientation from "@/hooks/useOrientation";
import rpx, { vh } from "@/utils/rpx";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    DeviceEventEmitter,
    KeyboardAvoidingView,
    NativeEventSubscription,
    Platform,
    Pressable,
    StyleSheet,
} from "react-native";
import Animated, {
    Easing,
    EasingFunction,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@react-navigation/native";
import { panelInfoStore } from "../usePanel";
import type { IPanelAnchor } from "../anchor";
import NativeUtils from "@/native/utils";

export type { IPanelAnchor };

const ANIMATION_EASING: EasingFunction = Easing.out(Easing.exp);
const ANIMATION_DURATION = 250;

const timingConfig = {
    duration: ANIMATION_DURATION,
    easing: ANIMATION_EASING,
};

/** 桌面端（横向窗口）面板宽度：不再铺满整屏 */
const DESKTOP_PANEL_WIDTH = 440;
/** 桌面端面板高度上限：`vmax(70)` 这类值在宽屏上会算成 700+，收一收 */
const DESKTOP_PANEL_MAX_HEIGHT = 560;
/** 桌面卡片离屏幕底部的距离：常驻播放条 104 + 留白 16，避免压住播放栏 */
const DESKTOP_PANEL_BOTTOM_GAP = 120;
/** 居中弹窗的最大尺寸（匹配进度这类需要看列表的面板） */
const CENTER_PANEL_MAX_WIDTH = 760;
const CENTER_PANEL_MAX_HEIGHT = 620;

interface IPanelBaseProps {
    keyboardAvoidBehavior?: "height" | "padding" | "position" | "none";
    height?: number;
    /**
     * 定位方式：
     *  - top / bottom：移动端底部抽屉、桌面端右下角卡片（旧行为）
     *  - center：水平垂直都居中，四角圆角，缩放淡入（弹窗式面板）
     *  - anchor：挂在 anchor 指定的按钮正上方，并以按钮的竖直中线居中
     */
    positionMethod?: "top" | "bottom" | "center" | "anchor";
    /** 居中弹窗的宽度（不传则用 760 的上限） */
    centerWidth?: number;
    /** positionMethod="anchor" 时，浮层要挂靠的按钮位置 */
    anchor?: IPanelAnchor;
    renderBody: (loading: boolean) => JSX.Element;
}

/** 浮层与挂靠按钮之间留的缝 */
const ANCHOR_PANEL_GAP = 10;
/** 挂靠浮层宽度：与播放列表内部按 rpx(750) 换算的 430px 对齐，内容不会留白边 */
const ANCHOR_PANEL_WIDTH = 430;

export default function (props: IPanelBaseProps) {
    const {
        height = vh(60),
        renderBody,
        keyboardAvoidBehavior,
        positionMethod = "bottom",
        centerWidth,
        anchor,
    } = props;
    const snapPoint = useSharedValue(0);
    const isCenter = positionMethod === "center";
    /**
     * 挂靠模式只在桌面横屏、且拿得到按钮位置时生效；
     * 否则退回原来的底部抽屉，避免窄窗口/移动端没有锚点。
     */
    const isAnchored = positionMethod === "anchor" && !!anchor;

    const colors = useColors();
    /**
     * 桌面浮层统一带一层柔和投影：没有投影时卡片和内容区只差一个明度，
     * 看起来像「贴在页面上的一块矩形」，而不是浮在上面。
     */
    const { dark } = useTheme();
    const cardShadow = {
        shadowColor: colors.shadow ?? "#000000",
        shadowOpacity: dark ? 0.44 : 0.16,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    };
    const [loading, setLoading] = useState(true); // 是否处于弹出状态
    const timerRef = useRef<any>();
    const safeAreaInsets = useSafeAreaInsets();
    const orientation = useOrientation();
    const useAnimatedBase = useMemo(
        () => (orientation === "horizontal" ? rpx(750) : height),
        [orientation],
    );

    const backHandlerRef = useRef<NativeEventSubscription>();

    const hideCallbackRef = useRef<Function[]>([]);

    useEffect(() => {
        snapPoint.value = withTiming(1, timingConfig);

        timerRef.current = setTimeout(() => {
            if (loading) {
                // 兜底
                setLoading(false);
            }
        }, 400);
        if (backHandlerRef.current) {
            backHandlerRef.current.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                snapPoint.value = withTiming(0, timingConfig);
                return true;
            },
        );

        const listenerSubscription = DeviceEventEmitter.addListener(
            "hidePanel",
            (callback?: () => void) => {
                if (callback) {
                    hideCallbackRef.current.push(callback);
                }
                snapPoint.value = withTiming(0, timingConfig);
            },
        );

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
            listenerSubscription.remove();
        };
    }, []);

    const maskAnimated = useAnimatedStyle(() => {
        /**
         * 桌面端的蒙层分两种：
         *  - 贴着鼠标/按钮弹出的浮层（右键菜单、播放列表）不压暗，压暗了像模态框；
         *  - 居中对话框压暗一层，和 Win11 的 ContentDialog 一致，也把焦点收进卡片。
         * 移动端保留原来的深度压暗（底部抽屉需要抢焦点）。
         */
        const webAlpha = isCenter ? 0.32 : 0;
        return {
            opacity: snapPoint.value * (Platform.OS === "web" ? webAlpha : 0.5),
        };
    }, [isCenter]);

    const panelAnimated = useAnimatedStyle(() => {
        // 居中弹窗/挂靠浮层不平移，否则会从屏幕外滑进来
        if (isCenter || isAnchored) {
            return {
                opacity: snapPoint.value,
                transform: [
                    {
                        scale: 0.96 + snapPoint.value * 0.04,
                    },
                ],
            };
        }
        return {
            transform: [
                orientation === "vertical"
                    ? {
                        translateY: (1 - snapPoint.value) * useAnimatedBase,
                    }
                    : {
                        translateX: (1 - snapPoint.value) * useAnimatedBase,
                    },
            ],
        };
    }, [orientation, isCenter, isAnchored]);

    const mountPanel = useCallback(() => {
        setLoading(false);
    }, []);

    const unmountPanel = useCallback(() => {
        panelInfoStore.setValue({
            name: null,
            payload: null,
        });
        hideCallbackRef.current.forEach(cb => cb?.());
    }, []);

    useAnimatedReaction(
        () => snapPoint.value,
        (result, prevResult) => {
            if (
                ((prevResult !== null && result > prevResult) ||
                    prevResult === null) &&
                result > 0.8
            ) {
                runOnJS(mountPanel)();
            }

            if (prevResult && result < prevResult && result === 0) {
                runOnJS(unmountPanel)();
            }
        },
        [],
    );

    const win = NativeUtils.getWindowDimensions();
    const resolvedCenterWidth = Math.max(
        280,
        Math.min(centerWidth ?? CENTER_PANEL_MAX_WIDTH, win.width - 32),
    );
    /**
     * 下限只兜住「标题栏 + 按钮条」的最小可用高度：原来写 180 会把
     * 只有一个输入框的对话框也撑到 180，输入框下方多出一大片空白。
     */
    const centerHeight = Math.max(
        140,
        Math.min(
            height,
            CENTER_PANEL_MAX_HEIGHT,
            win.height - safeAreaInsets.top - safeAreaInsets.bottom - 48,
        ),
    );

    /**
     * 挂靠浮层：按触发按钮在窗口中的四象限决定展开方向 ——
     * 左半 → 面板左缘贴按钮左缘（向右展开）、右半 → 右缘对齐（向左展开）；
     * 上半 → 从按钮下方展开、下半 → 从按钮上方展开。
     * 播放列表这类常驻底栏的按钮自然落在「下半」，向上弹出，行为不变。
     */
    const anchorWidth = Math.min(ANCHOR_PANEL_WIDTH, win.width - 32);
    const anchorCenterY =
        (anchor?.y ?? 0) + (anchor?.height ?? 0) / 2;
    const openDown = anchorCenterY < win.height / 2;
    const onRightHalf =
        (anchor?.x ?? 0) + (anchor?.width ?? 0) / 2 >= win.width / 2;
    const anchorLeft = Math.max(
        16,
        Math.min(
            onRightHalf
                ? (anchor?.x ?? 0) + (anchor?.width ?? 0) - anchorWidth
                : anchor?.x ?? 0,
            win.width - anchorWidth - 16,
        ),
    );
    const ANCHOR_VIEWPORT_GAP = 16;
    /** 向下展开时面板顶边；向上展开时面板底边到窗口底的距离 */
    const anchorTop = Math.max(
        16,
        Math.min(
            (anchor?.y ?? 0) + (anchor?.height ?? 0) + ANCHOR_PANEL_GAP,
            win.height - 16,
        ),
    );
    const anchorBottom =
        win.height - (anchor?.y ?? win.height) + ANCHOR_PANEL_GAP;
    const anchorHeight = Math.max(
        200,
        Math.min(
            height,
            DESKTOP_PANEL_MAX_HEIGHT,
            openDown
                ? win.height - anchorTop - ANCHOR_VIEWPORT_GAP
                : (anchor?.y ?? win.height) - ANCHOR_VIEWPORT_GAP,
        ),
    );

    const panelBody = (
        <Animated.View
            style={[
                style.wrapper,
                isCenter
                    ? {
                        width: resolvedCenterWidth,
                        height: centerHeight,
                        left: (win.width - resolvedCenterWidth) / 2,
                        top: (win.height - centerHeight) / 2,
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.divider ?? "rgba(128,128,128,0.28)",
                        ...cardShadow,
                        overflow: "hidden",
                    }
                    : isAnchored
                        ? {
                            width: anchorWidth,
                            height: anchorHeight,
                            left: anchorLeft,
                            ...(openDown
                                ? { top: anchorTop }
                                : { bottom: anchorBottom }),
                            borderTopLeftRadius: 8,
                            borderTopRightRadius: 8,
                            borderBottomLeftRadius: 8,
                            borderBottomRightRadius: 8,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor:
                              colors.divider ?? "rgba(128,128,128,0.28)",
                            ...cardShadow,
                            overflow: "hidden",
                        }
                        : orientation === "horizontal"
                            ? {
                                /**
                           * 桌面：原来是「width = rpx(750) + 整屏高」的右滑抽屉，
                           * 宽屏上会变成一整面墙。这里收成一个贴右下角的卡片，
                           * 高度用各面板自己声明的值（不够高时才撑满）。
                           */
                                width: Math.min(
                                    DESKTOP_PANEL_WIDTH,
                                    NativeUtils.getWindowDimensions().width - 80,
                                ),
                                height: Math.min(
                                    height,
                                    DESKTOP_PANEL_MAX_HEIGHT,
                                    NativeUtils.getWindowDimensions().height -
                                  safeAreaInsets.top -
                                  DESKTOP_PANEL_BOTTOM_GAP -
                                  24,
                                ),
                                /**
                           * 不再贴屏幕右下角（那是移动端底部抽屉的残留，
                           * 且会盖住常驻播放条）：改成悬浮卡片，四角圆角。
                           */
                                right: 24,
                                bottom: DESKTOP_PANEL_BOTTOM_GAP,
                                borderTopLeftRadius: 8,
                                borderTopRightRadius: 8,
                                borderBottomLeftRadius: 8,
                                borderBottomRightRadius: 8,
                                borderWidth: StyleSheet.hairlineWidth,
                                borderColor:
                              colors.divider ?? "rgba(128,128,128,0.28)",
                                ...cardShadow,
                                overflow: "hidden",
                            }
                            : {
                                right: 0,
                                top:
                              positionMethod === "top"
                                  ? (NativeUtils.getWindowDimensions().height + safeAreaInsets.top) -
                                    height -
                                    safeAreaInsets.bottom
                                  : undefined,
                                bottom: positionMethod === "bottom" ? 0 : undefined,
                                height: height,
                            },
                {
                    backgroundColor: colors.backdrop,
                },
                panelAnimated,
            ]}>
            {renderBody(loading)}
        </Animated.View>
    );

    return (
        <>
            <Pressable
                style={style.maskWrapper}
                onPress={() => {
                    snapPoint.value = withTiming(0, timingConfig);
                }}>
                <Animated.View
                    style={[style.maskWrapper, style.mask, maskAnimated]}
                />
            </Pressable>
            {keyboardAvoidBehavior === "none" || isCenter || isAnchored ? (
                panelBody
            ) : (
                <KeyboardAvoidingView
                    style={style.kbContainer}
                    behavior={keyboardAvoidBehavior || "position"}>
                    {panelBody}
                </KeyboardAvoidingView>
            )}
        </>
    );
}

const style = StyleSheet.create({
    maskWrapper: {
        position: "absolute",
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15000,
    },
    mask: {
        backgroundColor: "#000",
        opacity: 0.5,
    },
    wrapper: {
        position: "absolute",
        width: rpx(750),
        borderTopLeftRadius: rpx(28),
        borderTopRightRadius: rpx(28),
        zIndex: 15010,
    },
    kbContainer: {
        zIndex: 15010,
    },
});
