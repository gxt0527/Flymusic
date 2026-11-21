import React from "react";
import { StyleSheet, View } from "react-native";
import TopListBody from "./components/topListBody";
import MusicBar from "@/components/musicBar";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import HorizontalSafeAreaView from "@/components/base/horizontalSafeAreaView.tsx";
import AppBar from "@/components/base/appBar";
import { useI18N } from "@/core/i18n";

export default function TopList() {
    const { t } = useI18N();

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <AppBar withStatusBar>{t("topList.title")}</AppBar>
            <HorizontalSafeAreaView style={globalStyle.flex1}>
                {/* 与首页同宽：不再限宽居中，内容区左右各 20 */}
                <View style={styles.measure}>
                    <TopListBody />
                </View>
            </HorizontalSafeAreaView>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    measure: {
        flex: 1,
        width: "100%",
        minHeight: 0,
    },
});
