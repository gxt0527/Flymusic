import React, { ReactNode, createContext, useContext, useEffect, useMemo, useRef } from "react";
import {
    BackHandler,
    NativeEventSubscription,
    Platform,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import rpx, { vh, vw } from "@/utils/rpx";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { timingConfig } from "@/constants/commonConst";
import useColors from "@/hooks/useColors";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import { fontSizeConst } from "@/constants/uiConst";
import { ScrollView } from "react-native-gesture-handler";
import useOrientation from "@/hooks/useOrientation.ts";
import { useTokens } from "@/theme";

interface IDialogProps {
    onDismiss?: () => void;
    children?: ReactNode;
    /** 覆盖弹窗容器尺寸/圆角/描边，供 Windows 风格等定制弹窗使用 */
    dialogStyle?: StyleProp<ViewStyle>;
}

/**
 * 弹窗形态。
 *
 * 手机 / 竖屏沿用原来的「整屏宽卡片 + 通栏按钮」，但 Windows 端的对话框
 * 完全是另一套规格：420 宽的卡片、左对齐标题、右下角两个固定宽度的矩形
 * 按钮。之前只有宽高做了适配，标题居中 + 按钮平分整行依旧是移动端观感，
 * 这里把「形态」显式往下传，三个子组件分别按形态取样式。
 */
type IDialogVariant = "mobile" | "desktop";

const DialogVariantContext = createContext<IDialogVariant>("mobile");

function useDialogVariant() {
    return useContext(DialogVariantContext);
}

function Dialog(props: IDialogProps) {
    const { children, onDismiss, dialogStyle } = props;

    const sharedShowValue = useSharedValue(0);
    const colors = useColors();
    const tokens = useTokens();
    const backHandlerRef = useRef<NativeEventSubscription>();
    const orientation = useOrientation();

    const variant: IDialogVariant =
        Platform.OS === "web" && orientation === "horizontal"
            ? "desktop"
            : "mobile";
    const isDesktop = variant === "desktop";

    /**
     * 对话框宽度：
     *  - 竖屏（手机）：留左右边距
     *  - 横屏 Web / Electron：原来写 80% 屏宽，1200px 窗口会拉出近 1000px
     *    的「平板弹窗」，典型移动端布局残留；桌面统一按 Windows 对话框宽度。
     *  - 其它横屏原生设备（平板）保留 80%。
     */
    const dialogContainerStyle: ViewStyle =
        orientation === "vertical"
            ? {
                width: vw(100) - rpx(72),
            }
            : isDesktop
                ? {
                    width: 420,
                    maxWidth: "92%" as any,
                }
                : {
                    width: "80%",
                };

    useEffect(() => {
        sharedShowValue.value = 1;
        if (backHandlerRef.current) {
            backHandlerRef.current?.remove();
            backHandlerRef.current = undefined;
        }
        backHandlerRef.current = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                onDismiss?.();
                return true;
            },
        );

        return () => {
            sharedShowValue.value = 0;
            if (backHandlerRef.current) {
                backHandlerRef.current?.remove();
                backHandlerRef.current = undefined;
            }
        };
    }, []);

    const containerStyle = useAnimatedStyle(() => {
        return {
            opacity: withTiming(
                sharedShowValue.value,
                timingConfig.animationFast,
            ),
        };
    });

    const scaleAnimationStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    scale: withTiming(
                        0.9 + sharedShowValue.value * 0.1,
                        timingConfig.animationFast,
                    ),
                },
            ],
        };
    });

    return (
        <DialogVariantContext.Provider value={variant}>
            <View style={styles.backContainer}>
                <TouchableWithoutFeedback
                    style={styles.container}
                    onPress={onDismiss}>
                    <Animated.View style={[styles.container, containerStyle]} />
                </TouchableWithoutFeedback>
                <Animated.View
                    style={[
                        styles.dialogContainer,
                        dialogContainerStyle,
                        isDesktop && {
                            // Windows 对话框：直角一点、细描边、不要手机那种大圆角
                            borderRadius: 8,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: tokens.color.border,
                            overflow: "hidden",
                        },
                        containerStyle,
                        isDesktop ? null : scaleAnimationStyle,
                        dialogStyle,
                        {
                            backgroundColor: isDesktop
                                ? tokens.color.bg.raised
                                : colors.backdrop,
                            shadowColor: colors.shadow,
                        },
                    ]}>
                    {children}
                </Animated.View>
            </View>
        </DialogVariantContext.Provider>
    );
}

