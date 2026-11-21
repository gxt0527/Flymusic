import React, { useEffect, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import SheetMusicList from "./components/sheetMusicList";
import SheetDetailDesktop from "./desktop";
import StatusBar from "@/components/base/statusBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import { useLayoutMode } from "@/components/layout";
import { useParams } from "@/core/router";

export default function SheetDetail() {
    const layoutMode = useLayoutMode();
    const { id = "favorite" } = useParams<"local-sheet-detail">();
    /**
     * 歌单内搜索的关键字。顶栏的搜索栏和下方列表都要读它，
     * 所以放在页面入口这一层，而不是塞进 desktop.tsx。
     */
    const [searchQuery, setSearchQuery] = useState("");

    /**
     * 列表滚动进度（0~1），由列表的 onScroll 写入：
     * 标题栏据此把标题往上收起，操作行据此把胶囊按钮收成图标。
     * 用共享值而不是 state —— 滚动是每帧事件，走 React 重渲染会让整张表跟着重算。
     */
    const collapseProgress = useSharedValue(0);

    /** 换歌单（同一个路由、不同 id）时把搜索清掉，否则新歌单会带着旧关键字打开 */
    useEffect(() => {
        setSearchQuery("");
        collapseProgress.value = 0;
    }, [id]);

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <NavBar collapseProgress={collapseProgress} />
            {layoutMode !== "tab" ? (
                <SheetDetailDesktop
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    collapseProgress={collapseProgress}
                />
            ) : (
                <SheetMusicList />
            )}
            <MusicBar />
        </VerticalSafeAreaView>
    );
}
