import React, { memo, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Color from "color";
import rpx from "@/utils/rpx";
import globalStyle from "@/constants/globalStyle";
import { ScrollView } from "react-native-gesture-handler";
import TypeTag from "../../../../components/base/typeTag";
import Icon from "@/components/base/icon";
import ThemeText from "@/components/base/themeText";
import useColors from "@/hooks/useColors";

import useRecommendList from "../../hooks/useRecommendListTags";
import SheetList from "./sheetList";
import { useI18N } from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";

/**
 * 分类条上常驻的分类数量（不含最前面的「默认」和末尾的「更多」）。
 * 宽窗口一排正好铺满，再多就交给「更多」展开区。
 */
const VISIBLE_TAG_COUNT = 12;

const isWeb = Platform.OS === "web";
const webCursor = isWeb ? ({ cursor: "pointer" } as any) : undefined;

interface IProps {
    hash: string;
}

function SheetBody(props: IProps) {
    const { hash } = props;

    const { t } = useI18N();
    const isDesktop = useLayoutMode() !== "tab";
    const colors = useColors();

    const defaultTag: ICommon.IUnique = useMemo(
        () => ({
            title: t("common.default"),
            id: "",
        }),
        [t],
    );

    // 选中的tag
    const [selectedTag, setSelectedTag] = useState<ICommon.IUnique>(defaultTag);
    /** 「更多」展开后，剩下的分类在分类条下方就地铺开，内容整体下推 */
    const [expanded, setExpanded] = useState(false);
    /** 展开区内容比可视高更高时才需要底部渐隐（否则会误盖最后一行） */
    const [panelOverflow, setPanelOverflow] = useState(false);
    const viewportHRef = useRef(0);
    const contentHRef = useRef(0);

    // 所有tag
    const tags = useRecommendList(hash);

    /**
     * 分类条上展示哪些分类：
     * 插件钉住的快捷分类（pinned）来自哪几个分组，就把那几个分组整体展开 ——
     * 通常是「心情 / 语言」这种常用维度，按分组自己的顺序排比把几个快捷项散在
     * 前面、再从别的分组硬补更好读。凑不满 12 个才按分组顺序接着补。
     */
    const visibleTags = useMemo(() => {
        const pinned = tags?.pinned ?? [];
        const groups = tags?.data ?? [];
        const seen = new Set<string>();
        const result: ICommon.IUnique[] = [];
        const push = (item?: ICommon.IUnique | null) => {
            const key = item?.id || item?.title;
            if (!key || seen.has(key)) {
                return;
            }
            seen.add(key);
            result.push(item as ICommon.IUnique);
        };

        const pinnedIds = new Set(pinned.map(_ => _.id));
        groups.forEach(group => {
            if (!group?.data?.length) {
                return;
            }
            if (group.data.some(_ => pinnedIds.has(_.id))) {
                group.data.forEach(push);
            }
        });
        pinned.forEach(push);
        for (const group of groups) {
            if (result.length >= VISIBLE_TAG_COUNT) {
                break;
            }
            group?.data?.forEach(push);
        }
        return result.slice(0, VISIBLE_TAG_COUNT);
    }, [tags]);

    /**
     * 条上没有的分类，仍按原来的分组结构留着：
     * 展开时一组一行（组名 + 换行的标签），分组语义不会因为塞进一行而丢掉。
     */
    const moreGroups = useMemo(() => {
        const taken = new Set(
            visibleTags.map(_ => _.id || _.title).filter(Boolean) as string[],
        );
        const seen = new Set<string>();
        return (tags?.data ?? [])
            .map(group => {
                const items = (group.data ?? []).filter(item => {
                    const key = item?.id || item?.title;
                    if (!key || taken.has(key) || seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                });
                return {
                    title: group?.title ?? "",
                    items: items as unknown as ICommon.IUnique[],
                };
            })
            .filter(group => group.items.length > 0);
    }, [tags, visibleTags]);

    /**
     * 条上没有的分类（从「更多」里选的）：占用「默认」那一格显示，
     * 末尾补一个按钮会被挤出可视区，而且和「更多」挤在一起更难认。
     */
    const externalTag = useMemo(() => {
        if (!selectedTag?.id) {
            return null;
        }
        return visibleTags.some(_ => _.id === selectedTag.id)
            ? null
            : selectedTag;
    }, [selectedTag, visibleTags]);

    return (
        <View style={globalStyle.fwflex1}>
            <View
                style={[
                    style.headerWrapper,
                    isDesktop ? style.headerWrapperDesktop : null,
                ]}>
                <ScrollView
                    testID="sheet-tag-bar"
                    style={style.barScroll}
                    contentContainerStyle={[
                        style.header,
                        isDesktop ? style.headerDesktop : null,
                    ]}
                    showsHorizontalScrollIndicator={false}
                    horizontal>
                    {/*
                     * 「默认」那一格就是当前筛选的位置：
                     * 从「更多」里选了分类，就换成分类名 + 一个 X，
                     * 点 X 回到默认。
                     */}
                    {externalTag ? (
                        <SelectedTag
                            title={externalTag.title ?? ""}
                            desktop={isDesktop}
                            onClear={() => setSelectedTag(defaultTag)}
                        />
                    ) : (
                        <TypeTag
                            title={defaultTag.title}
                            selected={!selectedTag.id}
                            compact={isDesktop}
                            style={isDesktop ? style.tagDesktop : null}
                            onPress={() => setSelectedTag(defaultTag)}
                        />
                    )}
                    {visibleTags.map(tag => (
                        <TypeTag
                            key={`tag-${tag.id || tag.title}`}
                            title={tag.title ?? ""}
                            selected={selectedTag.id === tag.id}
                            compact={isDesktop}
                            style={isDesktop ? style.tagDesktop : null}
                            onPress={() => setSelectedTag(tag)}
                        />
                    ))}
                </ScrollView>
                {/*
                 * 「更多」放在滚动区外面：分类多到放不下时，条内标签会滚动，
                 * 但入口本身永远不会被挤出可视区
                 */}
                <MoreTag
                    desktop={isDesktop}
                    expanded={expanded}
                    disabled={!moreGroups.length}
                    onPress={() => setExpanded(prev => !prev)}
                />
            </View>
            {/*
             * 就地展开而不是浮层菜单：浮层要么盖住歌单、要么贴着窗口边被裁，
             * 展开区把内容整体下推，永远不会超出窗口；分类再多也在区内滚动。
             */}
            {expanded && moreGroups.length ? (
                <View
                    testID="sheet-tag-more-panel"
                    style={[
                        style.morePanel,
                        isDesktop ? style.morePanelDesktop : null,
                    ]}>
                    <ScrollView
                        style={style.panelScroll}
                        contentContainerStyle={[
                            style.panelContent,
                            isDesktop ? style.panelContentDesktop : null,
                        ]}
                        onLayout={e => {
                            viewportHRef.current =
                                e.nativeEvent.layout.height;
                            setPanelOverflow(
                                contentHRef.current > viewportHRef.current + 2,
                            );
                        }}
                        onContentSizeChange={(_w, h) => {
                            contentHRef.current = h;
                            setPanelOverflow(
                                contentHRef.current > viewportHRef.current + 2,
                            );
                        }}
                        showsVerticalScrollIndicator>
                        {moreGroups.map(group => (
                            <View
                                key={`more-group-${group.title}`}
                                style={style.groupRow}>
                                <ThemeText
                                    fontSize="subTitle"
                                    fontColor="textSecondary"
                                    numberOfLines={1}
                                    style={style.groupTitle}>
                                    {group.title}
                                </ThemeText>
                                <View style={style.groupTags}>
                                    {group.items.map(tag => (
                                        <TypeTag
                                            key={`more-${tag.id || tag.title}`}
                                            title={tag.title ?? ""}
                                            selected={
                                                selectedTag.id === tag.id
                                            }
                                            compact={isDesktop}
                                            style={
                                                isDesktop
                                                    ? style.tagDesktop
                                                    : null
                                            }
                                            onPress={() => {
                                                setSelectedTag(tag);
                                                // 选完就收：否则内容一直被压在下半屏
                                                setExpanded(false);
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                    {/*
                     * 分类多到放不下时底部会切在半行上，用一层渐变把它淡掉，
                     * 看起来是「还能继续滚」而不是「被裁坏了」
                     */}
                    {panelOverflow ? (
                        <View
                            pointerEvents="none"
                            style={[
                                style.panelFade,
                                {
                                    backgroundImage: `linear-gradient(180deg, ${Color(
                                        colors.pageBackground ?? "#000000",
                                    )
                                        .alpha(0)
                                        .toString()} 0%, ${colors.pageBackground} 100%)`,
                                } as any,
                            ]}
                        />
                    ) : null}
                </View>
            ) : null}
            <SheetList tag={selectedTag} pluginHash={hash} />
        </View>
    );
}

/**
 * 从「更多」里选中的分类占住「默认」那一格：分类名 + X。
 * 用实心主色块，和条上其它选中项同一套观感；X 单独可点，点回默认。
 */
function SelectedTag(props: {
    title: string;
    desktop: boolean;
    onClear: () => void;
}) {
    const { title, desktop, onClear } = props;
    const colors = useColors();
    const [hovered, setHovered] = useState(false);
    const fillColor = Color(colors.primary).alpha(0.9).toString();

    return (
        <View
            testID="sheet-tag-selected"
            style={[
                desktop ? style.chipDesktop : style.chip,
                { backgroundColor: fillColor, borderColor: fillColor },
            ]}>
            <ThemeText
                fontSize="subTitle"
                style={[
                    desktop ? style.chipTextDesktop : null,
                    style.chipTextSelected,
                ]}
                numberOfLines={1}>
                {title}
            </ThemeText>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={title}
                hitSlop={8}
                onHoverIn={() => setHovered(true)}
                onHoverOut={() => setHovered(false)}
                onPress={onClear}
                style={[
                    style.chipClear,
                    webCursor,
                    hovered ? style.chipClearHovered : null,
                ]}>
                <Icon name="x-mark" size={desktop ? 10 : 12} color="#FFFFFF" />
            </Pressable>
        </View>
    );
}

/** 条尾的「更多」：纯文本、浅灰，点一下把剩下的分类展开在下面 */
function MoreTag(props: {
    desktop: boolean;
    expanded: boolean;
    disabled: boolean;
    onPress: (e?: any) => void;
}) {
    const { desktop, expanded, disabled, onPress } = props;
    const { t } = useI18N();
    const colors = useColors();
    const [hovered, setHovered] = useState(false);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={
                expanded ? t("common.collapse") : t("common.more")
            }
            disabled={disabled}
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
            onPress={onPress}
            style={[
                desktop ? style.moreDesktop : style.more,
                webCursor,
                !disabled && hovered ? { backgroundColor: colors.card } : null,
            ]}>
            <ThemeText
                fontSize="subTitle"
                fontColor="textSecondary"
                style={[
                    desktop ? style.moreTextDesktop : null,
                    disabled ? style.moreTextDisabled : null,
                ]}>
                {expanded ? t("common.collapse") : t("common.more")}
            </ThemeText>
        </Pressable>
    );
}

export default memo(SheetBody, (prev, curr) => prev.hash === curr.hash);

const style = StyleSheet.create({
    headerWrapper: {
        height: rpx(100),
        flexGrow: 0,
        // 下面内容区一旦超出可视高（骨架格、长列表），弹性布局会先压这里，
        // 高度被压到 0 的那一帧就是「分类栏闪一下」
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
    },
    header: {
        height: rpx(100),
        alignItems: "center",
    },
    /** 桌面：分类条高度收到 26，上间距小、下间距大，让分类条落在
     *  「音源 tab」和「歌单海报」之间偏中的位置 */
    headerWrapperDesktop: {
        height: 26,
        flexGrow: 0,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        marginTop: 21,
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    headerDesktop: {
        height: 26,
        alignItems: "center",
        gap: 10,
    },
    /**
     * 滚动区自己按内容取宽（放得下时紧贴「更多」，不留空档），
     * 放不下才收缩并横向滚动，把宽度让给右下角的「更多」
     */
    barScroll: {
        flexGrow: 0,
        flexShrink: 1,
        minWidth: 0,
    },
    tagDesktop: {
        marginHorizontal: 0,
    },
    /** 占到「默认」位置的选中分类：与 TypeTag 的 compact 选中态同尺寸同圆角 */
    chip: {
        flexGrow: 0,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: rpx(16),
        paddingLeft: rpx(18),
        paddingRight: rpx(8),
        paddingVertical: rpx(9),
        borderRadius: rpx(36),
        borderWidth: 1,
        borderStyle: "solid",
    },
    chipDesktop: {
        flexGrow: 0,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        height: 26,
        paddingLeft: 12,
        paddingRight: 5,
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: "solid",
    },
    chipTextDesktop: {
        fontSize: 12.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    chipTextSelected: {
        color: "#FFFFFF",
    },
    chipClear: {
        width: 18,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 3,
        borderRadius: 9,
    },
    chipClearHovered: {
        backgroundColor: "rgba(255,255,255,0.24)",
    },
    more: {
        flexGrow: 0,
        flexShrink: 0,
        justifyContent: "center",
        marginLeft: rpx(8),
        paddingHorizontal: rpx(6),
        paddingVertical: rpx(12),
        borderRadius: rpx(12),
    },
    moreDesktop: {
        flexGrow: 0,
        flexShrink: 0,
        height: 26,
        justifyContent: "center",
        marginLeft: 10,
        paddingHorizontal: 8,
        paddingVertical: 0,
        borderRadius: 6,
    },
    moreTextDesktop: {
        fontSize: 12.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    moreTextDisabled: {
        opacity: 0.45,
    },
    /** 展开区：吃掉剩余高度的一部分，超出就在区内滚动，绝不撑出窗口 */
    morePanel: {
        flexGrow: 0,
        flexShrink: 0,
        maxHeight: rpx(380),
        paddingHorizontal: rpx(16),
        overflow: "hidden",
    },
    morePanelDesktop: {
        maxHeight: 240,
        paddingHorizontal: 20,
    },
    /** 渐隐层对齐滚动区底边（面板不再留底部内边距，否则只盖住最后几像素） */
    panelFade: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 32,
        zIndex: 2,
    },
    panelScroll: {
        flexGrow: 0,
    },
    panelContent: {
        paddingTop: rpx(4),
        paddingBottom: rpx(8),
    },
    panelContentDesktop: {
        paddingTop: 4,
        paddingBottom: 10,
    },
    groupRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    groupTitle: {
        width: 46,
        marginTop: 6,
    },
    groupTags: {
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
});
