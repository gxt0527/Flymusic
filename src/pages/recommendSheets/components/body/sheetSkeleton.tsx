/**
 * 推荐歌单的骨架网格。
 *
 * 列数、列宽、留白都与真实卡片对齐（封面方图 + 两行标题），数据回来时
 * 格子直接换成封面，不会跳版。这样「切换过去」和「内容出现」之间不再是一屏
 * 空白 —— 页面一挂上就有东西，等待变成好看得出来的加载。
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Skeleton from "@/components/base/skeleton";
import { GRID_GAP } from "@/hooks/useGrid";

/** 每列错开一点相位，整片格子就有一道横向扫过去的波 */
const COLUMN_PHASE = 90;

interface ISheetSkeletonProps {
    columns: number;
    /** 单卡宽度（含卡片自身左右留白），与真实网格同一套算法算出来 */
    cardWidth: number;
    rows?: number;
}

export default function SheetSkeleton(props: ISheetSkeletonProps) {
    const { columns, cardWidth, rows = 3 } = props;
    const cells = Array.from({ length: Math.max(columns * rows, 1) });
    const cellStyle = {
        flexBasis: cardWidth,
        minWidth: cardWidth,
        maxWidth: cardWidth,
    };

    return (
        <View style={[style.grid, { gap: GRID_GAP }]}>
            {cells.map((_, i) => {
                const delay = (i % columns) * COLUMN_PHASE;
                return (
                    <View key={`skeleton-${i}`} style={[style.cell, cellStyle]}>
                        <Skeleton delay={delay} style={style.cover} />
                        <View style={style.titleBlock}>
                            <Skeleton delay={delay} style={style.title} />
                            <Skeleton delay={delay} style={style.titleShort} />
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const style = StyleSheet.create({
    /** 与外层列表的 desktopContent 对齐：左右 14 + 卡片 6 = 20 */
    grid: {
        // 骨架格按内容铺开时比可视区高，父级又是固定高的纵向弹性布局，
        // 溢出会把上面的分类条/音源 tab 压扁。这里自己吃掉剩余空间并裁掉溢出
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        overflow: "hidden",
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: 14,
        paddingTop: 2,
        paddingBottom: 24,
    },
    /** 宽度由上层按列数算好传进来：flexBasis 单独用会被内容宽度带偏 */
    cell: {
        flexGrow: 0,
        flexShrink: 0,
        paddingHorizontal: 6,
        paddingBottom: 14,
    },
    cover: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 10,
        marginBottom: 8,
    },
    /** 与真实卡片一致：标题区固定两行高 36，一行/两行混排也不参差 */
    titleBlock: {
        height: 36,
        justifyContent: "flex-start",
    },
    title: {
        width: "82%",
        height: 13,
        borderRadius: 4,
        marginBottom: 7,
    },
    titleShort: {
        width: "52%",
        height: 13,
        borderRadius: 4,
    },
});
