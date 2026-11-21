/**
 * Windows 端设置外壳。
 *
 * 参照 Win11「设置」：左侧常驻导航 + 右侧内容区。移动端仍走
 * setting/index.tsx 的旧版式，两套互不干扰。
 * 600–840dp 是图标栏形态，再塞一列左栏会挤掉内容，改成顶部横向 chips。
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon, { IIconName } from "@/components/base/icon";
import { useLayoutMode } from "@/components/layout";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import { useTokens } from "@/theme";
import DeviceInfo from "react-native-device-info";
import PluginSetting from "../settingTypes/pluginSetting";
import AboutSettingDesktop from "./about";
import BasicSettingDesktop from "./basic";
import ThemeSettingDesktop from "./theme";

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : null;

/**
 * 面板一律留在渲染树里，只用 z-index 决定谁压在上面。
 *
 * 这几种隐藏方式都试过，问题都出在「重新出现」那一帧：
 * - `display:none` 把这棵子树摘出渲染树，再显示时要重新布局 + 重新光栅化，
 *   并且会新分配合成层。光栅化由合成器异步完成，tile 还没填好的那几帧
 *   会露出浅色占位 —— 深色主题下就是整块「亮一下」再恢复。页面内容越稀疏
 *   （大面积纯色、没有图片和渐变）越明显，所以只有主题设置页会闪。
 * - `visibility:hidden` / `opacity:0` 同样会把层标记为不可见，
 *   恢复可见时该层仍然要重新光栅化，且透明度过渡能抓到半透明帧。
 *
 * 叠放则是纯粹的绘制顺序变化：四个面板的像素一直有效，切换不触发布局、
 * 不触发重新光栅化，也没有中间态。前提是压在上面的那层必须完全不透明 ——
 * 每个面板都自带页面底色，内容页也铺满，下面那层不可能透出来。
 */
const panelActive: any = { zIndex: 1 };
const panelInactive: any = { zIndex: 0 };

/**
 * 让内容区自己成为一个层叠上下文。
 *
 * 面板是叠放的绝对定位层，不隔离时合成器丢弃某一层可能一路透到窗口底色；
 * 隔开之后，任何一帧没画上内容露出的都是这一块自己的页面底色。
 */
const webIsolate: any = isWeb ? { isolation: "isolate" } : null;


interface IPanel {
    key: string;
    labelKey: string;
    icon: IIconName;
    render: () => JSX.Element;
}

const PANELS: IPanel[] = [
    {
        key: "basic",
        labelKey: "sidebar.basicSettings",
        icon: "cog-8-tooth",
        render: () => <BasicSettingDesktop />,
    },
    {
        key: "plugin",
        labelKey: "sidebar.pluginManagement",
        icon: "puzzle-piece",
        render: () => <PluginSetting />,
    },
    {
        key: "theme",
        labelKey: "sidebar.themeSettings",
        icon: "t-shirt-outline",
        render: () => <ThemeSettingDesktop />,
    },
    {
        key: "about",
        labelKey: "common.about",
        icon: "information-circle",
        render: () => <AboutSettingDesktop />,
    },
];

interface INavItemProps {
    panel: IPanel;
    label: string;
    selected: boolean;
    vertical: boolean;
    onPress: () => void;
}

function NavItem({ panel, label, selected, vertical, onPress }: INavItemProps) {
    const t = useTokens();
    const ref = useRef<any>(null);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node: any = ref.current;
        if (!node?.addEventListener) {
            return;
        }
        const onEnter = () => setHovered(true);
        const onLeave = () => setHovered(false);
        node.addEventListener("pointerenter", onEnter);
        node.addEventListener("pointerleave", onLeave);
        return () => {
            node.removeEventListener("pointerenter", onEnter);
            node.removeEventListener("pointerleave", onLeave);
        };
    }, []);

    const selectedBg = t.color.primary.soft;
    return (
        <Pressable
            ref={ref}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed }) => [
                vertical ? styles.sideItem : styles.tabItem,
                webCursor,
                selected
                    ? { backgroundColor: vertical ? selectedBg : t.color.primary.base }
                    : hovered
                        ? { backgroundColor: t.color.bg.hover }
                        : null,
                pressed ? { opacity: 0.72 } : null,
            ]}>
            {vertical ? (
                /**
                 * 指示条常驻、只切透明度。
                 * 条件渲染会在每次切换时插入/移除一个绝对定位节点，
                 * DOM 结构一变，这一小块就要重新布局 + 重绘，
                 * 是切换里唯一会增删节点的地方，留着它就是留一个闪点。
                 */
                <View
                    style={[
                        styles.sideIndicator,
                        { backgroundColor: t.color.primary.base },
                        selected ? null : styles.sideIndicatorHidden,
                    ]}
                />
            ) : null}
            <Icon
                name={panel.icon}
                size={17}
                color={
                    selected
                        ? t.color.primary.base
                        : t.color.text.secondary
                }
            />
            <Text
                numberOfLines={1}
                style={[
                    styles.navLabel,
                    {
                        color: selected
                            ? t.color.text.primary
                            : t.color.text.secondary,
                    },
                ]}>
                {label}
            </Text>
        </Pressable>
    );
}

