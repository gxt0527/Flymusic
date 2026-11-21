/**
 * 导入歌单 — 歌源匹配进度面板。
 *
 * 这里复用 <MusicList />，所以列表行与「歌单详情页」看到的是同一套状态：
 *   匹配中 -> 行尾转圈；成功 -> 变成可点击播放的正常歌曲；
 *   失败   -> 整行置灰，行尾出现「重试」「在更多源中查找」。
 * 关掉面板后匹配仍会继续（任务在 core/importPlaylist 单例里跑）。
 */
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ThemeText from "@/components/base/themeText";
import MusicList from "@/components/musicList";
import { RequestStateCode } from "@/constants/commonConst";
import ImportPlaylist from "@/core/importPlaylist";
import strings from "@/core/importPlaylist/strings";
import { IMPORT_STATUS_FIELD } from "@/core/importPlaylist/types";
import { useSheetItem } from "@/core/musicSheet";
import { useOpenSheetDetail } from "@/core/router";
import { useCurrentMusic } from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import rpx, { vmax } from "@/utils/rpx";
import PanelBase from "../base/panelBase";
import PanelHeader from "../base/panelHeader";
import { hidePanel } from "../usePanel";

interface IImportPlaylistMatchProps {
    sheetId: string;
}

export default function ImportPlaylistMatch(
    props: IImportPlaylistMatchProps,
) {
    const { sheetId } = props;
    const sheet = useSheetItem(sheetId);
    const currentMusic = useCurrentMusic();
    const task = ImportPlaylist.useTask();
    const colors = useColors();
    const openSheetDetail = useOpenSheetDetail();
    const safeAreaInsets = useSafeAreaInsets();

    const musicList = sheet.musicList ?? [];
    const total = musicList.length;
    const pending = musicList.filter(it => {
        const status = it[IMPORT_STATUS_FIELD];
        return status === "pending" || status === "matching";
    }).length;
    const failed = musicList.filter(
        it => it[IMPORT_STATUS_FIELD] === "failed",
    ).length;
    const done = total - pending;
    const success = done - failed;
    const finished = pending === 0;
    const percent = total ? Math.min(100, (done / total) * 100) : 0;
    const searchingMore =
        !!task && task.sheetId === sheetId && task.searchingMore;

    // 匹配进度是「需要盯着看」的弹窗，桌面与移动端都居中显示
    return (
        <PanelBase
            height={vmax(84)}
            positionMethod="center"
            keyboardAvoidBehavior="none"
            renderBody={() => (
                <>
                    <PanelHeader
                        title={strings.matchTitle}
                        cancelText={strings.cancel}
                        okText={strings.finish}
                        onCancel={hidePanel}
                        onOk={hidePanel}
                    />
                    <View style={styles.header}>
                        <ThemeText fontSize="content" fontWeight="medium">
                            {finished
                                ? strings.matchDone(success, failed)
                                : searchingMore
                                    ? strings.matchingMore
                                    : strings.matching(done, total)}
                        </ThemeText>
                        <ThemeText
                            fontSize="description"
                            fontColor="textSecondary"
                            style={styles.sub}>
                            {strings.topSources}
                        </ThemeText>
                        <View
                            style={[
                                styles.track,
                                { backgroundColor: colors.placeholder },
                            ]}>
                            <View
                                style={[
                                    styles.fill,
                                    {
                                        width: `${percent}%`,
                                        backgroundColor: colors.primary,
                                    },
                                ]}
                            />
                        </View>
                        <View style={styles.actions}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                disabled={searchingMore || failed === 0}
                                onPress={() =>
                                    void ImportPlaylist.searchMoreAll(sheetId)
                                }>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary"
                                    opacity={
                                        searchingMore || failed === 0 ? 0.45 : 1
                                    }>
                                    {strings.retryAll}
                                </ThemeText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                    hidePanel();
                                    openSheetDetail({
                                        id: sheetId,
                                    });
                                }}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary">
                                    {strings.openSheet}
                                </ThemeText>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View
                        style={[
                            styles.listWrapper,
                            { paddingBottom: safeAreaInsets.bottom },
                        ]}>
                        <MusicList
                            musicList={musicList}
                            musicSheet={sheet}
                            showIndex
                            state={RequestStateCode.IDLE}
                            highlightMusicItem={currentMusic}
                        />
                    </View>
                </>
            )}
        />
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: rpx(24),
        paddingTop: rpx(16),
    },
    sub: {
        marginTop: rpx(8),
    },
    track: {
        height: rpx(10),
        borderRadius: rpx(5),
        overflow: "hidden",
        marginTop: rpx(18),
    },
    fill: {
        height: "100%",
        borderRadius: rpx(5),
    },
    actions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: rpx(18),
        marginBottom: rpx(8),
    },
    listWrapper: {
        flex: 1,
        minHeight: 0,
    },
});
