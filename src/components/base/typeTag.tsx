import React from "react";
import {
    ColorValue,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import Color from "color";
import rpx from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";
import Icon, { IIconName } from "@/components/base/icon";
import useColors from "@/hooks/useColors";

interface ITypeTagProps {
    title: string;
    selected?: boolean;
    onPress?: (e?: any) => void;
    backgroundColor?: ColorValue;
    style?: StyleProp<ViewStyle>;
    /** 紧凑样式：桌面分类条用（高 26、选中用主色填充） */
    compact?: boolean;
    /** 文字右侧的小图标（桌面「分类下拉」用它画 chevron） */
    trailingIcon?: IIconName;
}

export default function TypeTag(props: ITypeTagProps) {
    const {
        title,
        onPress,
        selected = false,
        // backgroundColor,
        style: _style,
        compact = false,
        trailingIcon,
    } = props;
    const colors = useColors();
    const fillColor = Color(colors.primary).alpha(0.9).toString();

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <View
                style={[
                    compact ? style.wrapperCompact : style.wrapper,
                    {
                        backgroundColor:
                            selected && compact
                                ? fillColor
                                : colors.card,
                        borderColor:
                            selected && compact
                                ? fillColor
                                : colors.divider,
                    },
                    _style,
                ]}>
                <ThemeText
                    fontSize="subTitle"
                    style={[
                        compact ? style.textCompact : null,
                        selected && compact ? style.textSelected : null,
                    ]}
                    fontColor={selected ? "primary" : "text"}>
                    {title}
                </ThemeText>
                {trailingIcon ? (
                    <Icon
                        name={trailingIcon}
                        size={12}
                        color={
                            selected && compact
                                ? "#FFFFFF"
                                : colors.textSecondary
                        }
                        style={style.trailingIcon}
                    />
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    wrapper: {
        flexGrow: 0,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: rpx(18),
        paddingVertical: rpx(12),
        borderRadius: rpx(36),
        marginHorizontal: rpx(16),
        borderWidth: 1,
        borderStyle: "solid",
    },
    wrapperCompact: {
        flexGrow: 0,
        flexDirection: "row",
        alignItems: "center",
        height: 26,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: "solid",
    },
    trailingIcon: {
        marginLeft: 4,
    },
    textCompact: {
        fontSize: 12.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    textSelected: {
        color: "#FFFFFF",
    },
});
