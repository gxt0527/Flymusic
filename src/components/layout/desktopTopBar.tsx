/**
 * 桌面全局顶栏：常驻可输入搜索框 + 设置 + 窗口控件
 *
 * 搜索行为和 0.7.0 相比有本质变化：
 *   - 以前首页那条是「点击跳转搜索页」的假搜索框，输入必须先进一个独立页面；
 *   - 现在顶栏本身就是真输入框，在任何页面都能直接打字，页面保持不变；
 *   - 只有点「搜索」/回车提交后才切到搜索结果页；
 *   - 搜索历史是挂在搜索框正下方的悬浮卡片，点其它区域即收起。
 *
 * 由 DesktopShell 挂载一次（播放页是沉浸式，不显示顶栏）。
 */
import React, { memo, useEffect } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Color from "color";
import { useAtom, useSetAtom } from "jotai";

import Icon from "@/components/base/icon";
import IconButton from "@/components/base/iconButton";
import Input from "@/components/base/input";
import WindowControls from "@/components/layout/windowControls";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import useColors from "@/hooks/useColors";
import { addHistory } from "@/pages/searchPage/common/historySearch";
import HistoryDropdown from "@/pages/searchPage/components/historyDropdown";
import useSearch from "@/pages/searchPage/hooks/useSearch";
import {
    historyVisibleAtom,
    initSearchResults,
    PageStatus,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "@/pages/searchPage/store/atoms";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface IGlobalSearchInputProps {
    /** 当前是否已经在搜索结果页（决定是否还要 navigate） */
    onSearchPage: boolean;
}

function GlobalSearchInput(props: IGlobalSearchInputProps) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const search = useSearch();
    const [query, setQuery] = useAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const [historyVisible, setHistoryVisible] = useAtom(historyVisibleAtom);

    /**
     * 提交搜索：先把状态置为 SEARCHING，再进结果页，最后真正发起搜索。
     * 输入阶段完全不碰路由 —— 首页/歌单页/设置页保持原样。
     */
    const runSearch = async (keyword?: string) => {
        const q = (keyword ?? query).trim();
        if (!q) {
            return;
        }
        if (keyword !== undefined && keyword !== query) {
            setQuery(keyword);
        }
        setHistoryVisible(false);
        setSearchResultsState(initSearchResults);
        setPageStatus(PageStatus.SEARCHING);
        if (!props.onSearchPage) {
            navigate(ROUTE_PATH.SEARCH_PAGE);
        }
        await search(q, 1);
        await addHistory(q);
    };

    return (
        <>
            <View style={styles.searchArea}>
                <View
                    testID="global-search-box"
                    style={[
                        styles.search,
                        { backgroundColor: colors.placeholder },
                    ]}>
                    {/* 放大镜就是搜索按钮：点它提交搜索（原来的「搜索」文字按钮已去掉） */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("common.search")}
                        onPress={() => runSearch()}
                        style={[styles.searchIcon, webCursor]}>
                        <Icon
                            name="magnifying-glass"
                            size={15}
                            color={Color(colors.text).alpha(0.55).toString()}
                        />
                    </Pressable>
                    <Input
                        hasHorizontalPadding={false}
                        style={styles.input}
                        accessibilityLabel={t("searchPage.searchLabel.a11y")}
                        onFocus={() => setHistoryVisible(true)}
                        placeholder={t("searchPage.searchPlaceHolder")}
                        onSubmitEditing={() => runSearch()}
                        onChangeText={setQuery}
                        value={query}
                    />
                    {query.length ? (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t("common.clear")}
                            onPress={() => {
                                setQuery("");
                                setHistoryVisible(true);
                            }}
                            style={[styles.clear, webCursor]}>
                            <Icon
                                name="x-mark"
                                size={13}
                                color={Color(colors.text)
                                    .alpha(0.55)
                                    .toString()}
                            />
                        </Pressable>
                    ) : null}
                </View>

                {historyVisible ? (
                    <HistoryDropdown
                        style={styles.historyDropdown}
                        onSearch={keyword => runSearch(keyword)}
                    />
                ) : null}
            </View>
        </>
    );
}

interface IDesktopTopBarProps {
    /** 当前是否搜索结果页 */
    searchMode?: boolean;
    /** 栈里还有没有上一页 */
    canGoBack?: boolean;
    onGoBack?: () => void;
}

function DesktopTopBar(props: IDesktopTopBarProps) {
    const colors = useColors();
    const { t } = useI18N();
    const navigate = useNavigate();
    const setHistoryVisible = useSetAtom(historyVisibleAtom);

    /** 点搜索框 → 展开历史；点浮层 → 保持；点其它任何地方 → 收起并失焦 */
    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined") {
            return;
        }
        const onPointerDown = (event: Event) => {
            const target = event.target as Element | null;
            if (!target || typeof target.closest !== "function") {
                return;
            }
            if (target.closest("[data-testid=\"global-search-box\"]")) {
                setHistoryVisible(true);
                return;
            }
            if (
                target.closest(
                    "[data-testid=\"search-history-dropdown\"]",
                )
            ) {
                return;
            }
            setHistoryVisible(false);
            const active = document.activeElement as HTMLElement | null;
            if (
                active &&
                (active.tagName === "INPUT" ||
                    active.tagName === "TEXTAREA")
            ) {
                active.blur();
            }
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
        };
    }, [setHistoryVisible]);

    return (
        <View style={styles.bar} testID="app-titlebar">
            {/*
              * 返回键固定在搜索框左侧：没有上一页时灰掉但仍占位，
              * 位置不会因为能不能返回而左右跳。
              */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="返回"
                accessibilityState={{ disabled: !props.canGoBack }}
                disabled={!props.canGoBack}
                onPress={props.onGoBack}
                style={[
                    styles.back,
                    props.canGoBack ? webCursor : styles.backDisabled,
                ]}>
                <Icon
                    name="arrow-left"
                    size={17}
                    color={
                        props.canGoBack
                            ? colors.text
                            : Color(colors.text).alpha(0.28).toString()
                    }
                />
            </Pressable>

            <GlobalSearchInput onSearchPage={!!props.searchMode} />

            <View style={styles.grow} />

            <IconButton
                sizeType="small"
                accessibilityLabel={t("common.setting")}
                name="cog-8-tooth"
                color={colors.textSecondary}
                style={styles.setting}
                onPress={() => {
                    navigate(ROUTE_PATH.SETTING, { type: "basic" });
                }}
            />

            <WindowControls color={colors.textSecondary} />
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        gap: 10,
        /** 历史浮层要盖住下方内容区，顶栏必须建立堆叠上下文并压过 stack */
        zIndex: 50,
    },
    back: {
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginRight: -2,
    },
    backDisabled: {
        opacity: 0.75,
    },
    searchArea: {
        width: "46%",
        maxWidth: 420,
        height: 36,
        flexShrink: 0,
        position: "relative",
    },
    search: {
        width: "100%",
        height: 36,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
    },
    historyDropdown: {
        top: 42,
        left: 0,
        width: "100%",
        minWidth: 0,
        maxWidth: 420,
        zIndex: 100,
    },
    searchIcon: {
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    input: {
        flex: 1,
        minWidth: 0,
        height: 34,
        fontSize: 13,
        color: "#FFFFFF",
    },
    clear: {
        width: 18,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    grow: {
        flex: 1,
    },
    setting: {
        marginRight: 4,
    },
});

export default memo(DesktopTopBar);
