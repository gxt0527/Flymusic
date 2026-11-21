import { timingConfig } from "@/constants/commonConst";
import { fontSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import rpx from "@/utils/rpx";
import { GlobalState } from "@/utils/stateMapper";
import { nanoid } from "nanoid";
import React, { useCallback, useEffect } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import {
    Directions,
    Gesture,
    GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import Icon from "@/components/base/icon.tsx";
import { useTokens } from "@/theme";

export interface IToastConfig {
    /** 类型 */
    type: "success" | "warn";
    /** 消息内容 */
    message?: string;
    /** 行动点 */
    actionText?: string;
    /** 行动点按钮行为 */
    onActionClick?: () => void;
    /** 展示时间 */
    duration?: number;
}

type IToastConfigInner = IToastConfig & {
    id: string;
};

const toastQueue: IToastConfigInner[] = [];

const fixedTop = rpx(250);

const activeToastStore = new GlobalState<IToastConfigInner | null>(null);

const typeConfig = {
    success: {
        name: "check-circle",
        // 亮/暗主题分开取色：单一 #457236 在深色底 (#232627) 上对比不足，图标几乎糊进背景
        color: "#457236",
        colorDark: "#5BE38F",
        colorLight: "#12A150",
    },
    warn: {
        name: "exclamation-circle",
        color: "#de7622",
        colorDark: "#FFB65C",
        colorLight: "#C25E0C",
    },
} as const;

export function ToastBaseComponent() {
    const activeToast = activeToastStore.useValue();
    const colors = useColors();
    const t = useTokens();
    const { width: windowWidth } = useWindowDimensions();
    /** 宽屏按桌面通知处理：不限宽 688rpx，改自适应内容宽度 */
    const desktop = Platform.OS === "web" && windowWidth >= 600;

    const toastAnim = useSharedValue(0);

    const setNextToast = useCallback(() => {
        activeToastStore.setValue(toastQueue.shift() || null);
    }, []);

    useEffect(() => {
        if (activeToast) {
            toastAnim.value = withTiming(1, timingConfig.animationSlow, () => {
                toastAnim.value = withDelay(
                    activeToast.duration || 1200,
                    withTiming(0, timingConfig.animationSlow, finished => {
                        if (finished) {
                            runOnJS(setNextToast)();
                        }
                    }),
                );
            });
        }
    }, [activeToast]);

    function removeCurrentToast() {
        if (toastAnim.value === 1) {
            cancelAnimation(toastAnim);
            toastAnim.value = withTiming(
                0,
                timingConfig.animationSlow,
                finished => {
                    if (finished) {
                        runOnJS(setNextToast)();
                    }
                },
            );
        }
    }

    const flingGesture = Gesture.Fling()
        .direction(Directions.UP)
        .onEnd(() => {
            removeCurrentToast();
        })
        .runOnJS(true);

    const toastAnimStyle = useAnimatedStyle(() => {
        if (desktop) {
            /** 桌面：窗口顶部居中，从上方轻轻落下（不是从右下角冒出来） */
            return {
                opacity: toastAnim.value,
                transform: [{ translateY: (toastAnim.value - 1) * 16 }],
            };
        }
        return {
            transform: [
                {
                    translateY: (toastAnim.value - 1) * fixedTop,
                },
            ],
            opacity: toastAnim.value,
        };
    }, [desktop]);

    return activeToast ? (
        <GestureDetector gesture={flingGesture}>
            <View style={desktop ? styles.containerDesktop : styles.container}>
                <Animated.View
                    style={[
                        styles.contentContainer,
                        desktop && styles.contentContainerDesktop,
                        desktop && {
                            borderColor: colors.divider ?? "rgba(128,128,128,0.3)",
                            shadowColor: colors.shadow,
                        },
                        !desktop && { shadowColor: colors.shadow },
                        { backgroundColor: colors.notification },
                        toastAnimStyle,
                    ]}>
                    <Icon
                        size={fontSizeConst.appbar}
                        name={typeConfig[activeToast.type].name}
                        color={
                            t.isDark
                                ? typeConfig[activeToast.type].colorDark
                                : typeConfig[activeToast.type].colorLight
                        }
                    />
                    <Text
                        numberOfLines={2}
                        style={[
                            styles.text,
                            desktop && styles.textDesktop,
                            { color: colors.text },
                        ]}>
                        {activeToast.message}
                    </Text>
                    {activeToast.actionText && activeToast.onActionClick ? (
                        <Pressable
                            style={[
                                styles.actionTextContainer,
                                { backgroundColor: colors.primary },
                            ]}
                            onPress={activeToast.onActionClick}>
                            <Text style={styles.actionText} numberOfLines={1}>
                                {activeToast.actionText}
                            </Text>
                        </Pressable>
                    ) : null}
                </Animated.View>
            </View>
        </GestureDetector>
    ) : null;
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: rpx(128),
        width: "100%",
        alignItems: "center",
        height: rpx(100),
        zIndex: 20000,
    },
    /** 桌面：窗口水平居中 + 顶栏下方（与移动端同一个观感），不再贴右下角 */
    containerDesktop: {
        position: "absolute",
        top: 78,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 20000,
    },
    contentContainer: {
        width: rpx(688),
        height: "100%",
        borderRadius: rpx(12),
        backgroundColor: "blue",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,

        elevation: 2,
    },
    /** 桌面：宽度由内容决定，40 高、圆角 8、左右 14、细描边 */
    contentContainerDesktop: {
        width: "auto",
        minWidth: 180,
        maxWidth: 380,
        height: 40,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        shadowOffset: {
            width: 0,
            height: 6,
        },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 8,
    },
    text: {
        fontSize: fontSizeConst.content,
        includeFontPadding: false,
        flex: 1,
        marginLeft: rpx(24),
    },
    textDesktop: {
        /** 宽度按内容走（不能沿用移动端的 flex:1，否则卡片会被撑到最大宽度） */
        flexGrow: 0,
        flexShrink: 1,
        flexBasis: "auto",
        marginLeft: 8,
        fontSize: 13,
        lineHeight: 18,
    },
    actionText: {
        fontSize: fontSizeConst.content,
        includeFontPadding: false,
        color: "white",
    },
    actionTextContainer: {
        marginLeft: rpx(24),
        width: rpx(120),
        paddingHorizontal: rpx(12),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: rpx(30),
        height: rpx(58),
    },
});

export function showToast(config: IToastConfig) {
    const id = nanoid();
    const _config = {
        ...config,
        id,
    };
    const activeToast = activeToastStore.getValue();
    if (!activeToast) {
        activeToastStore.setValue(_config);
    } else {
        toastQueue.push(_config);
    }

    return id;
}
