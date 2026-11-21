import React from "react";
import { Platform, StyleSheet } from "react-native";
import rpx from "@/utils/rpx";
import Mode from "./mode";
import Background from "./background";
import { ScrollView } from "react-native-gesture-handler";

export default function ThemeSetting() {
    return (
        <ScrollView style={style.wrapper}>
            {/* Windows 端没有系统深色模式联动，隐藏「显示样式 / 跟随系统深色设置」 */}
            {Platform.OS === "web" ? null : <Mode />}
            <Background />
        </ScrollView>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: "100%",
        marginVertical: rpx(24),
    },
});
