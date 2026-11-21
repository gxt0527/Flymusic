import React, { useMemo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { ImgAsset } from "@/constants/assetsConst";
import { useCurrentMusic } from "@/core/trackPlayer";

/**
 * 桌面播放页的背景要比移动端克制得多：
 * 设计稿里全屏是接近 #1C1C1C 的深灰，只在封面附近渗出一点暖色。
 * 移动端那种「半透明封面模糊铺满」在宽屏上会变成一整片脏色。
 */
const isDesktop = Platform.OS === "web";

export default function Background() {
    const musicItem = useCurrentMusic();

    const artworkSource = useMemo(() => {
        if (!musicItem?.artwork) {
            return ImgAsset.albumDefault;
        }

        if(typeof musicItem.artwork === "string") {
            return {
                uri: musicItem.artwork,
            };
        }
        return musicItem.artwork;

    }, [musicItem?.artwork]);

    return (
        <>
            <View
                style={[
                    style.background,
                    isDesktop ? style.backgroundDesktop : null,
                ]}
            />
            <Image
                style={[style.blur, isDesktop ? style.blurDesktop : null]}
                blurRadius={50}
                source={artworkSource}
            />
        </>
    );
}

const style = StyleSheet.create({
    background: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#000",
    },
    blur: {
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.5,
    },
    /** 桌面：只留一层很淡的色晕，撑住氛围但不抢前景 */
    blurDesktop: {
        opacity: 0.2,
    },
    /**
     * 设计稿播放页背景实测 14~52 的深灰（不是纯黑），
     * 移动端沿用 #000 的沉浸底，桌面换成偏中性的深灰。
     */
    backgroundDesktop: {
        backgroundColor: "#242527",
    },
});
