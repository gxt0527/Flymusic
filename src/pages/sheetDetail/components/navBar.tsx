import AppBar from "@/components/base/appBar";
import { useLayoutMode } from "@/components/layout";
import { showPanel } from "@/components/panels/usePanel.ts";
import { useI18N } from "@/core/i18n";
import MusicSheet, { useSheetItem } from "@/core/musicSheet";
import { ROUTE_PATH, useParams } from "@/core/router";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import type { SharedValue } from "react-native-reanimated";
import useSheetMenu from "./sheetMenu";

interface INavBarProps {
    /** 列表滚动进度（0~1），桌面端据此收起大标题 */
    collapseProgress?: SharedValue<number>;
}

export default function (props: INavBarProps) {
    const { collapseProgress } = props;
    const navigation = useNavigation<any>();
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    const musicSheet = useSheetItem(id);
    const { t } = useI18N();
    /**
     * 桌面端标题也放在顶栏（与其他页面、与设计稿一致）：
     * 曾经让内容区自己渲染标题，结果顶栏空着一行、标题另起一行，白占 50px。
     */
    const isDesktop = useLayoutMode() !== "tab";
    const title = isDesktop
        ? id === MusicSheet.defaultSheet.id
            ? t("nav.favorite")
            : musicSheet?.title ?? ""
        : t("common.sheet");
    const menu = useSheetMenu(id, musicSheet);

    return (
        <>
            <AppBar
                /**
                 * 桌面端标题栏里只留标题：⋮ 和歌单内搜索都挪到了操作行
                 * （播放全部 / 管理 / 导入歌单 那一排），向下滚动收起标题时不会被一起收走。
                 */
                menu={isDesktop ? [] : menu}
                actions={[
                    // 桌面版在操作行有带文字的「导入歌单」按钮，这里只给 tab 布局补图标入口
                    ...(isDesktop
                        ? []
                        : [
                            {
                                icon: "inbox-arrow-down" as const,
                                onPress() {
                                    showPanel("ImportPlaylist");
                                },
                            },
                            {
                                icon: "magnifying-glass" as const,
                                onPress() {
                                    navigation.navigate(
                                        ROUTE_PATH.SEARCH_MUSIC_LIST,
                                        {
                                            musicList:
                                                  musicSheet?.musicList,
                                            musicSheet: musicSheet,
                                        },
                                    );
                                },
                            },
                        ]),
                ]}
                collapseProgress={isDesktop ? collapseProgress : undefined}>
                {title}
            </AppBar>
        </>
    );
}
