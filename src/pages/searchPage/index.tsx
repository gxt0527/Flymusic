import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useAtom, useSetAtom } from "jotai";

import NavBar from "./components/navBar";
import {
    PageStatus,
    initSearchResults,
    pageStatusAtom,
    queryAtom,
    historyVisibleAtom,
    searchResultsAtom,
} from "./store/atoms";
import HistoryPanel from "./components/historyPanel";
import ResultPanel from "./components/resultPanel";
import MusicBar from "@/components/musicBar";
import Loading from "@/components/base/loading";
import ThemeText from "@/components/base/themeText";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import NoPlugin from "../../components/base/noPlugin";
import { useI18N } from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";

export default function () {
    const [pageStatus, setPageStatus] = useAtom(pageStatusAtom);
    const setQuery = useSetAtom(queryAtom);
    const setSearchResultsState = useSetAtom(searchResultsAtom);
    const setHistoryVisible = useSetAtom(historyVisibleAtom);
    const { t } = useI18N();
    const layoutMode = useLayoutMode();
    const isDesktop = Platform.OS === "web" && layoutMode !== "tab";

    /**
     * 桌面端搜索框已经常驻全局顶栏，输入时不再进入本页面：
     * 提交搜索会先写 SEARCHING + 结果，再 navigate 到这里。
     * 所以这里**不能**在 mount 时清空 searchResults，否则刚发起的搜索
     * 结果会被抹掉；清空统一放到离开页面时做。
     */
    useEffect(() => {
        return () => {
            setPageStatus(PageStatus.EDITING);
            setQuery("");
            setHistoryVisible(false);
            setSearchResultsState(initSearchResults);
        };
    }, []);

    return (
        <SafeAreaView edges={["bottom", "top"]} style={style.wrapper}>
            <StatusBar />
            {/* 桌面端搜索框就是全局顶栏那一条，页面内不再重复画第二条 */}
            {layoutMode === "tab" ? <NavBar /> : null}
            <SafeAreaView edges={["left", "right"]} style={style.wrapper}>
                <View style={style.flex1}>
                    {pageStatus === PageStatus.EDITING ? (
                        isDesktop ? (
                            <View
                                style={style.idleHint}
                                pointerEvents="none">
                                <ThemeText fontColor="textSecondary">
                                    {t("searchPage.searchPlaceHolder")}
                                </ThemeText>
                            </View>
                        ) : (
                            <HistoryPanel />
                        )
                    ) : null}
                    {pageStatus === PageStatus.SEARCHING && <Loading />}
                    {pageStatus === PageStatus.RESULT && <ResultPanel />}
                    {pageStatus === PageStatus.NO_PLUGIN && (
                        <NoPlugin notSupportType={t("common.search")} />
                    )}
                </View>
            </SafeAreaView>
            <MusicBar />
        </SafeAreaView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        flex: 1,
    },
    flex1: {
        flex: 1,
        position: "relative",
    },
    idleHint: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        opacity: 0.55,
    },
});
