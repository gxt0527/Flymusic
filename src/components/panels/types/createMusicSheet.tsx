import { fontSizeConst } from "@/constants/uiConst";
import useColors from "@/hooks/useColors";
import rpx, { vmax } from "@/utils/rpx";
import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, TextInput } from "react-native";

import MusicSheet from "@/core/musicSheet";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import DesktopDialog, { DialogButton } from "../desktopDialog";
import { hidePanel } from "../usePanel";

interface ICreateMusicSheetProps {
    defaultName?: string;
    onSheetCreated?: (sheetId: string) => void;
    onCancel?: () => void;
}

export default function CreateMusicSheet(props: ICreateMusicSheetProps) {
    const { t } = useI18N();

    const { onSheetCreated, onCancel, defaultName = t("panel.createMusicSheet.title") } = props;

    const [input, setInput] = useState("");
    const colors = useColors();
    const tokens = useTokens();
    /** 桌面端：居中弹窗 + Windows 对话框式按钮栏；移动端保持原来的底部抽屉 */
    const isDesktop = Platform.OS === "web";

    const cancel = useCallback(() => {
        onCancel ? onCancel() : hidePanel();
    }, [onCancel]);

    const confirm = useCallback(async () => {
        const sheetId = await MusicSheet.addSheet(input || defaultName);
        onSheetCreated?.(sheetId);
        hidePanel();
    }, [input, defaultName, onSheetCreated]);

    if (!isDesktop) {
        return (
            <PanelBase
                height={vmax(30)}
                keyboardAvoidBehavior="height"
                renderBody={() => (
                    <>
                        <PanelHeader title={t("panel.createMusicSheet.title")} onCancel={cancel} onOk={confirm} />
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            autoFocus
                            accessible
                            accessibilityLabel={t("panel.createMusicSheet.inputLabel")}
                            accessibilityHint={t("panel.createMusicSheet.title")}
                            style={[
                                style.input,
                                { color: colors.text, backgroundColor: colors.placeholder },
                            ]}
                            placeholderTextColor={colors.textSecondary}
                            placeholder={defaultName}
                            maxLength={200}
                        />
                    </>
                )}
            />
        );
    }

    return (
        <DesktopDialog
            title={t("panel.createMusicSheet.title")}
            width={420}
            height={150}
            onClose={cancel}
            bodyStyle={style.desktopContent}
            footer={
                <>
                    {/* Windows 的按钮序是「主操作在左」 */}
                    <DialogButton
                        primary
                        label={t("common.confirm")}
                        onPress={() => {
                            void confirm();
                        }}
                    />
                    <DialogButton label={t("common.cancel")} onPress={cancel} />
                </>
            }>
            <TextInput
                value={input}
                onChangeText={setInput}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => {
                    void confirm();
                }}
                returnKeyType="done"
                onKeyPress={e => {
                    if (e.nativeEvent.key === "Escape") {
                        cancel();
                    }
                }}
                accessible
                accessibilityLabel={t("panel.createMusicSheet.inputLabel")}
                accessibilityHint={t("panel.createMusicSheet.title")}
                placeholderTextColor={tokens.color.text.tertiary}
                placeholder={defaultName}
                maxLength={200}
                style={[
                    style.desktopInput,
                    {
                        color: tokens.color.text.primary,
                        backgroundColor: tokens.color.bg.input,
                        borderColor: tokens.color.border,
                    },
                ]}
            />
        </DesktopDialog>
    );

}

const style = StyleSheet.create({
    wrapper: {
        width: rpx(750),
    },
    operations: {
        width: rpx(750),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        height: rpx(100),
        alignItems: "center",
        justifyContent: "space-between",
    },
    input: {
        margin: rpx(24),
        borderRadius: rpx(12),
        fontSize: fontSizeConst.content,
        lineHeight: fontSizeConst.content * 1.5,
        padding: rpx(12),
    },
    desktopContent: {
        paddingHorizontal: 20,
        paddingTop: 14,
    },
    desktopInput: {
        height: 34,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 0,
        fontSize: 13,
    },
});
