/**
 * Windows 设置页基础组件。
 *
 * 桌面设置不用移动端那套 rpx 列表：Win11「设置」是「分组标题 + 卡片」，
 * 卡片内每行 48 高、左侧标题/说明、右侧控件，行与行只用一条细线分隔。
 * 这里所有尺寸都是固定 px，跟随 tokens 的语义色，明暗主题自动切换。
 */
import React, { ReactNode, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Slider from "@react-native-community/slider";

import Icon from "@/components/base/icon";
import Portal from "@/components/base/portal";
import ContextMenu from "@/components/panels/contextMenu";
import { useTokens } from "@/theme";
import measureNodeRect, { INodeRect } from "@/utils/measureNode";

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : null;
/** RN-Web 会把不认识的样式原样 hyphenate 成 CSS，滚槽占位只在 web 生效 */
const webScrollbarGutter = isWeb
    ? ({ scrollbarGutter: "stable" } as any)
    : null;

interface ISettingsPageProps {
    title: string;
    description?: string;
    children: ReactNode;
}

/** 一整页：窗口底色 + 限宽 720 的滚动内容 + 页头 */
export function SettingsPage({
    title,
    description,
    children,
}: ISettingsPageProps) {
    const t = useTokens();
    return (
        <ScrollView
            style={[
                styles.page,
                { backgroundColor: t.color.bg.base },
                /**
                 * 常驻滚动条槽位：基本设置能滚、主题设置不能滚，
                 * 槽位一出现一消失，内容就会左右跳 8px（看起来像闪一下）。
                 */
                webScrollbarGutter,
            ]}
            contentContainerStyle={styles.pageContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.measure}>
                <Text
                    style={[styles.pageTitle, { color: t.color.text.primary }]}>
                    {title}
                </Text>
                {description ? (
                    <Text
                        style={[
                            styles.pageDescription,
                            { color: t.color.text.secondary },
                        ]}>
                        {description}
                    </Text>
                ) : null}
                {children}
            </View>
        </ScrollView>
    );
}

interface ISettingGroupProps {
    title?: string;
    children: ReactNode;
}

/** 卡片比浮层轻：细描边 + 极淡投影，白底主题下靠描边分层 */
export function SettingGroup({ title, children }: ISettingGroupProps) {
    const t = useTokens();
    const items = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={styles.group}>
            {title ? (
                <Text
                    style={[
                        styles.groupTitle,
                        { color: t.color.text.secondary },
                    ]}>
                    {title}
                </Text>
            ) : null}
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: t.color.bg.raised,
                        borderColor: t.color.border,
                        shadowColor: t.color.shadow,
                    },
                    t.isDark ? styles.cardDark : styles.cardLight,
                ]}>
                {items.map((child, index) => (
                    <View key={index}>
                        {index > 0 ? (
                            <View
                                style={[
                                    styles.divider,
                                    { backgroundColor: t.color.divider },
                                ]}
                            />
                        ) : null}
                        {child}
                    </View>
                ))}
            </View>
        </View>
    );
}

interface ISettingRowProps {
    title: string;
    description?: string;
    right?: ReactNode;
    onPress?: () => void;
    testID?: string;
}

/**
 * 悬停不走 Pressable 的 onHoverIn：RN-Web 内部 contain 机制的 hover lock
 * 会在指针进入行内子 Pressable（开关、按钮）时把整行判定为已离开。
 * 用不冒泡的原生 pointerenter / pointerleave 才是「进出这一行」的语义。
 */
export function SettingRow({
    title,
    description,
    right,
    onPress,
    testID,
}: ISettingRowProps) {
    const t = useTokens();
    const rowRef = useRef<any>(null);
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node: any = rowRef.current;
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

    const body = (
        <View
            style={[
                styles.row,
                hovered && onPress
                    ? { backgroundColor: t.color.bg.hover }
                    : null,
            ]}>
            <View style={styles.rowLabel}>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.rowTitle,
                        { color: t.color.text.primary },
                    ]}>
                    {title}
                </Text>
                {description ? (
                    <Text
                        numberOfLines={2}
                        style={[
                            styles.rowDescription,
                            { color: t.color.text.tertiary },
                        ]}>
                        {description}
                    </Text>
                ) : null}
            </View>
            <View style={styles.rowRight}>{right}</View>
        </View>
    );

    return onPress ? (
        <Pressable
            ref={rowRef}
            testID={testID}
            onPress={onPress}
            style={[styles.rowPressable, webCursor]}>
            {body}
        </Pressable>
    ) : (
        <View ref={rowRef} testID={testID}>
            {body}
        </View>
    );
}

