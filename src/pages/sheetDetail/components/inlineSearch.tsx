/**
 * 歌单内联搜索（桌面端）
 *
 * 以前点放大镜会 push 一个 search-music-list 整页，把歌单盖掉；现在改成
 * 在标题行右侧向左展开一条固定宽度的搜索栏，输入即过滤当前歌单。
 *
 * 结构： [ 输入栏（宽度 0 → 236 动画） ][ 放大镜按钮 ]
 * 放大镜按钮固定在行尾不动，输入栏从它左边长出来，看起来就是「向左展开」；
 * 收缩时反向缩回，按钮位置始终不变，不会左右跳。
 *
 * 输入栏在收起状态下不挂载 —— 挂载着既拿不到 autoFocus，也会截走点击。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    View,
    useWindowDimensions,
} from "react-native";
import Color from "color";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import Icon from "@/components/base/icon";
import Input from "@/components/base/input";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";

const BAR_WIDTH = 236;
const ANIMATION = { duration: 180, easing: Easing.out(Easing.cubic) };

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface IInlineSheetSearchProps {
    value: string;
    onChange: (value: string) => void;
}

export default function InlineSheetSearch(props: IInlineSheetSearchProps) {
    const { value, onChange } = props;
    const t = useTokens();
    const { t: translate } = useI18N();
    const [open, setOpen] = useState(false);
    const { width: windowWidth } = useWindowDimensions();

    /** 窄窗口（rail 布局）收窄，否则搜索栏一展开标题就被挤没了 */
    const barWidth = Math.max(
        150,
        Math.min(BAR_WIDTH, Math.round(windowWidth * 0.38)),
    );

    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withTiming(open ? 1 : 0, ANIMATION);
    }, [open, progress]);

    const close = useCallback(() => {
        setOpen(false);
        onChange("");
    }, [onChange]);

    const barStyle = useAnimatedStyle(() => ({
        width: progress.value * barWidth,
        opacity: progress.value,
    }));

    const iconColor = Color(t.color.text.primary).alpha(0.85).toString();

    return (
        <View style={styles.row}>
            <Animated.View
                pointerEvents={open ? "auto" : "none"}
                style={[styles.barWrap, barStyle]}>
                <View
                    style={[
                        styles.bar,
                        {
                            width: barWidth,
                            backgroundColor: Color(t.color.text.primary)
                                .alpha(0.07)
                                .toString(),
                            borderColor: Color(t.color.text.primary)
                                .alpha(0.1)
                                .toString(),
                        },
                    ]}>
                    <Icon
                        name="magnifying-glass"
                        size={13}
                        color={Color(t.color.text.primary)
                            .alpha(0.45)
                            .toString()}
                    />
                    {open ? (
                        <Input
                            testID="sheet-search-input"
                            hasHorizontalPadding={false}
                            autoFocus
                            value={value}
                            onChangeText={onChange}
                            accessibilityLabel="搜索歌单内歌曲"
                            placeholder={translate(
                                "searchMusicList.searchPlaceHolder",
                            )}
                            style={styles.input}
                            onKeyPress={e => {
                                if (e?.nativeEvent?.key === "Escape") {
                                    close();
                                }
                            }}
                        />
                    ) : null}
                    {value.length ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate("common.clear")}
                            onPress={() => onChange("")}
                            style={[styles.clear, webCursor]}>
                            <Icon
                                name="x-mark"
                                size={11}
                                color={Color(t.color.text.primary)
                                    .alpha(0.5)
                                    .toString()}
                            />
                        </Pressable>
                    ) : null}
                </View>
            </Animated.View>

            <Pressable
                testID="sheet-search-button"
                accessibilityRole="button"
                accessibilityLabel={
                    open ? translate("common.cancel") : "搜索歌单"
                }
                onPress={() => (open ? close() : setOpen(true))}
                style={[styles.button, webCursor]}>
                <Icon
                    name="magnifying-glass"
                    size={20}
                    color={open ? t.color.primary.base : iconColor}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    barWrap: {
        height: 30,
        overflow: "hidden",
        /** 靠右对齐：宽度从 0 长到 BAR_WIDTH，右缘钉住，视觉上是向左展开 */
        alignItems: "flex-end",
        /** 与右侧放大镜键留一点缝，贴在一起看着像连体 */
        marginRight: 4,
    },
    bar: {
        /** 宽度由外层按窗口宽度算好后传进来，wrapper 动画不会让输入框重排 */
        height: 30,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 11,
    },
    input: {
        flex: 1,
        minWidth: 0,
        height: 28,
        fontSize: 12.5,
    },
    clear: {
        width: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    button: {
        width: 30,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
    },
});
