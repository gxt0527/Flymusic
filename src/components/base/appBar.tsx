import React, { ReactNode } from "react";
import {
    Platform,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
    useWindowDimensions,
} from "react-native";
import rpx from "@/utils/rpx";
import useColors from "@/hooks/useColors";
import StatusBar from "./statusBar";
import color from "color";
import IconButton from "./iconButton";
import globalStyle from "@/constants/globalStyle";
import ThemeText from "./themeText";
import { useNavigation } from "@react-navigation/native";
import Animated, {
    SharedValue,
    interpolate,
    useAnimatedStyle,
} from "react-native-reanimated";
import { IIconName } from "@/components/base/icon.tsx";
import MenuButton, { IMenuOption } from "./menuButton";
import { breakpoint } from "@/theme";

interface IAppBarProps {
    titleTextOpacity?: number;
    withStatusBar?: boolean;
    color?: string;
    actions?: Array<{
        icon: IIconName;
        onPress?: () => void;
    }>;
    menu?: IMenuOption[];
    children?: string | ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    actionComponent?: ReactNode;
    onBackPress?: () => void;
    /**
     * 列表滚动进度（0~1）。给了就把大标题按进度向上收起并淡出，
     * 用于「我的收藏」这类需要折叠头部的页面；不给则标题恒定显示。
     */
    collapseProgress?: SharedValue<number>;
}

export default function AppBar(props: IAppBarProps) {
    const {
        titleTextOpacity = 1,
        withStatusBar,
        color: _color,
        actions = [],
        menu = [],
        containerStyle,
        contentStyle,
        children,
        actionComponent,
        onBackPress,
        collapseProgress,
    } = props;

    const colors = useColors();
    const navigation = useNavigation();
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = Platform.OS === "web" && windowWidth >= breakpoint.compact;
    /**
     * 窄屏（底部 Tab）恒显示返回键；桌面侧栏常驻，一级页不需要返回。
     * 桌面端的返回键统一挪到了全局顶栏搜索框左侧（见 layout/desktopTopBar），
     * 页内不再重复一个 —— 只有浮层（编辑歌单信息、评论）自己传 onBackPress，
     * 那种场景下必须保留，否则浮层没有关闭入口。
     */
    const showBack = windowWidth < breakpoint.compact || !!onBackPress;

    const bgColor = color(colors.appBar ?? colors.primary).toString();
    const contentColor = _color ?? colors.appBarText;

    /** 标题收起：向上位移 + 淡出，滚动越深收得越干净 */
    const titleCollapseStyle = useAnimatedStyle(() => {
        const progress = collapseProgress ? collapseProgress.value : 0;
        return {
            opacity: interpolate(progress, [0, 1], [1, 0]),
            transform: [
                { translateY: interpolate(progress, [0, 1], [0, -14]) },
            ],
        };
    });

    /**
     * 标题收起后整条也跟着收：一直收到 0，标题行彻底让出高度。
     * 歌单内搜索与 ⋮ 已经移到操作行，标题栏里没有别的东西要留，不必留最小高度。
     */
    const barCollapseStyle = useAnimatedStyle(() => {
        const progress = collapseProgress ? collapseProgress.value : 0;
        return {
            height: interpolate(progress, [0, 1], [52, 0]),
            overflow: "hidden" as const,
        };
    });

    return (
        <>
            {withStatusBar ? <StatusBar backgroundColor={bgColor} /> : null}
            <Animated.View
                style={[
                    styles.container,
                    isDesktop && styles.containerDesktop,
                    containerStyle,
                    { backgroundColor: isDesktop ? "transparent" : bgColor },
                    collapseProgress ? barCollapseStyle : null,
                ]}>
                {showBack ? (
                    <IconButton
                        accessibilityLabel="返回"
                        name="arrow-left"
                        sizeType="normal"
                        color={contentColor}
                        style={[
                            globalStyle.notShrink,
                            isDesktop ? { marginRight: 10 } : null,
                        ]}
                        onPress={
                            onBackPress ||
                            (() => {
                                navigation.goBack();
                            })
                        }
                    />
                ) : null}
                <View
                    style={[
                        globalStyle.grow,
                        styles.content,
                        isDesktop && styles.contentDesktop,
                        contentStyle,
                    ]}>
                    {typeof children === "string" ? (
                        <Animated.View
                            style={[styles.titleHost, titleCollapseStyle]}
                            pointerEvents="none">
                            <ThemeText
                                fontSize="title"
                                fontWeight="bold"
                                numberOfLines={1}
                                style={
                                    isDesktop ? styles.titleDesktop : undefined
                                }
                                color={
                                    titleTextOpacity !== 1
                                        ? color(contentColor)
                                            .alpha(titleTextOpacity)
                                            .toString()
                                        : contentColor
                                }>
                                {children}
                            </ThemeText>
                        </Animated.View>
                    ) : (
                        children
                    )}
                </View>
                {actions.map((action, index) => (
                    <IconButton
                        key={index}
                        name={action.icon}
                        sizeType="normal"
                        color={contentColor}
                        style={[globalStyle.notShrink, styles.rightButton]}
                        onPress={action.onPress}
                    />
                ))}
                {actionComponent ?? null}
                <MenuButton
                    menu={menu}
                    color={contentColor}
                    style={[globalStyle.notShrink, styles.rightButton]}
                />
                {/* 桌面：顶栏的齿轮与窗口控件由 DesktopTopBar 统一提供，
                    这里不再重复渲染，AppBar 在桌面退化为「页内标题」 */}
            </Animated.View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        width: "100%",
        zIndex: 10000,
        height: rpx(88),
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    containerDesktop: {
        /** 桌面：不再是一条通栏标题条，而是内容区里的页内标题 */
        height: 52,
        paddingHorizontal: 20,
        alignItems: "center",
    },
    contentDesktop: {
        paddingHorizontal: 0,
    },
    /** 标题的动画容器：占满剩余宽度，让 numberOfLines 的省略号仍按整行算 */
    titleHost: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
    },
    titleDesktop: {
        fontSize: 19,
        lineHeight: 26,
        fontWeight: "600",
    },
    content: {
        flexDirection: "row",
        flexBasis: 0,
        alignItems: "center",
        paddingHorizontal: rpx(24),
    },
    rightButton: {
        marginLeft: rpx(28),
    },
});
