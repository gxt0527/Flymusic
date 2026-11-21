/**
 * 桌面端「歌单分类」菜单
 *
 * 移动端是一张从底部滑出、占 70% 屏高的抽屉：在宽屏上会变成一张贴底的
 * 大白卡片，既盖住列表，又得滚很久才能看完几十个分类。桌面端改成 Win11
 * 筛选器的形态 —— 贴在按钮下方展开，分类按分组流式铺开，选中项实心高亮，
 * Esc / 点空白 / 滚轮一键收起。
 *
 * 外观沿用 contextMenu 的菜单皮肤（8px 圆角、1px 描边、柔和投影），
 * 只是行变成了可换行的短标签，避免「一个短词占一整行」的长菜单。
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { useI18N } from "@/core/i18n";
import { useMenuSkin, IMenuSkin } from "./contextMenu";
import type { IPanelAnchor } from "./anchor";
import { closeDesktopMenu } from "./desktopMenu";

const WIDTH = 432;
const EDGE = 8;
/** 与触发按钮的间距 */
const GAP = 4;
const PADDING = 8;
const CHIP_HEIGHT = 28;
/**
 * 展开后的高度上限：约 3/5 屏（560 → 336）。
 * 分类有几十个，一次全铺开会把右边的歌单盖掉大半；收短之后能看 3~4 组，
 * 想看更多滚一下即可，遮住的内容也少。
 */
const MAX_MENU_HEIGHT = 336;
const MIN_MENU_HEIGHT = 120;

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : null;

interface ISheetTagsDesktopProps {
    tags: IMusic.IMusicSheetGroupItem[];
    /** 当前选中的分类，用于回显 */
    selected?: ICommon.IUnique;
    onTagPressed: (tag: ICommon.IUnique) => void;
    /** 触发按钮的窗口坐标 */
    anchor?: IPanelAnchor;
}

