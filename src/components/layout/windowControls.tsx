/**
 * 桌面窗口控制按钮（最小化 / 最大化 / 关闭）
 *
 * 仅在 Electron 渲染进程（window.flyHost 存在）时渲染。
 * 与设计稿顶栏右侧的「— □ ×」一致。
 */
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { host } from "@/platform/web/host";

/** 桌面组件使用固定 px，不随窗口尺寸缩放 */
const ICON_SIZE = 16;

function MinimizeIcon(props: { color: string }) {
    return (
        <View
            style={{
                width: ICON_SIZE,
                height: 1,
                backgroundColor: props.color,
            }}
        />
    );
}

function MaximizeIcon(props: { color: string; restore?: boolean }) {
    if (props.restore) {
        return (
            <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
                <View
                    style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        width: ICON_SIZE * 0.72,
                        height: ICON_SIZE * 0.72,
                        borderWidth: 1,
                        borderColor: props.color,
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        bottom: 0,
                        width: ICON_SIZE * 0.72,
                        height: ICON_SIZE * 0.72,
                        borderWidth: 1,
                        borderColor: props.color,
                        backgroundColor: "transparent",
                    }}
                />
            </View>
        );
    }
    return (
        <View
            style={{
                width: ICON_SIZE * 0.78,
                height: ICON_SIZE * 0.78,
                borderWidth: 1,
                borderColor: props.color,
            }}
        />
    );
}

function CloseIcon(props: { color: string }) {
    const line = {
        position: "absolute" as const,
        width: ICON_SIZE,
        height: 1,
        backgroundColor: props.color,
    };
    return (
        <View
            style={{
                width: ICON_SIZE,
                height: ICON_SIZE,
                alignItems: "center",
                justifyContent: "center",
            }}>
            <View style={[line, { transform: [{ rotate: "45deg" }] }]} />
            <View style={[line, { transform: [{ rotate: "-45deg" }] }]} />
        </View>
    );
}

interface IWindowControlsProps {
    color?: string;
}

export default function WindowControls(props: IWindowControlsProps) {
    const bridge = host;
    const iconColor = props.color ?? "#9A9A9A";
    const [maximized, setMaximized] = useState(false);
    const [hovered, setHovered] = useState<"min" | "max" | "close" | null>(null);

    useEffect(() => {
        if (!bridge) {
            return;
        }
        bridge
            .invoke<boolean>("win:isMaximized")
            .then(setMaximized)
            .catch(() => {});
        return bridge.on("win:maximized-changed", value => {
            setMaximized(!!value);
        });
    }, [bridge]);

    if (!bridge) {
        return null;
    }

    return (
        <View style={styles.container} testID="window-controls">
            <Pressable
                style={[
                    styles.button,
                    hovered === "min" && styles.buttonHover,
                ]}
                onHoverIn={() => setHovered("min")}
                onHoverOut={() => setHovered(null)}
                onPress={() => {
                    bridge.invoke("win:minimize").catch(() => {});
                }}
                accessibilityLabel="最小化">
                <MinimizeIcon color={iconColor} />
            </Pressable>

            <Pressable
                style={[
                    styles.button,
                    hovered === "max" && styles.buttonHover,
                ]}
                onHoverIn={() => setHovered("max")}
                onHoverOut={() => setHovered(null)}
                onPress={() => {
                    bridge
                        .invoke<boolean>("win:toggleMaximize")
                        .then(setMaximized)
                        .catch(() => {});
                }}
                accessibilityLabel={maximized ? "还原" : "最大化"}>
                <MaximizeIcon color={iconColor} restore={maximized} />
            </Pressable>

            <Pressable
                style={[
                    styles.button,
                    hovered === "close" && styles.closeHover,
                ]}
                onHoverIn={() => setHovered("close")}
                onHoverOut={() => setHovered(null)}
                onPress={() => {
                    bridge.invoke("win:close").catch(() => {});
                }}
                accessibilityLabel="关闭">
                <CloseIcon
                    color={hovered === "close" ? "#FFFFFF" : iconColor}
                />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 4,
        /** 抵消顶栏的 20px 内边距，让控件组更贴近窗口右上角 */
        marginRight: -12,
        marginTop: -6,
    },
    button: {
        width: 42,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
    },
    buttonHover: {
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    closeHover: {
        backgroundColor: "#E81123",
    },
});