interface IDialogTitleProps {
    children?: ReactNode;
    withDivider?: boolean;
    stringContent?: boolean;
    containerStyle?: StyleProp<ViewStyle>;
}

function Title(props: IDialogTitleProps) {
    const { children, withDivider, stringContent, containerStyle } = props;
    const variant = useDialogVariant();
    const isDesktop = variant === "desktop";
    const t = useTokens();

    return (
        <>
            <View
                style={[
                    styles.titleContainer,
                    isDesktop && styles.titleContainerDesktop,
                    containerStyle,
                ]}>
                {typeof children === "string" || stringContent ? (
                    <ThemeText
                        fontSize="title"
                        fontWeight="bold"
                        numberOfLines={1}
                        style={isDesktop ? styles.titleDesktop : undefined}>
                        {children}
                    </ThemeText>
                ) : (
                    children
                )}
            </View>
            {withDivider ? (
                <Divider
                    style={
                        isDesktop
                            ? { backgroundColor: t.color.divider }
                            : undefined
                    }
                />
            ) : null}
        </>
    );
}

interface IDialogContentProps {
    children?: ReactNode;
    style?: StyleProp<ViewStyle>;
    needScroll?: boolean;
}

function Content(props: IDialogContentProps) {
    const { children, style, needScroll } = props;
    const isDesktop = useDialogVariant() === "desktop";

    const content =
        typeof children === "string" ? (
            <ThemeText
                fontSize="content"
                style={[
                    styles.defaultFontStyle,
                    isDesktop && styles.defaultFontStyleDesktop,
                ]}>
                {children}
            </ThemeText>
        ) : (
            children
        );

    return (
        <View
            style={[
                styles.contentContainer,
                isDesktop && styles.contentContainerDesktop,
                {
                    maxHeight: vh(50),
                },
                style,
            ]}>
            {needScroll ? <ScrollView>{content}</ScrollView> : content}
        </View>
    );
}

interface IDialogActionsProps {
    children?: ReactNode;
    actions?: Array<{
        title: string;
        type?: "normal" | "primary";
        show?: boolean;
        onPress?: () => void;
    }>;
    style?: StyleProp<ViewStyle>;
}

function Actions(props: IDialogActionsProps) {
    const { children, style, actions } = props;
    const isDesktop = useDialogVariant() === "desktop";

    const validActions = useMemo(
        () => actions?.filter(it => it.show !== false),
        [actions],
    );

    /**
     * Windows 对话框的按钮序是「确定 取消」（主按钮在左），
     * 移动端习惯是「取消 确定」。桌面这里整体反转，避免右键习惯错位。
     */
    const orderedActions = useMemo(
        () => (isDesktop ? [...(validActions ?? [])].reverse() : validActions),
        [isDesktop, validActions],
    );

    const _children = orderedActions?.length ? (
        <>
            {orderedActions.map((it, index) => (
                <BottomButton
                    key={index}
                    style={
                        isDesktop
                            ? index === 0
                                ? null
                                : styles.actionButtonDesktop
                            : index === 0
                                ? null
                                : styles.actionButton
                    }
                    onPress={it.onPress}
                    text={it.title}
                    type={it.type}
                />
            ))}
        </>
    ) : (
        children
    );

    return (
        <View
            style={[
                styles.actionsContainer,
                isDesktop && styles.actionsContainerDesktop,
                style,
            ]}>
            {typeof children === "string" ? (
                <ThemeText fontSize="content" numberOfLines={1}>
                    {children}
                </ThemeText>
            ) : (
                _children
            )}
        </View>
    );
}

