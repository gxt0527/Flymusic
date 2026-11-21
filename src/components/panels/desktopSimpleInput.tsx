/**
 * 通用输入框面板的 Windows 版
 *
 * 原实现整块是移动端抽屉：rpx 边距、居中标题栏带「取消/确定」文字按钮、
 * 高度写死 280。放到宽屏上是又高又空的一条，且和「添加到歌单」等对话框
 * 的标题栏、按钮条完全不是一个体系。这里复用同一张 DesktopDialog 骨架。
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import DesktopDialog, {
    DialogButton,
    DIALOG_FOOTER_HEIGHT,
    DIALOG_HEADER_HEIGHT,
} from "./desktopDialog";
import { hidePanel } from "./usePanel";

interface ISimpleInputProps {
    title?: string;
    onOk: (text: string, closePanel: () => void) => void;
    hints?: string[];
    onCancel?: () => void;
    maxLength?: number;
    placeholder?: string;
    autoFocus?: boolean;
}

export default function SimpleInputDesktop(props: ISimpleInputProps) {
    const { t } = useI18N();
    const tokens = useTokens();
    const {
        onOk,
        onCancel,
        placeholder,
        maxLength = 80,
        hints,
        title,
        autoFocus = true,
    } = props;

    const [input, setInput] = useState("");
    const hintList = hints ?? [];

    const cancel = () => {
        onCancel?.();
        hidePanel();
    };

    const height = Math.min(
        420,
        DIALOG_HEADER_HEIGHT +
            DIALOG_FOOTER_HEIGHT +
            14 +
            34 +
            (hintList.length ? 10 + hintList.length * 20 : 0) +
            6,
    );

    return (
        <DesktopDialog
            title={title ?? ""}
            height={height}
            onClose={cancel}
            bodyStyle={style.body}
            footer={
                <>
                    <DialogButton
                        primary
                        label={t("common.confirm")}
                        onPress={() => onOk(input, hidePanel)}
                    />
                    <DialogButton
                        label={t("common.cancel")}
                        onPress={cancel}
                    />
                </>
            }>
            <TextInput
                value={input}
                accessible
                autoFocus={autoFocus}
                accessibilityLabel={t("panel.simpleInput.inputLabel")}
                accessibilityHint={placeholder}
                onChangeText={setInput}
                onSubmitEditing={() => onOk(input, hidePanel)}
                returnKeyType="done"
                onKeyPress={e => {
                    if (e.nativeEvent.key === "Escape") {
                        cancel();
                    }
                }}
                placeholderTextColor={tokens.color.text.tertiary}
                placeholder={placeholder ?? ""}
                maxLength={maxLength}
                style={[
                    style.input,
                    {
                        color: tokens.color.text.primary,
                        backgroundColor: tokens.color.bg.input,
                        borderColor: tokens.color.border,
                    },
                ]}
            />
            {hintList.length ? (
                <ScrollView style={style.hints} bounces={false}>
                    {hintList.map((hint, index) => (
                        <View key={`hint-${index}`} style={style.hintRow}>
                            <Text
                                style={[
                                    style.hintBullet,
                                    { color: tokens.color.text.tertiary },
                                ]}>
                                •
                            </Text>
                            <Text
                                style={[
                                    style.hintText,
                                    { color: tokens.color.text.tertiary },
                                ]}>
                                {hint}
                            </Text>
                        </View>
                    ))}
                </ScrollView>
            ) : null}
        </DesktopDialog>
    );
}

const style = StyleSheet.create({
    body: {
        paddingHorizontal: 20,
        paddingTop: 14,
    },
    input: {
        height: 34,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 0,
        fontSize: 13,
    },
    hints: {
        flex: 1,
        marginTop: 10,
    },
    hintRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        height: 20,
        gap: 6,
    },
    hintBullet: {
        fontSize: 11.5,
        lineHeight: 18,
        includeFontPadding: false,
    },
    hintText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 18,
        includeFontPadding: false,
    },
});
