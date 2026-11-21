import Config from "@/core/appConfig";

import { DarkTheme as _DarkTheme, DefaultTheme as _DefaultTheme } from "@react-navigation/native";
import { GlobalState } from "@/utils/stateMapper";
import Color from "color";

export const lightTheme = {
    id: "p-light",
    ..._DefaultTheme,
    colors: {
        ..._DefaultTheme.colors,
        background: "transparent",
        text: "#1A1A1A",
        textSecondary: Color("#1A1A1A").alpha(0.55).toString(),
        primary: "#1FA97C",
        pageBackground: "#FAFAFA",
        shadow: "#000",
        appBar: "#FAFAFA",
        appBarText: "#1A1A1A",
        musicBar: "#FFFFFF",
        musicBarText: "#1A1A1A",
        divider: "rgba(0,0,0,0.08)",
        listActive: "rgba(0,0,0,0.05)", // 在手机上表现是ripple
        mask: "rgba(51,51,51,0.30)",
        backdrop: "#FFFFFF",
        tabBar: "#FFFFFF",
        placeholder: "#EFEFEF",
        success: "#1FA97C",
        danger: "#E5484D",
        info: "#0A7FB8",
        card: "#F2F3F4",
        notification: "#FFFFFF",
    },
};

export const darkTheme = {
    id: "p-dark",
    ..._DarkTheme,
    colors: {
        ..._DarkTheme.colors,
        background: "transparent",
        text: "#FFFFFF",
        textSecondary: Color("#FFFFFF").alpha(0.55).toString(),
        primary: "#5DD3A9",
        pageBackground: "#1F2122",
        shadow: "#000000",
        appBar: "#1F2122",
        appBarText: "#FFFFFF",
        musicBar: "#232627",
        musicBarText: "#FFFFFF",
        divider: "rgba(255,255,255,0.08)",
        listActive: "rgba(255,255,255,0.07)", // 在手机上表现是ripple
        mask: "rgba(0,0,0,0.55)",
        backdrop: "#2A2A2A",
        tabBar: "#232627",
        placeholder: "#34383B",
        success: "#4CC38A",
        danger: "#F26D6D",
        info: "#4FA9D8",
        card: "#2A2A2A",
        notification: "#232627",
    },
};

const themeStore = new GlobalState(darkTheme);

/**
 * 只剩浅色 / 深色两套预设。
 *
 * 1.0.0 之前允许「自定义主题」（背景图 + 逐项配色），已整体移除；
 * 老配置里若还停在 custom，这里直接落到深色，避免控件拿到一套
 * 对不上号的颜色后界面发虚。
 */
function setup() {
    const currentTheme = Config.getConfig("theme.selectedTheme");

    if (currentTheme === "p-light") {
        themeStore.setValue(lightTheme);
        return;
    }

    themeStore.setValue(darkTheme);
    // 首次启动（没有记录）或老配置停在已移除的 custom 上，都落成深色并写回，
    // 否则主题设置里两张卡片都不会显示选中态，和实际生效的主题对不上。
    if (currentTheme !== "p-dark") {
        Config.setConfig("theme.selectedTheme", "p-dark");
    }
}

function setTheme(themeName: string) {
    themeStore.setValue(themeName === "p-light" ? lightTheme : darkTheme);
    Config.setConfig("theme.selectedTheme", themeName === "p-light" ? "p-light" : "p-dark");
}

const Theme = {
    setup,
    setTheme,
    useTheme: themeStore.useValue,
    getTheme: themeStore.getValue,
};

export default Theme;