export default function SettingDesktop() {
    const { t } = useI18N();
    const tokens = useTokens();
    // 桌面端可能直接打开 setting 而未带参数；backup 在 Windows 上不可达
    const params = useParams<"setting">();
    const rawType = params?.type ?? "basic";
    const type = PANELS.some(panel => panel.key === rawType)
        ? rawType
        : "basic";
    const vertical = useLayoutMode() === "sidebar";

    /**
     * 分类切换用本地状态，不走 navigation.setParams。
     * 派发导航动作会让整个导航树重新求值（onStateChange -> 外壳重渲染），
     * 切换瞬间会有一帧整块重绘，肉眼就是「闪一下」。
     */
    const [active, setActive] = useState(type);

    useEffect(() => {
        // 深链 / 外部带参进来时跟随一次
        setActive(type);
    }, [type]);

    /**
     * 四个面板一开始就全部挂载，切换时只改显隐。
     *
     * 之前是「首次访问才挂载 + display:none 隐藏」，切换那一刻既要插入一棵
     * 新子树（挂载、量高、按新宽度重排），又要把旧的从渲染树里摘掉，
     * 这一帧浏览器需要重做大量工作，慢一拍就会漏出空白或被重绘，
     * 看起来就是整块闪一下。面板本身都是静态卡片，全部预挂载的代价很小。
     */
    const onSelect = (key: string) => {
        if (key !== active) {
            setActive(key);
        }
    };

    /**
     * 面板元素只创建一次。
     *
     * 直接在 map 里调 `panel.render()` 会每次渲染都生成全新的 element，
     * 引用不同，React 就必须把四个面板（每个几十个 SettingRow / Switch）
     * 全部重新执行一遍；一次切换的渲染成本远超一帧，掉帧漏出来的颜色
     * 与页面反差越大越容易被看见 —— 深色主题下尤其明显。
     * 这些 element 不依赖任何 props，缓存后非当前面板直接走 bailout，
     * 切换只剩下包裹层的两个 style 变化。
     */
    const panelElements = useMemo(
        () => PANELS.map(panel => panel.render()),
        [],
    );

    const navItems = PANELS.map(panel => (
        <NavItem
            key={panel.key}
            panel={panel}
            label={t(panel.labelKey as any)}
            selected={panel.key === active}
            vertical={vertical}
            onPress={() => onSelect(panel.key)}
        />
    ));

    return (
        <SafeAreaView
            edges={["bottom", "top"]}
            style={[styles.wrapper, { backgroundColor: tokens.color.bg.base }]}>
            <View style={[styles.body, vertical && styles.bodyRow]}>
                {vertical ? (
                    <View
                        style={[
                            styles.sideNav,
                            {
                                // 与右侧内容区同底色，只靠一条细线分区，避免整块深色压过来
                                backgroundColor: tokens.color.bg.base,
                                borderRightColor: tokens.color.divider,
                            },
                        ]}>
                        <Text
                            style={[
                                styles.sideTitle,
                                { color: tokens.color.text.primary },
                            ]}>
                            {t("common.setting" as any)}
                        </Text>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.sideSubtitle,
                                { color: tokens.color.text.tertiary },
                            ]}>
                            {DeviceInfo.getApplicationName()}
                        </Text>
                        <View style={styles.sideItems}>{navItems}</View>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[
                            styles.tabBar,
                            {
                                backgroundColor: tokens.color.bg.base,
                                borderBottomColor: tokens.color.divider,
                            },
                        ]}
                        contentContainerStyle={styles.tabBarContent}>
                        {navItems}
                    </ScrollView>
                )}
                <View
                    testID="setting-panels"
                    style={[
                        styles.main,
                        webIsolate,
                        { backgroundColor: tokens.color.bg.base },
                    ]}>
                    {PANELS.map((panel, index) => (
                        <View
                            key={panel.key}
                            // 隐藏的不参与命中测试，滚轮/点击不会漏到看不见的页面上
                            pointerEvents={
                                panel.key === active ? "auto" : "none"
                            }
                            style={[
                                styles.panel,
                                /**
                                 * 每个面板自带不透明底色。
                                 * 压在上面的那一层必须完全遮住下面的，任何一处
                                 * 露出别的页面都是穿帮。
                                 */
                                { backgroundColor: tokens.color.bg.base },
                                panel.key === active
                                    ? panelActive
                                    : panelInactive,
                            ]}>
                            {panelElements[index]}
                        </View>
                    ))}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    bodyRow: {
        flexDirection: "row",
    },
    main: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        // 面板叠放在同一格里：切换只改叠放顺序，不参与外层重排
        position: "relative",
    },
    panel: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    sideNav: {
        width: 208,
        flexShrink: 0,
        paddingHorizontal: 12,
        paddingTop: 20,
        borderRightWidth: StyleSheet.hairlineWidth,
    },
    sideTitle: {
        fontSize: 20,
        lineHeight: 28,
        fontWeight: "500",
        marginLeft: 8,
        includeFontPadding: false,
    },
    sideSubtitle: {
        fontSize: 11.5,
        lineHeight: 16,
        marginLeft: 8,
        marginTop: 2,
        marginBottom: 18,
        includeFontPadding: false,
    },
    sideItems: {
        gap: 3,
    },
    sideItem: {
        height: 36,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderRadius: 6,
        overflow: "hidden",
    },
    sideIndicator: {
        position: "absolute",
        left: 0,
        top: 9,
        bottom: 9,
        width: 3,
        borderRadius: 2,
    },
    sideIndicatorHidden: {
        opacity: 0,
    },
    navLabel: {
        fontSize: 13,
        lineHeight: 18,
        includeFontPadding: false,
    },
    tabBar: {
        flexGrow: 0,
        flexShrink: 0,
        maxHeight: 52,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabBarContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        alignItems: "center",
    },
    tabItem: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
});
