/**
 * react-native-linear-gradient 的 Web 实现
 *
 * react-native-web 没有渐变组件，改用 CSS linear-gradient。
 */
import React, { forwardRef } from "react";
import { View } from "react-native";

interface IPoint {
    x: number;
    y: number;
}

interface ILinearGradientProps {
    colors: string[];
    locations?: number[];
    start?: IPoint;
    end?: IPoint;
    style?: any;
    children?: React.ReactNode;
    [key: string]: any;
}

/** RN 的 start/end 相对坐标 → CSS 渐变角度 */
function toCssAngle(start: IPoint, end: IPoint) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return (deg + 360) % 360;
}

const LinearGradient = forwardRef<any, ILinearGradientProps>((props, ref) => {
    const {
        colors,
        locations,
        start = { x: 0.5, y: 0 },
        end = { x: 0.5, y: 1 },
        style,
        children,
        ...rest
    } = props;

    const safeColors = colors?.length ? colors : ["transparent", "transparent"];
    const stops = safeColors
        .map((color, index) => {
            const ratio =
                locations?.[index] ?? index / Math.max(1, safeColors.length - 1);
            return `${color} ${Math.round(ratio * 1000) / 10}%`;
        })
        .join(", ");

    return (
        <View
            ref={ref}
            {...rest}
            style={[
                style,
                {
                    backgroundImage: `linear-gradient(${toCssAngle(
                        start,
                        end,
                    )}deg, ${stops})`,
                } as any,
            ]}>
            {children}
        </View>
    );
});

LinearGradient.displayName = "LinearGradient";

export default LinearGradient;
