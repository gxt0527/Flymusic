/**
 * 应用外壳：按窗口宽度在「侧栏 / 图标栏 / 底部 Tab」之间切换。
 *
 *   >= 840dp  Expanded  → 左侧栏 170dp 常驻
 *   600–840   Medium    → 左侧栏收起为 76dp 图标栏
 *   < 600     Compact   → 底部 Tab，无侧栏
 *
 * 用 useWindowDimensions 而不是 useOrientation：
 * 折叠屏展开/折叠、平板分屏都会改变宽度，但不一定改变方向。
 */
import React, { memo, ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { breakpoint } from "@/theme";
import BottomTab from "./bottomTab";
import { INavItem } from "./navConfig";
import Sidebar from "./sidebar";

interface IAppShellProps {
    activeKey: string;
    onSelect: (item: INavItem) => void;
    children: ReactNode;
}

export type LayoutMode = "sidebar" | "rail" | "tab";

export function useLayoutMode(): LayoutMode {
    const { width } = useWindowDimensions();
    if (width >= breakpoint.expanded) {
        return "sidebar";
    }
    if (width >= breakpoint.compact) {
        return "rail";
    }
    return "tab";
}

function AppShell(props: IAppShellProps) {
    const { activeKey, onSelect, children } = props;
    const mode = useLayoutMode();

    const showSidebar = mode !== "tab";

    return (
        <View
            style={[
                style.root,
                { flexDirection: showSidebar ? "row" : "column" },
            ]}>
            {showSidebar ? (
                <Sidebar
                    activeKey={activeKey}
                    onSelect={onSelect}
                    collapsed={mode === "rail"}
                />
            ) : null}
            <View style={style.content}>{children}</View>
            {showSidebar ? null : (
                <BottomTab activeKey={activeKey} onSelect={onSelect} />
            )}
        </View>
    );
}

const style = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
});

export default memo(AppShell);
