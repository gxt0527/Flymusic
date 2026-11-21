/**
 * 桌面端首页内容区（对齐桌面端设计基准）
 *
 *   1. Hero Banner
 *   2. 区块一：我的歌单      —— 5 列方形卡片，铺满内容区
 *   3. 区块二：最近播放      —— 同样的卡片规格
 *
 * 卡片宽度不再写死：设计稿是「按内容区宽度均分 5 列」，
 * 这里按窗口宽度算出列数与单卡宽度，窄窗口自动降到 4/3 列。
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import ThemeText from "@/components/base/themeText";
import { useI18N } from "@/core/i18n";
import { useMusicHistory } from "@/core/musicHistory";
import MusicSheet, { useSheetsBase, useStarredSheets } from "@/core/musicSheet";
import { ROUTE_PATH, useNavigate, useOpenSheetDetail } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import { GRID_GAP, GRID_PADDING, useGrid } from "@/hooks/useGrid";
import HomeBanner from "./banner";
import SectionHeader from "./sectionHeader";
import SheetCard, { ISheetCardData } from "./sheetCard";

const PADDING = GRID_PADDING;
const GAP = GRID_GAP;

export default function HomeBodyDesktop() {
    const localSheets = useSheetsBase();
    const starredSheets = useStarredSheets();
    const history = useMusicHistory();
    const navigate = useNavigate();
    const openSheetDetail = useOpenSheetDetail();
    const { t } = useI18N();
    const { columns, cardWidth } = useGrid();

    const sheetCards = useMemo<
        Array<{ card: ISheetCardData; isLocal: boolean }>
    >(() => {
        const local = (localSheets ?? []).map(sheet => ({
            isLocal: true,
            card: {
                id: sheet.id,
                title: sheet.title ?? "",
                subtitle: t("home.songCount", { count: sheet.worksNum ?? 0 }),
                cover: sheet.coverImg ?? sheet.artwork,
                placeholderIcon:
                    sheet.id === MusicSheet.defaultSheet.id
                        ? ("heart" as const)
                        : ("musical-note" as const),
            },
        }));
        const starred = (starredSheets ?? []).map(sheet => ({
            isLocal: false,
            card: {
                id: sheet.id,
                title: sheet.title ?? "",
                subtitle: sheet.artist,
                cover: sheet.coverImg ?? sheet.artwork,
                placeholderIcon: "musical-note" as const,
            },
        }));
        return [...local, ...starred];
    }, [localSheets, starredSheets, t]);

    const historyCards = useMemo(
        () =>
            history.slice(0, columns).map(item => ({
                id: `${item.platform}-${item.id}`,
                title: item.title ?? "",
                subtitle: item.artist ?? t("common.unknownArtist"),
                cover: item.artwork,
                placeholderIcon: "musical-note" as const,
            })),
        [history, columns, t],
    );

    const openSheet = (entry: { card: ISheetCardData; isLocal: boolean }) => {
        if (entry.isLocal) {
            openSheetDetail({ id: entry.card.id });
            return;
        }
        const sheet = starredSheets?.find(it => it.id === entry.card.id);
        if (sheet) {
            navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, { sheetInfo: sheet });
        }
    };

    return (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <HomeBanner />

            <View style={styles.section}>
                {/* 首页只做「看」，不放新建/导入/更多：这些都是低频维护动作，
                    需要时从「我的收藏 / 最近播放」页内操作，首页保持干净 */}
                <SectionHeader title={t("home.myPlaylists")} />
                {sheetCards.length > 0 ? (
                    <View style={styles.cardRow}>
                        {sheetCards.map(entry => (
                            <SheetCard
                                key={`${entry.card.id}-${entry.card.title}`}
                                width={cardWidth}
                                data={entry.card}
                                onPress={() => openSheet(entry)}
                                onPlay={() => openSheet(entry)}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={styles.empty}>
                        <ThemeText
                            fontColor="textSecondary"
                            style={styles.emptyText}>
                            还没有歌单，在「我的收藏」里点收藏即可添加
                        </ThemeText>
                    </View>
                )}
            </View>

            {historyCards.length > 0 ? (
                <View style={styles.section}>
                    <SectionHeader title={t("nav.recentPlay")} />
                    <View style={styles.cardRow}>
                        {historyCards.map((card, index) => (
                            <SheetCard
                                key={`${card.id}-${index}`}
                                width={cardWidth}
                                data={card}
                                onPress={() => TrackPlayer.play(history[index])}
                                onPlay={() => TrackPlayer.play(history[index])}
                            />
                        ))}
                    </View>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: PADDING,
        paddingTop: 2,
        // 滚到底时最后一行的标题/副标题仍要完整可见
        paddingBottom: 40,
    },
    section: {
        marginTop: 20,
    },
    cardRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        columnGap: GAP,
        rowGap: GAP,
    },
    empty: {
        height: 120,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.03)",
    },
    emptyText: {
        fontSize: 13,
    },
});