interface ISettingToggleProps {
    value: boolean;
    onValueChange: (next: boolean) => void;
}

/** Win11 拨动开关：40×20 胶囊，开时主色填充、圆点滑到右侧 */
export function SettingToggle({ value, onValueChange }: ISettingToggleProps) {
    const t = useTokens();
    const progress = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        progress.value = withTiming(value ? 1 : 0, { duration: 130 });
    }, [value, progress]);

    const offTrack = t.color.bg.input;
    const offBorder = t.isDark ? "#6E6E6E" : "#8A8A8A";
    const offKnob = t.isDark ? "#B4B4B4" : "#5B5B5B";

    const trackStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [offTrack, t.color.primary.base],
        ),
        borderColor: interpolateColor(
            progress.value,
            [0, 1],
            [offBorder, t.color.primary.base],
        ),
    }));
    const knobStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            progress.value,
            [0, 1],
            [offKnob, "#FFFFFF"],
        ),
        transform: [{ translateX: progress.value * 20 }],
    }));

    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            onPress={() => onValueChange(!value)}
            style={[styles.toggleHit, webCursor]}>
            <Animated.View style={[styles.toggleTrack, trackStyle]}>
                <Animated.View style={[styles.toggleKnob, knobStyle]} />
            </Animated.View>
        </Pressable>
    );
}

export interface ISettingSelectOption {
    label: string;
    value: string | number;
}

interface ISettingSelectProps {
    title: string;
    description?: string;
    value: string | number;
    valueLabel: string;
    options: ISettingSelectOption[];
    onSelect: (value: string | number) => void;
    testID?: string;
}

/** 就地向下菜单：与右键菜单、⋮ 菜单共用同一套 Win11 外观 */
export function SettingSelect(props: ISettingSelectProps) {
    const { title, description, value, valueLabel, options, onSelect, testID } =
        props;
    const t = useTokens();
    const ref = useRef<any>(null);
    const [anchor, setAnchor] = useState<INodeRect | null>(null);

    const toggle = () => {
        if (anchor) {
            setAnchor(null);
            return;
        }
        const rect = measureNodeRect(ref.current);
        setAnchor(rect ?? { x: 0, y: 0, width: 0, height: 0 });
    };

    return (
        <View ref={ref} testID={testID} collapsable={false}>
            <SettingRow
                title={title}
                description={description}
                onPress={toggle}
                right={
                    <View style={styles.selectValue}>
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.valueText,
                                { color: t.color.text.secondary },
                            ]}>
                            {valueLabel}
                        </Text>
                        <Icon
                            name="chevron-down"
                            size={13}
                            color={t.color.text.tertiary}
                        />
                    </View>
                }
            />
            {anchor ? (
                <Portal>
                    <ContextMenu
                        testID="setting-select-menu"
                        anchor={anchor}
                        width={248}
                        items={options.map(option => ({
                            key: `setting-select-${option.value}`,
                            label: option.label,
                            checked: option.value === value,
                            onPress: () => onSelect(option.value),
                        }))}
                        onClose={() => setAnchor(null)}
                    />
                </Portal>
            ) : null}
        </View>
    );
}

interface ISettingButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
}

export function SettingButton({
    label,
    onPress,
    disabled,
    testID,
}: ISettingButtonProps) {
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

    return (
        <Pressable
            ref={ref}
            testID={testID}
            disabled={disabled}
            onPress={onPress}
            style={[
                styles.button,
                {
                    borderColor: t.color.border,
                    backgroundColor: hovered
                        ? t.color.bg.hover
                        : t.color.bg.raised,
                },
                disabled ? styles.disabledButton : null,
                webCursor,
            ]}>
            <Text
                style={[
                    styles.buttonLabel,
                    { color: t.color.text.primary },
                ]}>
                {label}
            </Text>
        </Pressable>
    );
}

