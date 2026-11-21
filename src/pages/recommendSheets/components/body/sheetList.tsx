import React, { memo, useCallback } from "react";
import rpx from "@/utils/rpx";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import useRecommendSheets from "../../hooks/useRecommendSheets";
import { useFadeInOnce } from "@/components/base/fadeInView";
import SheetSkeleton from "./sheetSkeleton";
import SheetItem from "@/components/mediaItem/sheetItem";
import useOrientation from "@/hooks/useOrientation";
import ListEmpty from "@/components/base/listEmpty";
import ListFooter from "@/components/base/listFooter";
import { useLayoutMode } from "@/components/layout";
import { useGrid } from "@/hooks/useGrid";
import { RequestStateCode } from "@/constants/commonConst";

interface ISheetListProps {
    tag: ICommon.IUnique;
    pluginHash: string;
}

function SheetList(props: ISheetListProps) {
    const { tag, pluginHash } = props ?? {};

    const orientation = useOrientation();
    const isDesktop = useLayoutMode() !== "tab";
    // 推荐歌单的卡片比首页更密：宽窗口下一排 6 个
    const { columns, cardWidth } = useGrid(6);

    const listColumns = isDesktop
        ? columns
        : orientation === "vertical"
            ? 3
            : 4;

    // 数据按「3 行一页」放行，首屏两页，触底再放下一页
    const [query, sheets, status, loadMore, hasMore] = useRecommendSheets(
        pluginHash,
        tag,
        listColumns,
    );

    function renderItem({ item }: { item: IMusic.IMusicSheetItemBase }) {
        return <SheetItem sheetInfo={item} pluginHash={pluginHash} />;
    }

    const keyExtractor = useCallback(
        (item: any, i: number) => `${i}-${item.platform}-${item.id}`,
        [],
    );

    // 数据回来那一刻整屏卡片会一次性铺开，给容器挂一次淡入把亮度跃升摊平
    const fadeRef = useFadeInOnce(sheets.length > 0);

    const { width: windowWidth } = useWindowDimensions();
    const skeletonCardWidth = isDesktop
        ? cardWidth
        : Math.floor(
            (windowWidth - 40 - 12 * (listColumns - 1)) / listColumns,
        );

    /**
     * 首屏还在拉数据：先铺骨架格，不要让页面空着等。
     * 插件请求 + 首次布局叠起来能到半秒，空屏看起来就是「卡在切换那里」。
     */
    if (
        !sheets.length &&
        (status === RequestStateCode.IDLE ||
            status === RequestStateCode.PENDING_FIRST_PAGE)
    ) {
        return (
            <SheetSkeleton
                columns={listColumns}
                cardWidth={skeletonCardWidth}
            />
        );
    }

    return (
        <View ref={fadeRef} style={styles.fill}>
            <FlashList
                testID="sheet-list"
                ListEmptyComponent={
                    <ListEmpty state={status} onRetry={query} />
                }
                ListFooterComponent={
                    sheets.length ? (
                        <ListFooter
                            state={
                                status === RequestStateCode.ERROR
                                    ? RequestStateCode.ERROR
                                    : hasMore
                                        ? RequestStateCode.PENDING_REST_PAGE
                                        : RequestStateCode.FINISHED
                            }
                            onRetry={query}
                        />
                    ) : null
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.1}
                estimatedItemSize={isDesktop ? cardWidth + 56 : rpx(306)}
                numColumns={listColumns}
                renderItem={renderItem}
                data={sheets}
                keyExtractor={keyExtractor}
                // 卡片自身左右各有 6 的留白，外层再给 14，两者相加正好与
                // 首页内容区的 20 对齐，列间距则仍是 12
                contentContainerStyle={
                    isDesktop ? styles.desktopContent : undefined
                }
            />
        </View>
    );
}

export default memo(
    SheetList,
    (prev, curr) =>
        prev.tag.id === curr.tag.id && prev.pluginHash === curr.pluginHash,
);

const styles = StyleSheet.create({
    /** 淡入层要撑满父容器，不能改变列表原有高度 */
    fill: {
        flex: 1,
        minHeight: 0,
    },
    /** 桌面网格：外层 14 + 卡片 6 = 20，与首页内容区左右边距一致 */
    desktopContent: {
        paddingHorizontal: 14,
        paddingTop: 2,
        paddingBottom: 24,
    },
});
