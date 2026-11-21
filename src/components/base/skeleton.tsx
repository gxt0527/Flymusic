/**
 * 骨架块：内容还在路上时先占住位置。
 *
 * 用一块比底色亮一档的圆角块代替内容，避免「空白 → 满屏」的亮度断层。
 * web 上挂一条呼吸动画（同排按相位错开成一道横向波），看起来是在加载
 * 而不是卡住；native 保持静态，省掉一帧一帧驱动的基础设施。
 */
import React, { useEffect, useRef } from "react";
import { Platform, StyleProp, View, ViewStyle } from "react-native";
import { useTokens } from "@/theme";

const isWeb = Platform.OS === "web";
const PULSE_PERIOD = 1100;

let pulseInjected = false;
function ensurePulseKeyframes() {
    if (!isWeb || pulseInjected) {
        return;
    }
    pulseInjected = true;
    const el = document.createElement("style");
    el.setAttribute("data-fly-skeleton", "1");
    el.textContent = "@keyframes flySkeletonPulse{0%,100%{opacity:1}50%{opacity:.5}}";
    document.head.appendChild(el);
}

interface ISkeletonProps {
    style?: StyleProp<ViewStyle>;
    /** 呼吸动画的相位延迟（毫秒），同一排里错开就会有一道横着的波 */
    delay?: number;
}

export default function Skeleton(props: ISkeletonProps) {
    const { style, delay = 0 } = props;
    const t = useTokens();
    const nodeRef = useRef<any>(null);

    useEffect(() => {
        if (!isWeb) {
            return;
        }
        ensurePulseKeyframes();
        const node = nodeRef.current;
        if (node?.style) {
            node.style.animation = `flySkeletonPulse ${PULSE_PERIOD}ms ease-in-out ${delay}ms infinite`;
        }
    }, [delay]);

    return (
        <View
            ref={nodeRef}
            style={[{ backgroundColor: t.color.skeleton }, style]}
        />
    );
}
