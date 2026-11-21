/**
 * 令牌统一入口。
 *
 * 新组件只读 useTokens()，不直接读 useColors()：
 * useTokens 里既有数值（space/radius/font/size），也有随明暗与主色变化的语义色。
 */
import { useTheme } from "@react-navigation/native";
import { useMemo } from "react";

import { buildPalette, IPalette } from "./palette";
import { tokens } from "./tokens";

export * from "./tokens";
export * from "./palette";
export { tokens };

export type ITokens = typeof tokens & {
    color: IPalette;
    isDark: boolean;
};

export function useTokens(): ITokens {
    const { colors, dark } = useTheme();

    return useMemo(
        () => ({
            ...tokens,
            color: buildPalette(colors as any, dark),
            isDark: dark,
        }),
        [colors, dark],
    );
}
