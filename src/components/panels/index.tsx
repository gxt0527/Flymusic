import React from "react";
import { Platform, useWindowDimensions } from "react-native";

import { breakpoint } from "@/theme";
import panels from "./types";
import { desktopPanelOverrides } from "./desktopOverrides";
import { panelInfoStore } from "./usePanel";

function Panels() {
    const panelInfoState = panelInfoStore.useValue();
    const { width } = useWindowDimensions();

    if (!panelInfoState.name) {
        return null;
    }

    /**
     * 桌面端：纯选择型面板换成挂按钮的 Win11 菜单，选择/输入类面板换成
     * 居中对话框；其余内容型面板（播放列表、取色器、定时关闭…）仍走 PanelBase。
     */
    // 缩到窄窗口时应该退回移动端抽屉，不能因为跑在 Web 上就一直用桌面菜单
    if (Platform.OS === "web" && width >= breakpoint.compact) {
        const Desktop = desktopPanelOverrides[panelInfoState.name];
        if (Desktop) {
            return <Desktop {...(panelInfoState.payload ?? {})} />;
        }
    }

    const Component = panels[panelInfoState.name];

    return Component ? <Component {...(panelInfoState.payload ?? {})} /> : null;
}

export default React.memo(Panels, () => true);
