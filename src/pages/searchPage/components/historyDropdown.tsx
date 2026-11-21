/**
 * 桌面端搜索历史浮层。
 *
 * 以前历史记录是占满内容区的一整个页面，光标一激活就把搜索结果区顶掉。
 * 现在改成挂在搜索框正下方的悬浮下拉卡片：
 *  - 只在输入框获得焦点时展开；
 *  - 点卡片外的任意位置（空白 / 侧栏 / 顶栏）由页面层的监听收起；
 *  - 选中某条历史或直接搜索后自动收起。
 *
 * 坐标与 DesktopTopBar 的搜索胶囊保持一致（左 20、宽 46%、上限 420），
 * 这样窗口缩放时浮层始终贴着搜索框下沿。
 */
import React, { useEffect, useState } from "react";
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSetAtom } from "jotai";

import Chip from "@/components/base/chip";
import ThemeText from "@/components/base/themeText";
import Button from "@/components/base/textButton";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import rpx from "@/utils/rpx";
import {
    addHistory,
    getHistory,
    removeAllHistory,
    removeHistory,
} from "../common/historySearch";
import useSearch from "../hooks/useSearch";
import {
    initSearchResults,
    PageStatus,
    pageStatusAtom,
    queryAtom,
    searchResultsAtom,
} from "../store/atoms";

interface IHistoryDropdownProps {
    /** 由调用方覆盖定位（桌面顶栏版本贴着搜索框，页面内版本贴着内容区） */
    style?: StyleProp<ViewStyle>;
    /** 传入时由调用方统一执行搜索 + 跳转，避免两套逻辑各自维护 */
    onSearch?: (keyword: string) => void;
}

export default function HistoryDropdown(props: IHistoryDropdownProps) {
    const { style, onSearch } = props;
    const [history, setHistory] = useState<string[] | null>(null);
    const search = useSearch();
    const t = useTokens();
    const { t: translate } = useI18N();

    const setQuery = useSetAtom(queryAtom);
    const setPageStatus = useSetAtom(pageStatusAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);

    const refresh = () => {
        getHistory().then(setHistory);
    };

    useEffect(() => {
        refresh();
    }, []);

    const runSearch = (keyword: string) => {
        if (onSearch) {
            onSearch(keyword);
            return;
        }
        setSearchResultsState(initSearchResults);
        setPageStatus(PageStatus.SEARCHING);
        search(keyword, 1);
        addHistory(keyword);
        setQuery(keyword);
    };

    return (
        <View
            testID="search-history-dropdown"
            style={[
                styles.dropdown,
                {
                    backgroundColor: t.color.bg.raised,
                    borderColor: t.color.border,
                    shadowColor: t.color.shadow,
                    shadowOpacity: t.isDark ? 0.44 : 0.18,
                },
                style,
            ]}>
            <View style={styles.header}>
                <ThemeText fontWeight="semibold" fontSize="subTitle">
                    {translate("searchPage.history")}
                </ThemeText>
                <Button
                    fontColor="textSecondary"
                    onPress={async () => {
                        await removeAllHistory();
                        refresh();
                    }}>
                    {translate("common.clear")}
                </Button>
            </View>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                {history === null ? null : history.length ? (
                    history.map(item => (
                        <Chip
                            key={`search-history-${item}`}
                            containerStyle={styles.chip}
                            onClose={async () => {
                                await removeHistory(item);
                                refresh();
                            }}
                            onPress={() => runSearch(item)}>
                            {item}
                        </Chip>
                    ))
                ) : (
                    <View style={styles.empty}>
                        <ThemeText fontColor="textSecondary" fontSize="subTitle">
                            {translate("common.emptyList")}
                        </ThemeText>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    dropdown: {
        position: "absolute",
        top: 0,
        left: 20,
        width: "46%",
        minWidth: 280,
        maxWidth: 420,
        maxHeight: 340,
        zIndex: 100,
        /** 与右键菜单 / ⋮ 菜单同一套外观：8px 圆角 + 柔和投影 */
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 6,
    },
    scroll: {
        maxHeight: 270,
    },
    scrollContent: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingBottom: 4,
    },
    chip: {
        flexGrow: 0,
        marginRight: rpx(16),
        marginBottom: rpx(16),
        maxWidth: "100%",
    },
    empty: {
        width: "100%",
        paddingVertical: 18,
        alignItems: "center",
    },
});
