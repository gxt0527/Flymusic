/**
 * 解析识别完成后的「编辑歌单名称」弹窗 —— Windows 风格。
 *
 * 与项目里通用的居中卡片式 Dialog 不同，这里按桌面系统对话框的布局：
 *   标题栏（左标题 + 右关闭）× 带标签的单行输入框 × 右对齐的矩形按钮栏。
 * 默认名称来自平台上的原歌单名，可编辑；保存后才真正建歌单并开始匹配歌源。
 */
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import Icon from "@/components/base/icon";
import strings from "@/core/importPlaylist/strings";
import useOrientation from "@/hooks/useOrientation.ts";
import { useTokens } from "@/theme";
import Dialog from "./base";
import { hideDialog } from "../useDialog";

interface IImportSheetNameDialogProps {
    /** 平台上解析出来的歌单名 */
    defaultName: string;
    /** 识别到的曲目数 */
    count: number;
    /** 部分解析等需要提醒用户的说明 */
    notice?: string;
    onConfirm: (name: string) => void;
}

export default function ImportSheetNameDialog(
    props: IImportSheetNameDialogProps,
) {
    const { defaultName, count, notice, onConfirm } = props;
    const [name, setName] = useState(defaultName || strings.namePlaceholder);
    const [focused, setFocused] = useState(false);
    const [closeHovered, setCloseHovered] = useState(false);
    const t = useTokens();
    const orientation = useOrientation();

    const confirm = useCallback(() => {
        const finalName = (name || "").trim() || strings.namePlaceholder;
        hideDialog();
        onConfirm(finalName);
    }, [name, onConfirm]);

    const inputBorder = focused
        ? t.color.primary.base
        : t.isDark
            ? "rgba(255,255,255,0.26)"
            : "rgba(0,0,0,0.28)";

    return (
        <Dialog
            onDismiss={hideDialog}
            dialogStyle={{
                // 桌面固定 440；竖屏时不传 width，沿用通用弹窗的窄屏宽度
                ...(orientation === "horizontal" ? { width: 440 } : {}),
                maxWidth: "92%",
                borderRadius: 8,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.color.border,
                overflow: "hidden",
            }}>
            {/* 标题栏 */}
            <View
                style={[
                    styles.titleBar,
                    { borderBottomColor: t.color.divider },
                ]}>
                <Text
                    numberOfLines={1}
                    style={[
                        styles.title,
                        { color: t.color.text.primary },
                    ]}>
                    {strings.nameDialogTitle}
                </Text>
                <Pressable
                    accessibilityLabel="关闭"
                    onHoverIn={() => setCloseHovered(true)}
                    onHoverOut={() => setCloseHovered(false)}
                    onPress={hideDialog}
                    style={[
                        styles.closeButton,
                        closeHovered && { backgroundColor: "#C42B1C" },
                    ]}>
                    <Icon
                        name="x-mark"
                        size={13}
                        color={closeHovered ? "#FFFFFF" : t.color.text.secondary}
                    />
                </Pressable>
            </View>

            {/* 内容区 */}
            <View style={styles.content}>
                <Text style={[styles.label, { color: t.color.text.secondary }]}>
                    {strings.nameLabel}
                </Text>
                <TextInput
                    autoFocus
                    selectTextOnFocus
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onSubmitEditing={confirm}
                    returnKeyType="done"
                    onKeyPress={e => {
                        if (e.nativeEvent.key === "Escape") {
                            hideDialog();
                        }
                    }}
                    maxLength={200}
                    placeholder={strings.namePlaceholder}
                    placeholderTextColor={t.color.text.tertiary}
                    style={[
                        styles.input,
                        {
                            color: t.color.text.primary,
                            backgroundColor: t.color.bg.input,
                            borderColor: inputBorder,
                        },
                    ]}
                />
                <Text
                    style={[
                        styles.hint,
                        { color: t.color.text.secondary },
                    ]}>
                    {strings.nameDialogHint(count)}
                </Text>
                {notice ? (
                    <View
                        style={[
                            styles.notice,
                            { backgroundColor: t.color.bg.hover },
                        ]}>
                        <Icon
                            name="information-circle"
                            size={14}
                            color={t.color.info}
                        />
                        <Text
                            style={[
                                styles.noticeText,
                                { color: t.color.text.secondary },
                            ]}>
                            {notice}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* 底部按钮栏：右对齐、矩形、主次分明 */}
            <View
                style={[
                    styles.footer,
                    {
                        borderTopColor: t.color.divider,
                        backgroundColor: t.isDark
                            ? "rgba(255,255,255,0.03)"
                            : "rgba(0,0,0,0.025)",
                    },
                ]}>
                <Pressable
                    onPress={hideDialog}
                    style={[
                        styles.button,
                        {
                            backgroundColor: t.color.bg.raised,
                            borderColor: t.color.border,
                        },
                    ]}>
                    <Text
                        style={[
                            styles.buttonText,
                            { color: t.color.text.primary },
                        ]}>
                        {strings.cancel}
                    </Text>
                </Pressable>
                <Pressable
                    onPress={confirm}
                    style={[
                        styles.button,
                        {
                            backgroundColor: t.color.primary.base,
                            borderColor: t.color.primary.base,
                        },
                    ]}>
                    <Text
                        style={[
                            styles.buttonText,
                            styles.primaryText,
                            { color: t.color.text.onPrimary },
                        ]}>
                        {strings.save}
                    </Text>
                </Pressable>
            </View>
        </Dialog>
    );
}

const styles = StyleSheet.create({
    titleBar: {
        height: 42,
        paddingLeft: 16,
        paddingRight: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: "500",
    },
    closeButton: {
        width: 30,
        height: 30,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 20,
    },
    label: {
        fontSize: 12,
        marginBottom: 6,
    },
    input: {
        height: 34,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 10,
        fontSize: 13,
        paddingVertical: 0,
    },
    hint: {
        fontSize: 11.5,
        lineHeight: 17,
        marginTop: 10,
    },
    notice: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 9,
        marginTop: 12,
    },
    noticeText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 17,
    },
    footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    button: {
        minWidth: 96,
        height: 32,
        paddingHorizontal: 14,
        borderRadius: 4,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        fontSize: 12.5,
    },
    primaryText: {
        fontWeight: "500",
    },
});
