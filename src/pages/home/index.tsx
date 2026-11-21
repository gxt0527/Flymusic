import React from "react";
import { StyleSheet } from "react-native";

import NavBar from "./components/navBar";
import MusicBar from "@/components/musicBar";
import { SafeAreaView } from "react-native-safe-area-context";
import StatusBar from "@/components/base/statusBar";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import globalStyle from "@/constants/globalStyle";
import Theme from "@/core/theme";
import HomeBody from "./components/homeBody";
import HomeBodyHorizontal from "./components/homeBodyHorizontal";
import HomeBodyDesktop from "./components/desktop";
import useOrientation from "@/hooks/useOrientation";
import { useLayoutMode } from "@/components/layout";

function Home() {
    const orientation = useOrientation();
    const layoutMode = useLayoutMode();

    return (
        <SafeAreaView edges={["top", "bottom"]} style={styles.appWrapper}>
            <HomeStatusBar />
            {/* 侧栏/底栏由全局 DesktopShell 提供，这里只渲染页面内容 */}
            <NavBar showBrand={layoutMode === "tab"} />
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {layoutMode !== "tab" ? (
                    <HomeBodyDesktop />
                ) : orientation === "vertical" ? (
                    <HomeBody />
                ) : (
                    <HomeBodyHorizontal />
                )}
            </HorizontalSafeAreaView>
            <MusicBar />
        </SafeAreaView>
    );
}

function HomeStatusBar() {
    const theme = Theme.useTheme();

    return (
        <StatusBar
            backgroundColor="transparent"
            barStyle={theme.dark ? undefined : "dark-content"}
        />
    );
}

export default Home;

const styles = StyleSheet.create({
    appWrapper: {
        flexDirection: "column",
        flex: 1,
    },
});
