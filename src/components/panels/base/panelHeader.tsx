import React from "react";
import {
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Divider from "@/components/base/divider";
import Icon from "@/components/base/icon";
import i18n from "@/core/i18n";

interface IPanelHeaderProps {
    title: string;
    cancelText?: string;
    okText?: string;
    onCancel?: () => void;
    onOk?: () => void;
    hideButtons?: boolean;
    /** 居中弹窗使用：右上角 X 关闭（Windows 对话框习惯） */
    onClose?: () => void;
    hideDivider?: boolean;
    style?: StyleProp<ViewStyle>;
}
export default function PanelHeader(props: IPanelHeaderProps) {
    const {
        title,
        cancelText,
        okText,
        onOk,
        onCancel,
        hideButtons,
        onClose,
        hideDivider,
        style,
    } = props;

    return (
        <>
            <View style={[styles.header, style]}>
                {hideButtons ? null : (
                    <TouchableOpacity style={styles.button} onPress={onCancel}>
                        <ThemeText fontWeight="medium">
                            {cancelText || i18n.t("common.cancel")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
                <ThemeText
                    style={styles.title}
                    fontWeight="bold"
                    fontSize="title"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
                {hideButtons ? null : (
                    <TouchableOpacity
                        style={[styles.button, styles.rightButton]}
                        onPress={onOk}>
                        <ThemeText fontWeight="medium" fontColor="primary">
                            {okText || i18n.t("common.confirm")}
                        </ThemeText>
                    </TouchableOpacity>
                )}
                {onClose ? (
                    <TouchableOpacity
                        accessibilityLabel="关闭"
                        style={styles.closeButton}
                        onPress={onClose}>
                        <Icon name="x-mark" size={16} color="#9A9A9A" />
                    </TouchableOpacity>
                ) : null}
            </View>
            {hideDivider ? null : <Divider />}
        </>
    );
}

const styles = StyleSheet.create({
    header: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(24),
        height: rpx(100),
    },
    button: {
        width: rpx(120),
        height: "100%",
        justifyContent: "center",
    },
    rightButton: {
        alignItems: "flex-end",
    },
    closeButton: {
        width: rpx(64),
        height: "100%",
        alignItems: "flex-end",
        justifyContent: "center",
    },
    title: {
        flex: 1,
        textAlign: "center",
    },
});
