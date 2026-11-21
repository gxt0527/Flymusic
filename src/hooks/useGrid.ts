/**
 * 桌面网格：按内容区宽度算列数与单卡宽度。
 *
 * 首页「我的歌单 / 最近播放」与推荐歌单共用，避免一处按宽度自适应、
 * 另一处却硬编码 2 列，导致宽窗口下两列贴边、中间空出几百像素。
 */
import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { useLayoutMode } from "@/components/layout";
import { size } from "@/theme";

export const GRID_PADDING = 20;
export const GRID_GAP = 12;

/**
 * @param desktopColumns 宽窗口下的目标列数。窄窗口会自动降档，
 *        不会为了塞满列数把卡片压成一条。
 */
export function useGrid(desktopColumns = 5) {
    const { width } = useWindowDimensions();
    const mode = useLayoutMode();
    // 与外壳用的同一套尺寸令牌，侧栏一改宽这里自动跟上
    const sidebar = mode === "rail" ? size.rail : size.sidebar;

    return useMemo(() => {
        const available = Math.max(320, width - sidebar - GRID_PADDING * 2);
        let columns = desktopColumns;
        if (available < 480) {
            columns = 2;
        } else if (available < 640) {
            columns = 3;
        } else if (available < 800) {
            columns = Math.min(4, desktopColumns);
        }
        const cardWidth = Math.floor(
            (available - GRID_GAP * (columns - 1)) / columns,
        );
        return { columns, cardWidth };
    }, [width, sidebar, desktopColumns]);
}
