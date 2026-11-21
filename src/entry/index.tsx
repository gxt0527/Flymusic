import React, { useCallback, useEffect, useState } from "react";
import {
    NavigationContainer,
    useNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import bootstrap from "./bootstrap/bootstrap";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Dialogs from "@/components/dialogs";
import Panels from "@/components/panels";
import PageBackground from "@/components/base/pageBackground";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Debug from "@/components/debug";
import { PortalHost } from "@/components/base/portal";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import { BootstrapComponent } from "./bootstrap/BootstrapComponent";
import { ToastBaseComponent } from "@/components/base/toast";
import { StatusBar, Platform } from "react-native";
import { ReduceMotion, ReducedMotionConfig } from "react-native-reanimated";
import { routes } from "@/core/router/routes.tsx";
import ErrorBoundary from "@/components/errorBoundary";
import DesktopShell from "@/components/layout/desktopShell";
import WindowBridge from "@/components/layout/windowBridge";
import lyricManager from "@/core/lyricManager";
import { host } from "@/platform/web/host";

/**
 * 字体颜色
 */

StatusBar.setBackgroundColor("transparent");
StatusBar.setTranslucent(true);

bootstrap();
const Stack = createNativeStackNavigator<any>();

export default function Pages() {
    const theme = Theme.useTheme();
    const navigationRef = useNavigationContainerRef();
    /**
     * 当前路由名。
     * 不能只依赖 DesktopShell 里的 useNavigationState —— 首次挂载时容器状态还没就绪，
     * 侧栏会读不到 activeKey，表现为「首页没有高亮」，要等第一次跳转才恢复。
     */
    const [routeName, setRouteName] = useState<string>(routes[0].path);
    /**
     * 栈深度。顶栏的返回键靠它判断「能不能退」。
     * 不能只看 routeName —— 我的收藏 → 某个歌单是同名路由，routeName 不变，
     * 那时返回键会停在灰色不可点。
     */
    const [navDepth, setNavDepth] = useState(0);

    const syncRoute = useCallback(() => {
        const name = navigationRef.getCurrentRoute()?.name;
        if (name) {
            setRouteName(name);
        }
        setNavDepth(
            navigationRef.isReady()
                ? (navigationRef.getRootState()?.index ?? 0)
                : 0,
        );
    }, [navigationRef]);

    // 桌面端自动化验证用：把导航实例暴露到全局，便于外部驱动路由跳转
    useEffect(() => {
        if (Platform.OS === "web") {
            (globalThis as any).__flyNav = navigationRef;
            // 歌词状态机同样暴露一份，便于自动化验证「加载中 / 暂无歌词」这类瞬时态
            (globalThis as any).__flyLyric = lyricManager;
        }
    }, [navigationRef]);

    /**
     * 文档底色跟随主题。
     *
     * 窗口背景与 web/index.html 里的 html/body 底色都是固定的深色 #101213，
     * 浅色主题下只要有一帧没把内容画上（重排、子树重建、窗口重绘），
     * 露出来的就是一块深色，观感上就是「闪一下」。
     *
     * 三处都要刷：html（画布区）、body、以及 Electron 窗口自身的底色 ——
     * 后者是合成器的清屏色，任何一帧没画满就会露它。
     */
    useEffect(() => {
        if (Platform.OS !== "web") {
            return;
        }
        const bg = (theme as any)?.colors?.pageBackground as
            | string
            | undefined;
        if (!bg) {
            return;
        }
        document.body.style.backgroundColor = bg;
        document.documentElement.style.backgroundColor = bg;
        // 原生滚动条、表单控件跟着明暗走，深色页面上不会冒出亮色滑块
        document.documentElement.style.colorScheme = theme.dark
            ? "dark"
            : "light";
        host?.send("app:setBackgroundColor", bg);
    }, [theme]);

    return (
        <ErrorBoundary>
            <BootstrapComponent />
            <ReducedMotionConfig mode={ReduceMotion.Never} />
            <GestureHandlerRootView style={globalStyle.flex1}>
                <SafeAreaProvider>
                    <NavigationContainer
                        theme={theme}
                        ref={navigationRef}
                        onReady={syncRoute}
                        onStateChange={syncRoute}>
                        <PageBackground />
                        <DesktopShell
                            navigationRef={navigationRef}
                            routeName={routeName}
                            canGoBack={navDepth > 0}>
                            <Stack.Navigator
                                initialRouteName={routes[0].path}
                                screenOptions={{
                                    headerShown: false,
                                    animation: "slide_from_right",
                                    animationDuration: 100,
                                }}>
                                {routes.map(route => (
                                    <Stack.Screen
                                        key={route.path}
                                        name={route.path}
                                        component={route.component}
                                    />
                                ))}
                            </Stack.Navigator>
                        </DesktopShell>
                        <Panels />
                        <Dialogs />
                        {/* 关闭行为同步 / 托盘菜单动作 */}
                        <WindowBridge />
                        <Debug />
                        <ToastBaseComponent />
                        <PortalHost />
                    </NavigationContainer>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </ErrorBoundary>
    );
}
