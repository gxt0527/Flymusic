/**
 * 黑胶唱片封面（桌面播放页左侧）
 *
 * 参考图里播放页左侧是一张黑胶唱片，这里只画盘体：
 *   ① 外圈黑盘 —— 同心圆模拟盘面沟槽
 *   ② 内圈圆形专辑封面
 *   ③ 中心轴孔
 *
 * 全部用 View 绘制，不引额外图片素材；所有尺寸按 size 等比缩放。
 * 唱臂（手柄）已移除，后续单独设计。
 * 播放时整盘匀速旋转，暂停时停在当前角度（转满一圈回 0 视觉上连续）。
 */
import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import FastImage from "@/components/base/fastImage";
import { ImgAsset } from "@/constants/assetsConst";

interface IVinylProps {
    /** 唱片直径 */
    size: number;
    artwork?: string;
    /** 当前是否在播放 */
    playing?: boolean;
}

/** 转一圈的时长：慢速转动接近真实黑胶的观感，又不至于晃眼 */
const SPIN_DURATION = 12000;

function Vinyl(props: IVinylProps) {
    const { size, artwork, playing } = props;
    const isFocused = useIsFocused();

    const spin = useRef(new Animated.Value(0)).current;
    const spinAnim = useRef<Animated.CompositeAnimation | null>(null);
    const activeRef = useRef(false);

    useEffect(() => {
        const active = !!playing && isFocused;
        activeRef.current = active;
        if (!active) {
            spinAnim.current?.stop();
            spinAnim.current = null;
            return;
        }

        const run = () => {
            if (!activeRef.current) {
                return;
            }
            const anim = Animated.timing(spin, {
                toValue: 360,
                duration: SPIN_DURATION,
                easing: Easing.linear,
                useNativeDriver: false,
            });
            spinAnim.current = anim;
            anim.start(({ finished }) => {
                if (!finished || !activeRef.current) {
                    return;
                }
                /** 360° 与 0° 画面完全一致，回零后接着转不会出现跳帧 */
                spin.setValue(0);
                run();
            });
        };

        /** 从当前角度继续，暂停再播不回跳 */
        run();
        return () => {
            activeRef.current = false;
            spinAnim.current?.stop();
            spinAnim.current = null;
        };
    }, [playing, isFocused, spin]);

    const rotate = spin.interpolate({
        inputRange: [0, 360],
        outputRange: ["0deg", "360deg"],
        extrapolate: "clamp",
    });

    /**
     * 圆形海报占盘面直径的比例。0.7.0 是 0.42，按需求放大到 0.58；
     * 最内一圈沟槽是 0.66，放大后仍留得下一圈黑胶边缘。
     * 唱片外径 size 由调用方决定，这里只改内圈，CD 整体大小不变。
     */
    const coverSize = Math.round(size * 0.58);
    const holeSize = Math.max(7, Math.round(size * 0.045));

    return (
        <Animated.View
            testID="vinyl-disc"
            style={[
                styles.disc,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    transform: [{ rotate }],
                },
            ]}>
            {/* 盘面沟槽：由外向内几圈极淡的环 */}
            <View
                style={[
                    styles.groove,
                    {
                        width: size * 0.9,
                        height: size * 0.9,
                        borderRadius: size * 0.45,
                        opacity: 0.5,
                    },
                ]}
            />
            <View
                style={[
                    styles.groove,
                    {
                        width: size * 0.78,
                        height: size * 0.78,
                        borderRadius: size * 0.39,
                        opacity: 0.4,
                    },
                ]}
            />
            <View
                style={[
                    styles.groove,
                    {
                        width: size * 0.66,
                        height: size * 0.66,
                        borderRadius: size * 0.33,
                        opacity: 0.3,
                    },
                ]}
            />

            {/* 内圈封面 */}
            <View
                testID="vinyl-poster"
                style={{
                    width: coverSize,
                    height: coverSize,
                    borderRadius: coverSize / 2,
                    overflow: "hidden",
                }}>
                <FastImage
                    style={{
                        width: coverSize,
                        height: coverSize,
                        borderRadius: coverSize / 2,
                    }}
                    source={artwork}
                    placeholderSource={ImgAsset.albumDefault}
                />
            </View>

            {/* 中心轴孔 */}
            <View
                style={[
                    styles.hole,
                    {
                        width: holeSize,
                        height: holeSize,
                        borderRadius: holeSize / 2,
                    },
                ]}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    disc: {
        backgroundColor: "#0B0B0C",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    groove: {
        position: "absolute",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
    },
    hole: {
        position: "absolute",
        backgroundColor: "#0B0B0C",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.16)",
    },
});

export default memo(Vinyl);