export function SettingValue({ text }: { text: string }) {
    const t = useTokens();
    return (
        <Text
            numberOfLines={1}
            style={[styles.valueText, { color: t.color.text.secondary }]}>
            {text}
        </Text>
    );
}

interface ISettingSliderProps {
    title: string;
    description?: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatValue?: (value: number) => string;
    onValueChange?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
}

/**
 * 滑块自己存一份拖动中的值：只在 onSlidingComplete 写配置的话，
 * 受控 value 会一直停在旧值，松手前滑块看起来根本没动。
 */
export function SettingSlider(props: ISettingSliderProps) {
    const {
        title,
        description,
        value,
        min,
        max,
        step,
        formatValue,
        onValueChange,
        onSlidingComplete,
    } = props;
    const t = useTokens();
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    return (
        <SettingRow
            title={title}
            description={description}
            right={
                <View style={styles.sliderWrap}>
                    <Slider
                        style={styles.slider}
                        minimumValue={min}
                        maximumValue={max}
                        step={step}
                        value={local}
                        minimumTrackTintColor={t.color.primary.base}
                        maximumTrackTintColor={t.color.divider}
                        thumbTintColor={t.color.primary.base}
                        onValueChange={next => {
                            setLocal(next);
                            onValueChange?.(next);
                        }}
                        onSlidingComplete={onSlidingComplete}
                    />
                    <Text
                        style={[
                            styles.sliderValue,
                            { color: t.color.text.secondary },
                        ]}>
                        {formatValue ? formatValue(local) : String(local)}
                    </Text>
                </View>
            }
        />
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
    },
    pageContent: {
        paddingHorizontal: 28,
        paddingTop: 24,
        paddingBottom: 48,
    },
    measure: {
        width: "100%",
        maxWidth: 720,
        alignSelf: "center",
    },
    pageTitle: {
        fontSize: 22,
        lineHeight: 30,
        fontWeight: "500",
        includeFontPadding: false,
    },
    pageDescription: {
        fontSize: 12.5,
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 8,
        includeFontPadding: false,
    },
    group: {
        marginTop: 20,
    },
    groupTitle: {
        fontSize: 13,
        lineHeight: 19,
        fontWeight: "600",
        marginBottom: 8,
        includeFontPadding: false,
    },
    card: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: "hidden",
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
    },
    cardDark: {
        shadowOpacity: 0.22,
    },
    cardLight: {
        shadowOpacity: 0.06,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16,
    },
    rowPressable: {
        width: "100%",
    },
    row: {
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    rowLabel: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    rowTitle: {
        fontSize: 13.5,
        lineHeight: 19,
        fontWeight: "400",
        includeFontPadding: false,
    },
    rowDescription: {
        fontSize: 11.5,
        lineHeight: 16,
        marginTop: 2,
        includeFontPadding: false,
    },
    rowRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
        maxWidth: "58%",
    },
    valueText: {
        fontSize: 12.5,
        lineHeight: 18,
        textAlign: "right",
        includeFontPadding: false,
    },
    selectValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexShrink: 1,
        minWidth: 0,
    },
    toggleHit: {
        width: 48,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    toggleTrack: {
        width: 40,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        padding: 2,
        justifyContent: "center",
    },
    toggleKnob: {
        position: "absolute",
        left: 3,
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    button: {
        height: 30,
        minWidth: 72,
        paddingHorizontal: 12,
        borderRadius: 5,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonLabel: {
        fontSize: 12.5,
        lineHeight: 18,
        includeFontPadding: false,
    },
    sliderWrap: {
        width: 230,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    slider: {
        flex: 1,
        height: 28,
    },
    sliderValue: {
        fontSize: 11.5,
        width: 42,
        textAlign: "right",
        includeFontPadding: false,
    },
});