function BottomButton(props: {
    type?: "normal" | "primary";
    text: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}) {
    const { type = "normal", text, style, onPress } = props;
    const colors = useColors();
    const tokens = useTokens();
    const isDesktop = useDialogVariant() === "desktop";

    return (
        <TouchableOpacity
            activeOpacity={0.6}
            onPress={onPress}
            style={[
                isDesktop ? styles.bottomBtnDesktop : styles.bottomBtn,
                isDesktop
                    ? {
                        backgroundColor:
                              type === "normal"
                                  ? tokens.color.bg.base
                                  : tokens.color.primary.base,
                        borderColor:
                              type === "normal"
                                  ? tokens.color.border
                                  : tokens.color.primary.base,
                    }
                    : {
                        backgroundColor:
                              type === "normal"
                                  ? colors.placeholder
                                  : colors.primary,
                    },
                style,
            ]}>
            <ThemeText
                color={
                    isDesktop && type === "normal"
                        ? tokens.color.text.primary
                        : type === "normal"
                            ? undefined
                            : "white"
                }
                style={isDesktop ? styles.bottomBtnTextDesktop : undefined}>
                {text}
            </ThemeText>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    bottomBtn: {
        borderRadius: rpx(8),
        flex: 1,
        flexShrink: 0,
        justifyContent: "center",
        alignItems: "center",
        height: rpx(72),
    },
    /** Windows：定宽、直角、细描边，右对齐的两个小按钮 */
    bottomBtnDesktop: {
        minWidth: 88,
        height: 30,
        paddingHorizontal: 14,
        borderRadius: 4,
        borderWidth: 1,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: "auto",
        justifyContent: "center",
        alignItems: "center",
    },
    bottomBtnTextDesktop: {
        fontSize: 12.5,
        lineHeight: 16,
    },
    backContainer: {
        position: "absolute",
        zIndex: 16299,
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        alignItems: "center",
        justifyContent: "center",
    },
    container: {
        zIndex: 16300,
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    dialogContainer: {
        /**
         * 不用 absolute：父容器已经是 align/justify center 的 flex 容器，
         * 绝对定位在 Web 上会退化成「按父容器起点摆放」，弹窗就贴到左上角去。
         * 这里交给 flex 居中，手机和桌面都稳。
         */
        width: "80%",
        zIndex: 16310,
        borderRadius: rpx(16),
        backgroundColor: "red",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.5,
        shadowRadius: 4,

        elevation: 5,
    },

    defaultFontStyle: {
        lineHeight: fontSizeConst.content * 1.5,
    },
    defaultFontStyleDesktop: {
        fontSize: 13,
        lineHeight: 20,
        textAlign: "left",
    },

    /**** title */
    titleContainer: {
        height: rpx(88),
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: rpx(24),
    },
    /** Windows 标题栏：左对齐、更矮、只留左边距 */
    titleContainerDesktop: {
        height: 44,
        justifyContent: "flex-start",
        paddingHorizontal: 20,
    },
    titleDesktop: {
        fontSize: 14.5,
        lineHeight: 20,
        textAlign: "left",
        fontWeight: "600",
    },
    /** content */
    contentContainer: {
        width: "100%",
        paddingHorizontal: rpx(24),
        paddingVertical: rpx(36),
    },
    contentContainerDesktop: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 18,
    },
    /** actions */
    actionsContainer: {
        width: "100%",
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: rpx(24),
        marginBottom: rpx(12),
        flexWrap: "nowrap",
    },
    actionsContainerDesktop: {
        height: 56,
        paddingHorizontal: 16,
        marginBottom: 0,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(128,128,128,0.18)",
    },
    actionButton: {
        marginLeft: rpx(24),
    },
    actionButtonDesktop: {
        marginLeft: 0,
    },
});

Dialog.Title = Title;
Dialog.Content = Content;
Dialog.Actions = Actions;

export default Dialog;
