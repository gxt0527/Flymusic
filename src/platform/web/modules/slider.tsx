/**
 * @react-native-community/slider 的 Web 实现
 *
 * 用原生 input[type=range] 承载，样式与 RN 的 tint 属性对齐。
 */
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { View } from "react-native";

interface ISliderProps {
    value?: number;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    disabled?: boolean;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    style?: any;
    onValueChange?: (value: number) => void;
    onSlidingStart?: (value: number) => void;
    onSlidingComplete?: (value: number) => void;
    [key: string]: any;
}

const Slider = forwardRef<any, ISliderProps>((props, ref) => {
    const {
        value = 0,
        minimumValue = 0,
        maximumValue = 1,
        step = 0,
        disabled = false,
        minimumTrackTintColor = "#5DD3A9",
        maximumTrackTintColor = "rgba(255,255,255,0.16)",
        thumbTintColor = "#5DD3A9",
        style,
        onValueChange,
        onSlidingStart,
        onSlidingComplete,
        ...rest
    } = props;

    const [inner, setInner] = useState(value);
    const draggingRef = useRef(false);

    // 外部值变化时同步（拖动中不覆盖，避免抖动）
    useEffect(() => {
        if (!draggingRef.current) {
            setInner(value);
        }
    }, [value]);

    const percent =
        maximumValue === minimumValue
            ? 0
            : ((inner - minimumValue) / (maximumValue - minimumValue)) * 100;

    return (
        <View style={style}>
            <input
                ref={ref}
                type="range"
                min={minimumValue}
                max={maximumValue}
                step={step || "any"}
                value={inner}
                disabled={disabled}
                onChange={e => {
                    const next = Number(e.target.value);
                    draggingRef.current = true;
                    setInner(next);
                    onValueChange?.(next);
                }}
                onMouseDown={() => {
                    draggingRef.current = true;
                    onSlidingStart?.(inner);
                }}
                onMouseUp={e => {
                    draggingRef.current = false;
                    onSlidingComplete?.(Number((e.target as any).value));
                }}
                onTouchEnd={e => {
                    draggingRef.current = false;
                    onSlidingComplete?.(Number((e.target as any).value));
                }}
                style={{
                    width: "100%",
                    height: 24,
                    margin: 0,
                    appearance: "none",
                    WebkitAppearance: "none",
                    background: "transparent",
                    outline: "none",
                    cursor: disabled ? "default" : "pointer",
                    // 用 CSS 变量驱动 track / thumb 着色
                    ["--fly-min" as any]: minimumTrackTintColor,
                    ["--fly-max" as any]: maximumTrackTintColor,
                    ["--fly-thumb" as any]: thumbTintColor,
                    ["--fly-percent" as any]: `${Math.max(0, Math.min(100, percent))}%`,
                }}
                {...rest}
            />
            <style>{`
                input[type="range"]::-webkit-slider-runnable-track {
                    height: 4px;
                    border-radius: 2px;
                    background: linear-gradient(
                        to right,
                        var(--fly-min) 0%,
                        var(--fly-min) var(--fly-percent),
                        var(--fly-max) var(--fly-percent),
                        var(--fly-max) 100%
                    );
                }
                input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    -webkit-appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: var(--fly-thumb);
                    margin-top: -4px;
                    box-shadow: 0 0 0 2px rgba(0,0,0,0.18);
                    transition: transform 0.12s ease;
                }
                input[type="range"]:active::-webkit-slider-thumb {
                    transform: scale(1.15);
                }
                input[type="range"]:disabled {
                    opacity: 0.4;
                }
            `}</style>
        </View>
    );
});

Slider.displayName = "Slider";

export default Slider;
