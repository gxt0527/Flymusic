import { useLayoutMode } from "@/components/layout";
import React, { memo, useMemo } from "react";
import { SectionList, SectionListProps, StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { IPluginTopListResult } from "../store/atoms";
import { RequestStateCode } from "@/constants/commonConst";
import FadeInView from "@/components/base/fadeInView";
import Loading from "@/components/base/loading";
import TopListItem from "@/components/mediaItem/topListItem";
import ThemeText from "@/components/base/themeText";
import ListEmpty from "@/components/base/listEmpty";

/** 桌面端榜单一行放几个 */
const DESKTOP_COLUMNS = 3;

interface IBoardPanelProps {
    hash: string;
    topListData: IPluginTopListResult;
}

function chunk<T>(list: T[], size: number): T[][] {
    const rows: T[][] = [];
    for (let i = 0; i < list.length; i += size) {
        rows.push(list.slice(i, i + size));
    }
    return rows;
}

function BoardPanel(props: IBoardPanelProps) {
    const { hash, topListData } = props ?? {};
    const isDesktop = useLayoutMode() !== "tab";

    /**
     * 桌面端把每个榜单分组切成「行」再交给 SectionList：
     * 一行 3 个卡片（原来是单列通栏，1080px 窗口下一行只有一个榜单，信息密度太低）。
     * 移动端保持原样，仍是单列。
     */
    const sections = useMemo(() => {
        const raw = topListData?.data || [];
        if (!isDesktop) {
            return raw;
        }
        return raw.map(section => ({
            ...section,
            data: chunk(section.data ?? [], DESKTOP_COLUMNS),
        }));
    }, [topListData?.data, isDesktop]);

    const renderItem: SectionListProps<any>["renderItem"] = ({ item }) => {
        if (!isDesktop) {
            return <TopListItem topListItem={item} pluginHash={hash} />;
        }
        const row = item as IMusic.IMusicSheetItemBase[];
        return (
            <View style={style.desktopRow}>
                {row.map(topListItem => (
                    <View
                        key={`${topListItem.platform}-${topListItem.id}`}
                        style={style.desktopCell}>
                        <TopListItem
                            topListItem={topListItem}
                            pluginHash={hash}
                        />
                    </View>
                ))}
                {/* 补位，最后一行不满 3 个时列宽不会变形 */}
                {Array.from({
                    length: DESKTOP_COLUMNS - row.length,
                }).map((_, i) => (
                    <View key={`placeholder-${i}`} style={style.desktopCell} />
                ))}
            </View>
        );
    };

    const renderSectionHeader: SectionListProps<IMusic.IMusicSheetItemBase>["renderSectionHeader"] =
        ({ section: { title } }) => {
            return (
                <View
                    style={[
                        style.sectionHeader,
                        isDesktop && style.sectionHeaderDesktop,
                    ]}>
                    <ThemeText fontWeight="bold" fontSize="title">
                        {title}
                    </ThemeText>
                </View>
            );
        };

    return topListData?.state !== RequestStateCode.FINISHED ? (
        <Loading />
    ) : (
        /**
         * 数据回来这一刻整块内容会一次性画出来，包一层淡入把
         * 「空白 → 满屏文字和封面」的亮度跃升摊平
         */
        <FadeInView style={style.fill}>
            <SectionList
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListEmptyComponent={<ListEmpty state={topListData?.state} />}
                sections={sections as any}
                contentContainerStyle={
                    isDesktop ? style.contentDesktop : undefined
                }
            />
        </FadeInView>
    );
}

export default memo(
    BoardPanel,
    (prev, curr) => prev.topListData === curr.topListData,
);

const style = StyleSheet.create({
    /** 淡入层要撑满父容器，不能改变列表原有高度 */
    fill: {
        flex: 1,
        minHeight: 0,
    },
    wrapper: {
        width: rpx(750),
    },
    sectionHeader: {
        marginTop: rpx(28),
        marginBottom: rpx(24),
        marginLeft: rpx(24),
    },
    /** 桌面：与列表行同用 20 的内容区内边距 */
    sectionHeaderDesktop: {
        marginTop: 20,
        marginBottom: 10,
        marginLeft: 0,
    },
    contentDesktop: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    desktopRow: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 8,
    },
    desktopCell: {
        flex: 1,
        minWidth: 0,
    },
});
