import React from "react";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import rpx from "@/utils/rpx";
import Image from "./image";
import { ImgAsset } from "@/constants/assetsConst";
import ThemeText from "./themeText";

interface IImageBtnProps {
    uri?: string;
    title?: string;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
    /** 宽度跟随父容器（桌面网格），封面按比例自适应 */
    fluid?: boolean;
}
export default function ImageBtn(props: IImageBtnProps) {
    const { onPress, uri, title, style: _style, fluid } = props ?? {};
    return (
        <TouchableOpacity
            activeOpacity={0.5}
            onPress={onPress}
            style={[fluid ? style.wrapperFluid : style.wrapper, _style]}>
            <Image
                style={fluid ? style.imageFluid : style.image}
                uri={uri}
                emptySrc={ImgAsset.albumDefault}
            />
            <ThemeText
                fontSize="subTitle"
                numberOfLines={2}
                ellipsizeMode="tail"
                style={fluid ? style.titleFluid : undefined}>
                {title ?? ""}
            </ThemeText>
        </TouchableOpacity>
    );
}

const style = StyleSheet.create({
    wrapper: {
        width: rpx(210),
        height: rpx(290),
        flexGrow: 0,
        flexShrink: 0,
    },
    image: {
        width: rpx(210),
        height: rpx(210),
        borderRadius: rpx(12),
        marginBottom: rpx(16),
    },
    /** 桌面网格：不写死宽高，封面用 aspectRatio 保持方形 */
    wrapperFluid: {
        width: "100%",
        flexGrow: 0,
        flexShrink: 0,
    },
    imageFluid: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 10,
        marginBottom: 8,
    },
    titleFluid: {
        fontSize: 13,
        lineHeight: 18,
        // 固定两行高度：标题一行/两行混排时行高不会参差，网格上下对齐
        height: 36,
    },
});
