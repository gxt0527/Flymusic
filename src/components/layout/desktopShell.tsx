/**
 * 全局应用外壳（桌面端侧栏常驻）
 *
 * 放在 NavigationContainer 内部，包住整个 Stack：
 * 所有页面（首页、歌单、设置…）都共享同一套侧栏，
 * 而不是每个页面各自渲染一份。
 *
 * 窄屏（tab 模式）时退化为底部 Tab，与移动端行为一致。
 */
import React, { memo, ReactNode, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
    CommonActions,
    NavigationContainerRef,
    StackActions,
    useNavigationState,
} from "@react-navigation/native";

import { ROUTE_PATH } from "@/core/router";
import DesktopMusicBar from "@/components/musicBar/desktop";
import BottomTab from "./bottomTab";
import DesktopTopBar from "./desktopTopBar";
import { INavItem } from "./navConfig";
import Sidebar from "./sidebar";
import { useLayoutMode } from "./index";

interface IDesktopShellProps {
    navigationRef: NavigationContainerRef<any>;
    /** 当前路由名，由 NavigationContainer 的 onStateChange 同步下来 */
    routeName: string;
    /** 栈里还有没有上一页（决定顶栏返回键是否可点） */
    canGoBack?: boolean;
    children: ReactNode;
}

/** 当前路由 → 侧栏高亮项 */
function useActiveNavKey(routeName?: string): string {
    const params = useNavigationState(
        state => state?.routes?.[state.index]?.params,
    );

    return useMemo(() => {
        switch (routeName) {
        case ROUTE_PATH.HOME:
            return "home";
        case ROUTE_PATH.RECOMMEND_SHEETS:
            return "recommend";
        case ROUTE_PATH.LOCAL_SHEET_DETAIL:
            // 本地歌单都走这个路由，只有「我喜欢」对应侧栏的收藏项
            return (params as any)?.id === "favorite" ? "favorite" : "";
        case ROUTE_PATH.LOCAL:
            return "local";
        case ROUTE_PATH.HISTORY:
            return "recent";
        case ROUTE_PATH.TOP_LIST:
        case ROUTE_PATH.TOP_LIST_DETAIL:
            return "rank";
        case ROUTE_PATH.SETTING:
            // 设置页用 type 区分面板，高亮要跟着走
            return `setting:${(params as any)?.type ?? "basic"}`;
        default:
            return "";
        }
    }, [routeName, params]);
}

function DesktopShell(props: IDesktopShellProps) {
    const { navigationRef, routeName, canGoBack, children } = props;
    const mode = useLayoutMode();
    const activeKey = useActiveNavKey(routeName);
    /**
     * 播放页是全屏沉浸式：设计稿里它既没有侧栏，也没有底部播放条。
     * 退出靠播放页左上角的 ⌄（goBack），与移动端一致。
     */
    const immersive = routeName === ROUTE_PATH.MUSIC_DETAIL;

    const handleSelect = (item: INavItem) => {
        if (!navigationRef?.isReady()) {
            return;
        }
        if (item.key === activeKey) {
            return;
        }
        const state = navigationRef.getRootState();
        const params = item.getParams?.();
        const existIndex = state.routes.findIndex(
            route =>
                route.name === item.route &&
                // 本地歌单共用 local-sheet-detail 这一个路由（靠 id 区分），
                // 只按名字找会把「我的收藏」认成任意一个已打开的歌单
                (params?.id == null ||
                    (route.params as any)?.id === params.id),
        );

        /**
         * 侧栏是「切换」语义，不是「探索」。
         *
         * 之前一律用 navigate：目标页若不在栈里就新推一个，之前推入的页面
         * 会被挤出栈并卸载。卸载等于把整页状态（数据、滚动位置、已解码的封面）
         * 全丢掉，下次进来要从零加载 —— 于是每次点侧栏都先出现一屏空白，
         * 然后封面一张张蹦出来，观感就是「闪一下」。
         *
         * 这里改成：目标页若已存在，把它的实例挪到栈顶，其余页面实例全部保留。
         * 已挂载的页面不会再卸载重挂，切换只是把已有的 DOM 重新显示出来，
         * 首帧就是完整内容，中间不出现空白态。
         */
        if (existIndex >= 0) {
            const target = state.routes[existIndex];
            const routes = state.routes.filter(
                (_route, index) => index !== existIndex,
            );
            routes.push({
                ...target,
                params: { ...(target.params as any), ...(params ?? {}) },
            } as any);
            navigationRef.dispatch(
                CommonActions.reset({
                    ...state,
                    routes: routes as any,
                    index: routes.length - 1,
                }),
            );
            return;
        }

        navigationRef.dispatch(StackActions.push(item.route as any, params));
    };

    if (mode === "tab") {
        return (
            <View style={styles.column}>
                <View style={styles.content}>{children}</View>
                <BottomTab activeKey={activeKey} onSelect={handleSelect} />
            </View>
        );
    }

    return (
        <View style={styles.row}>
            {immersive ? null : (
                <Sidebar
                    activeKey={activeKey}
                    onSelect={handleSelect}
                    collapsed={mode === "rail"}
                />
            )}
            <View style={styles.content}>
                {/* 搜索栏全局常驻：除播放页（沉浸式）外所有页面都有 */}
                {immersive ? null : (
                    <DesktopTopBar
                        canGoBack={!!canGoBack}
                        onGoBack={() => {
                            if (navigationRef?.isReady()) {
                                navigationRef.goBack();
                            }
                        }}
                        searchMode={routeName === ROUTE_PATH.SEARCH_PAGE}
                    />
                )}
                <View style={styles.stack}>{children}</View>
                {/* 播放条属于「内容区」，不压在侧栏下面 —— 设计稿即如此 */}
                {immersive ? null : <DesktopMusicBar />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flex: 1,
        flexDirection: "row",
    },
    column: {
        flex: 1,
        flexDirection: "column",
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
    stack: {
        flex: 1,
        minHeight: 0,
    },
});

export default memo(DesktopShell);
