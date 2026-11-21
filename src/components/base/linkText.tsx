import React, { useState } from "react";
import { GestureResponderEvent, StyleSheet, TextProps } from "react-native";
import { fontSizeConst, fontWeightConst } from "@/constants/uiConst";
import openUrl from "@/utils/openUrl";
import ThemeText from "./themeText";
import Color from "color";

type ILinkTextProps = TextProps & {
    fontSize?: keyof typeof fontSizeConst;
    fontWeight?: keyof typeof fontWeightConst;
    linkTo?: string;
    /** 跟随主题主色，避免浅色主题下浅蓝链接看不清 */
    linkColor?: string;
    onPress?: (event: GestureResponderEvent) => void;
};

export default function LinkText(props: ILinkTextProps) {
    const [isPressed, setIsPressed] = useState(false);
    const { linkColor, ...textProps } = props;
    const baseColor = linkColor ?? "#66ccff";

    return (
        <ThemeText
            {...textProps}
            style={[
                style.linkText,
                { color: baseColor },
                props.style,
                isPressed
                    ? { color: Color(baseColor).alpha(0.5).toString() }
                    : null,
            ]}
            onPressIn={() => {
                setIsPressed(true);
            }}
            onPress={evt => {
                if (props.onPress) {
                    props.onPress(evt);
                } else {
                    props?.linkTo && openUrl(props.linkTo);
                }
            }}
            onPressOut={() => {
                setIsPressed(false);
            }}>
            {props.children}
        </ThemeText>
    );
}

const style = StyleSheet.create({
    linkText: {
        textDecorationLine: "underline",
    },
});