export default function SheetTagsDesktop(props: ISheetTagsDesktopProps) {
    const { tags = [], selected, onTagPressed, anchor } = props ?? {};
    const { t } = useI18N();
    const skin = useMenuSkin();
    const win = useWindowDimensions();
    const menuRef = useRef<any>(null);
    const [menuHeight, setMenuHeight] = useState(0);

    const progress = useSharedValue(0);

    const width = Math.min(WIDTH, win.width - EDGE * 2);
    const ax = anchor?.x ?? EDGE;
    const ay = anchor?.y ?? EDGE;
    const ah = anchor?.height ?? 0;
    const spaceBelow = win.height - (ay + ah) - EDGE - GAP;
    const spaceAbove = ay - EDGE - GAP;
    /**
     * 分类有几十个，展开后基本都会碰到高度上限，所以「往哪边开」必须先定死：
     * 优先向下（和 Win11 下拉一致），下方连一行都放不下才翻到上方。
     * 高度再按这一侧的剩余空间裁剪，内容多就滚，绝不出现「翻上去又顶到屏幕边」。
     */
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(
        MIN_MENU_HEIGHT,
        Math.min(MAX_MENU_HEIGHT, preferBelow ? spaceBelow : spaceAbove),
    );

    /**
     * 高度由内容决定（有多少分组、每组几行算不出来），所以先透明挂载、
     * 量到真实高度再定位并淡入，用户看不到任何跳动。
     */
    const left = Math.max(EDGE, Math.min(ax, win.width - EDGE - width));
    const top = preferBelow
        ? ay + ah + GAP
        : Math.max(EDGE, ay - GAP - menuHeight);

    useEffect(() => {
        if (!isWeb) {
            progress.value = 1;
            return;
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                closeDesktopMenu();
            }
        };
        const onWheel = (e: any) => {
            const node = menuRef.current as any;
            if (
                node &&
                e?.target &&
                typeof node.contains === "function" &&
                node.contains(e.target)
            ) {
                return;
            }
            closeDesktopMenu();
        };
        const onBlur = () => closeDesktopMenu();

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("wheel", onWheel, {
            capture: true,
            passive: true,
        });
        window.addEventListener("blur", onBlur);
        window.addEventListener("resize", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("wheel", onWheel, true);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("resize", onBlur);
        };
    }, []);

    const appear = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ scale: 0.98 + progress.value * 0.02 }],
    }));

    const maskRef = useRef<any>(null);
    /** RN 的 Pressable 没有 onContextMenu：右键要直接挂原生事件，右键同样收起 */
    useEffect(() => {
        if (!isWeb) {
            return;
        }
        const node = maskRef.current as any;
        if (!node?.addEventListener) {
            return;
        }
        const onContext = (e: any) => {
            e?.preventDefault?.();
            closeDesktopMenu();
        };
        node.addEventListener("contextmenu", onContext);
        return () => node.removeEventListener("contextmenu", onContext);
    }, []);

    const groups = useMemo(() => {
        const list: Array<{
            key: string;
            title?: string;
            items: ICommon.IUnique[];
        }> = [
            {
                key: "default",
                items: [{ id: "", title: t("common.default") }],
            },
        ];
        tags.forEach((group, index) => {
            if (!group?.data?.length) {
                return;
            }
            list.push({
                key: `g-${group.title ?? index}`,
                title: group.title || undefined,
                items: group.data,
            });
        });
        return list;
    }, [tags, t]);

    const handlePress = (tag: ICommon.IUnique) => {
        closeDesktopMenu();
        onTagPressed?.(tag);
    };

    return (
        <View style={style.layer} pointerEvents="box-none">
            <Pressable
                ref={maskRef}
                style={StyleSheet.absoluteFill}
                onPress={closeDesktopMenu}
            />

            <Animated.View
                ref={menuRef}
                testID="sheet-tag-menu"
                onLayout={e => {
                    const next = e.nativeEvent.layout.height;
                    if (!menuHeight && next > 0) {
                        setMenuHeight(next);
                        progress.value = withTiming(1, {
                            duration: 110,
                            easing: Easing.out(Easing.quad),
                        });
                    }
                }}
                style={[
                    style.menu,
                    {
                        width,
                        left,
                        top,
                        backgroundColor: skin.surface,
                        borderColor: skin.border,
                        shadowOpacity: skin.shadowOpacity,
                    },
                    appear,
                ]}>
                <ScrollView
                    bounces={false}
                    showsVerticalScrollIndicator
                    style={{ maxHeight: maxHeight - PADDING * 2 }}
                    contentContainerStyle={style.scrollContent}>
                    <Text
                        numberOfLines={1}
                        style={[style.header, { color: skin.textTertiary }]}>
                        {t("panel.sheetTags.title")}
                    </Text>
                    {groups.map(group => (
                        <View key={group.key}>
                            {group.title ? (
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        style.groupTitle,
                                        { color: skin.textTertiary },
                                    ]}>
                                    {group.title}
                                </Text>
                            ) : null}
                            <View style={style.chipRow}>
                                {group.items.map(item => (
                                    <TagChip
                                        key={`${group.key}-${item.id}-${item.title}`}
                                        skin={skin}
                                        label={
                                            item.title ||
                                            t("common.unknownName")
                                        }
                                        selected={item.id === selected?.id}
                                        onPress={() => handlePress(item)}
                                    />
                                ))}
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

interface ITagChipProps {
    label: string;
    selected: boolean;
    skin: IMenuSkin;
    onPress: () => void;
}

function TagChip(props: ITagChipProps) {
    const { label, selected, skin, onPress } = props;
    const [hovered, setHovered] = useState(false);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPress={onPress}
            style={[
                style.chip,
                webCursor,
                {
                    backgroundColor: selected
                        ? skin.accent
                        : hovered
                            ? skin.hover
                            : "transparent",
                },
            ]}>
            <Text
                numberOfLines={1}
                style={[
                    style.chipText,
                    { color: selected ? "#FFFFFF" : skin.textPrimary },
                ]}>
                {label}
            </Text>
        </Pressable>
    );
}

const style = StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 15040,
    },
    menu: {
        position: "absolute",
        padding: PADDING,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: "#000000",
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    scrollContent: {
        paddingBottom: 2,
    },
    header: {
        height: 24,
        paddingHorizontal: 4,
        fontSize: 11.5,
        lineHeight: 16,
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    groupTitle: {
        marginTop: 10,
        marginBottom: 2,
        paddingHorizontal: 4,
        fontSize: 11.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        paddingVertical: 2,
    },
    chip: {
        height: CHIP_HEIGHT,
        paddingHorizontal: 11,
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    chipText: {
        fontSize: 12.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
});
