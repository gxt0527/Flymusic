/**
 * Windows 对话框外壳（桌面端面板的通用形态）
 *
 * 桌面端不要再把移动端的底部抽屉搬过来：Win11 的对话框是
 * 「420 宽的一张居中卡片 + 44 高标题栏（左标题 右关闭）+ 底部按钮条」。
 * 「添加到歌单」「新建歌单」「输入框」这类都是同一个骨架，
 * 所以抽在这里，尺寸只维护一份（44 / 52 / 420 / 圆角走 PanelBase 的 8）。
 *
 * 按钮序遵循 Windows 习惯：主操作在左，取消在右。
 */
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import Icon from "@/components/base/icon";
import { useTokens } from "@/theme";
import PanelBase from "./base/panelBase";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export const DIALOG_HEADER_HEIGHT = 44;
export const DIALOG_FOOTER_HEIGHT = 52;
/** 内容区上下留白之和（行高按 44 算高度时用得上） */
export const DIALOG_BODY_PADDING = 16;

interface IDesktopDialogProps {
    title: string;
    onClose: () => void;
    /** 卡片宽度，默认 420（Win11 ContentDialog 的量级） */
    width?: number;
    /** 卡片高度：跟着内容算，不要留一大片空白 */
    height: number;
    /** 底部按钮条；不传就没有按钮条（例如只有取消的确认框传一个也行） */
    footer?: React.ReactNode;
    /** 内容区是否需要自己控制内边距 */
    bodyStyle?: object;
    children: React.ReactNode;
}

export default function DesktopDialog(props: IDesktopDialogProps) {
    const { title, onClose, width = 420, height, footer, bodyStyle, children } =
        props;

    return (
        <PanelBase
            positionMethod="center"
            centerWidth={width}
            height={height}
            keyboardAvoidBehavior="none"
            renderBody={() => (
                <View style={style.wrapper}>
                    <DialogHeader title={title} onClose={onClose} />
                    <View style={[style.body, bodyStyle]}>{children}</View>
                    {footer ? <DialogFooter>{footer}</DialogFooter> : null}
                </View>
            )}
        />
    );
}

interface IDialogHeaderProps {
    title: string;
    onClose: () => void;
}

export function DialogHeader(props: IDialogHeaderProps) {
    const { title, onClose } = props;
    const t = useTokens();

    return (
        <View
            style={[style.header, { borderBottomColor: t.color.divider }]}>
            <Text
                numberOfLines={1}
                style={[style.title, { color: t.color.text.primary }]}>
                {title}
            </Text>
            <Pressable
                accessibilityLabel="关闭"
                onPress={onClose}
                style={({ pressed }) => [
                    style.closeButton,
                    webCursor,
                    pressed && { backgroundColor: t.color.bg.hover },
                ]}>
                <Icon name="x-mark" size={13} color={t.color.text.secondary} />
            </Pressable>
        </View>
    );
}

export function DialogFooter(props: { children: React.ReactNode }) {
    const { children } = props;
    const t = useTokens();

    return (
        <View style={[style.footer, { borderTopColor: t.color.divider }]}>
            {children}
        </View>
    );
}

interface IDialogButtonProps {
    label: string;
    primary?: boolean;
    onPress: () => void;
}

export function DialogButton(props: IDialogButtonProps) {
    const { label, primary, onPress } = props;
    const t = useTokens();

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                style.button,
                webCursor,
                {
                    backgroundColor: primary
                        ? t.color.primary.base
                        : t.color.bg.base,
                    borderColor: primary
                        ? t.color.primary.base
                        : t.color.border,
                },
                pressed && {
                    backgroundColor: primary
                        ? t.color.primary.press
                        : t.color.bg.hover,
                },
            ]}>
            <Text
                style={[
                    style.buttonText,
                    {
                        color: primary
                            ? t.color.text.onPrimary
                            : t.color.text.primary,
                    },
                ]}>
                {label}
            </Text>
        </Pressable>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flex: 1,
        width: "100%",
    },
    header: {
        height: DIALOG_HEADER_HEIGHT,
        paddingLeft: 16,
        paddingRight: 8,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "600",
        includeFontPadding: false,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    footer: {
        height: DIALOG_FOOTER_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    button: {
        minWidth: 88,
        height: 30,
        paddingHorizontal: 14,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        fontSize: 12.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
});
