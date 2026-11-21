import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import rpx from "@/utils/rpx";
import { iconSizeConst } from "@/constants/uiConst";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import ThemeText from "./themeText";
import useColors from "@/hooks/useColors";
import { showPanel } from "../panels/usePanel";
import IconButton from "./iconButton";
import TrackPlayer from "@/core/trackPlayer";
import Toast from "@/utils/toast";
import Icon from "@/components/base/icon.tsx";
import MusicSheet, { useSheetIsStarred } from "@/core/musicSheet";
import { MusicRepeatMode } from "@/constants/repeatModeConst";
import { useI18N } from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";
import { useTokens } from "@/theme";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface IProps {
    musicList: IMusic.IMusicItem[] | null;
    canStar?: boolean;
    musicSheet?: IMusic.IMusicSheetItem | null;
}
export default function (props: IProps) {
    const { musicList, canStar, musicSheet } = props;

    const sheetName = musicSheet?.title;
    const sheetId = musicSheet?.id;

    const colors = useColors();
    const tokens = useTokens();
    const navigate = useNavigate();
    const { t } = useI18N();
    const desktop = useLayoutMode() !== "tab";

    const starred = useSheetIsStarred(musicSheet);

    const playAll = () => {
        if (musicList) {
            let defaultPlayMusic = musicList[0];
            if (TrackPlayer.repeatMode === MusicRepeatMode.SHUFFLE) {
                defaultPlayMusic =
                    musicList[Math.floor(Math.random() * musicList.length)];
            }
            TrackPlayer.playWithReplacePlayList(defaultPlayMusic, musicList);
        }
    };

    if (desktop) {
        /** 桌面：主色胶囊「播放全部」+ 次级图标按钮，与歌单页一致 */
        return (
            <View style={styles.desktopWrapper}>
                <Pressable
                    onPress={playAll}
                    style={({ pressed }) => [
                        styles.playPill,
                        webCursor,
                        { backgroundColor: tokens.color.primary.base },
                        pressed && { opacity: 0.88 },
                    ]}>
                    <Icon
                        name="play"
                        size={15}
                        color={tokens.isDark ? "#10231C" : "#FFFFFF"}
                    />
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.playPillText,
                            {
                                color: tokens.isDark ? "#10231C" : "#FFFFFF",
                            },
                        ]}>
                        {t("playAllBar.title")}
                    </Text>
                </Pressable>
                {canStar && musicSheet ? (
                    <Pressable
                        onPress={() => {
                            if (!starred) {
                                MusicSheet.starMusicSheet(musicSheet);
                                Toast.success(t("toast.hasStarred"));
                            } else {
                                MusicSheet.unstarMusicSheet(musicSheet);
                                Toast.success(t("toast.hasUnstarred"));
                            }
                        }}
                        style={[styles.desktopIconButton, webCursor]}>
                        <Icon
                            name={starred ? "heart" : "heart-outline"}
                            size={18}
                            color={
                                starred ? "#e31639" : tokens.color.text.secondary
                            }
                        />
                    </Pressable>
                ) : null}
                <Pressable
                    onPress={() =>
                        showPanel("AddToMusicSheet", {
                            musicItem: musicList ?? [],
                            newSheetDefaultName: sheetName,
                        })
                    }
                    style={[styles.desktopIconButton, webCursor]}>
                    <Icon
                        name="folder-plus"
                        size={18}
                        color={tokens.color.text.secondary}
                    />
                </Pressable>
                <Pressable
                    onPress={() =>
                        navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                            musicList: musicList,
                            musicSheet: { title: sheetName, id: sheetId },
                        })
                    }
                    style={[styles.desktopIconButton, webCursor]}>
                    <Icon
                        name="pencil-square"
                        size={18}
                        color={tokens.color.text.secondary}
                    />
                </Pressable>
            </View>
        );
    }

    return (
        <View style={style.topWrapper}>
            <Pressable style={style.playAll} onPress={playAll}>
                <Icon
                    name="play-circle"
                    style={style.playAllIcon}
                    size={iconSizeConst.normal}
                    color={colors.text}
                />
                <ThemeText fontWeight="bold">{t("playAllBar.title")}</ThemeText>
            </Pressable>
            {canStar && musicSheet ? (
                <IconButton
                    name={starred ? "heart" : "heart-outline"}
                    sizeType={"normal"}
                    color={starred ? "#e31639" : undefined}
                    style={style.optionButton}
                    onPress={async () => {
                        if (!starred) {
                            MusicSheet.starMusicSheet(musicSheet);
                            Toast.success(t("toast.hasStarred"));
                        } else {
                            MusicSheet.unstarMusicSheet(musicSheet);
                            Toast.success(t("toast.hasUnstarred"));
                        }
                    }}
                />
            ) : null}
            <IconButton
                name="folder-plus"
                sizeType={"normal"}
                style={style.optionButton}
                onPress={async () => {
                    showPanel("AddToMusicSheet", {
                        musicItem: musicList ?? [],
                        newSheetDefaultName: sheetName,
                    });
                }}
            />
            <IconButton
                name="pencil-square"
                sizeType={"normal"}
                style={style.optionButton}
                onPress={async () => {
                    navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                        musicList: musicList,
                        musicSheet: {
                            title: sheetName,
                            id: sheetId,
                        },
                    });
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    desktopWrapper: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 52,
        paddingHorizontal: 6,
        paddingBottom: 6,
    },
    playPill: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 16,
        borderRadius: 17,
    },
    playPillText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "500",
        includeFontPadding: false,
    },
    desktopIconButton: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 17,
    },
});

const style = StyleSheet.create({
    /** playall */
    topWrapper: {
        height: rpx(84),
        paddingHorizontal: rpx(24),
        flexDirection: "row",
        alignItems: "center",
    },
    playAll: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    playAllIcon: {
        marginRight: rpx(12),
    },
    optionButton: {
        marginLeft: rpx(36),
    },
});
