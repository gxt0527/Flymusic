import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import VerticalSafeAreaView from "@/components/base/verticalSafeAreaView";
import globalStyle from "@/constants/globalStyle";
import StatusBar from "@/components/base/statusBar";
import musicHistory, { useMusicHistory } from "@/core/musicHistory";
import MusicList from "@/components/musicList";
import { musicHistorySheetId, RequestStateCode } from "@/constants/commonConst";
import MusicBar from "@/components/musicBar";
import AppBar from "@/components/base/appBar";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { useI18N } from "@/core/i18n";

export default function History() {
    const musicHistoryList = useMusicHistory();

    const navigate = useNavigate();
    const { t } = useI18N();

    return (
        <VerticalSafeAreaView style={globalStyle.fwflex1}>
            <StatusBar />
            <AppBar
                menu={[
                    {
                        icon: "trash-outline",
                        title: t("history.clearHistory"),
                        onPress() {
                            if (musicHistoryList.length) {
                                musicHistory.clearMusic();
                            }
                        },
                    },
                    {
                        icon: "pencil-square",
                        title: t("common.edit"),
                        onPress() {
                            navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                                musicList: musicHistoryList,
                                musicSheet: {
                                    id: musicHistorySheetId,
                                    title: t("history.title"),
                                },
                            });
                        },
                    },
                ]}>
                {t("history.title")}
            </AppBar>
            {/* 播放记录：左右边距与首页内容区一致（20），右侧多留 5px 给滚动条 */}
            <View style={styles.measure}>
                <MusicList
                    musicList={musicHistoryList}
                    showIndex
                    state={RequestStateCode.IDLE}
                    desktopPadding={{ left: 20, right: 15 }}
                    musicSheet={{
                        id: musicHistorySheetId,
                        title: t("history.title"),
                        musicList: musicHistoryList,
                    } as IMusic.IMusicSheetItem}
                />
            </View>
            <MusicBar />
        </VerticalSafeAreaView>
    );
}

const styles = StyleSheet.create({
    measure: {
        flex: 1,
        width: "100%",
        minHeight: 0,
        ...(Platform.OS === "web"
            ? {
                // 播放记录用满宽度：不再 900 限宽居中，
                // 只给滚动条右侧留 5px，条子不会贴死窗口边缘
                paddingRight: 5,
            }
            : null),
    },
});
