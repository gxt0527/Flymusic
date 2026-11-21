/**
 * 歌曲「更多」菜单的条目定义
 *
 * 移动端的面板（底部抽屉）和桌面端的右键菜单是同一批操作，只是皮不同。
 * 条目、顺序、分组、可见条件都放在这里，两个容器只负责画。
 *
 * 分组线（divider）只在桌面菜单里生效：Win11 的菜单靠细线分区，
 * 移动端抽屉本来就一行一条，再加线会很碎。
 */
import Clipboard from "@react-native-clipboard/clipboard";

import { IIconName } from "@/components/base/icon";
import { showDialog } from "@/components/dialogs/useDialog";
import { ROUTE_PATH } from "@/core/router";
import Config from "@/core/appConfig";
import LocalMusicSheet from "@/core/localMusicSheet";
import MusicSheet from "@/core/musicSheet";
import TrackPlayer from "@/core/trackPlayer";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";
import lyricManager from "@/core/lyricManager";
import mediaCache from "@/core/mediaCache";
import musicHistory from "@/core/musicHistory";
import pluginManager from "@/core/pluginManager";
import { localMusicSheetId, musicHistorySheetId } from "@/constants/commonConst";
import { getMediaExtraProperty } from "@/utils/mediaExtra";
import { getMediaUniqueKey } from "@/utils/mediaUtils";
import Toast from "@/utils/toast";

import { hidePanel, showPanel } from "./usePanel";

export interface IMusicItemOption {
    key: string;
    icon: IIconName;
    title: string;
    onPress?: () => void;
    show?: boolean;
    /** 桌面菜单：与前一项之间画分组线 */
    divider?: boolean;
    /** 桌面菜单：不可点（纯信息行，如「已下载」） */
    disabled?: boolean;
}

interface IOptionsInput {
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    from?: string;
}

export default function useMusicItemOptions(
    props: IOptionsInput,
): IMusicItemOption[] {
    const { musicItem, musicSheet, from } = props ?? {};
    const { t } = useI18N();

    const downloaded = LocalMusicSheet.isLocalMusic(musicItem);
    const associatedLrc = getMediaExtraProperty(musicItem, "associatedLrc");

    return [
        {
            key: "id",
            icon: "identification",
            title: `ID: ${getMediaUniqueKey(musicItem)}`,
            onPress: () => {
                mediaCache.setMediaCache(musicItem);
                Clipboard.setString(
                    JSON.stringify(
                        {
                            platform: musicItem.platform,
                            id: musicItem.id,
                        },
                        null,
                        "",
                    ),
                );
                Toast.success(t("toast.copiedToClipboard"));
            },
        },
        {
            key: "artist",
            icon: "user",
            title: t("panel.musicItemOptions.author", {
                artist: musicItem.artist,
            }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.artist.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            key: "album",
            icon: "album-outline",
            show: !!musicItem.album,
            title: t("panel.musicItemOptions.album", {
                album: musicItem.album,
            }),
            onPress: () => {
                try {
                    Clipboard.setString(musicItem.album.toString());
                    Toast.success(t("toast.copiedToClipboard"));
                } catch {
                    Toast.warn(t("toast.copiedToClipboardFailed"));
                }
            },
        },
        {
            key: "next",
            icon: "motion-play",
            divider: true,
            title: t("musicListEditor.addToNextPlay"),
            onPress: () => {
                TrackPlayer.addNext(musicItem);
                hidePanel();
            },
        },
        {
            key: "addToSheet",
            icon: "folder-plus",
            title: t("musicListEditor.addToSheet"),
            onPress: () => {
                showPanel("AddToMusicSheet", { musicItem });
            },
        },
        {
            key: "download",
            icon: "arrow-down-tray",
            divider: true,
            title: t("common.download"),
            show: !downloaded,
            onPress: async () => {
                showPanel("MusicQuality", {
                    musicItem,
                    type: "download",
                    async onQualityPress(quality) {
                        downloader.download(musicItem, quality);
                    },
                });
            },
        },
        {
            key: "downloaded",
            icon: "check-circle-outline",
            title: t("panel.musicItemOptions.downloaded"),
            show: !!downloaded,
            disabled: true,
        },
        {
            key: "comment",
            icon: "chat-bubble-oval-left-ellipsis",
            title: t("panel.musicItemOptions.readComment"),
            show: !!pluginManager
                .getByMedia(musicItem)
                ?.supportedMethods.has("getMusicComments"),
            onPress: () => {
                showPanel("MusicComment", { musicItem });
            },
        },
        {
            key: "remove",
            icon: "trash-outline",
            divider: true,
            title: t("common.delete"),
            show: !!musicSheet,
            onPress: async () => {
                if (musicSheet?.id === localMusicSheetId) {
                    await LocalMusicSheet.removeMusic(musicItem);
                } else if (musicSheet?.id === musicHistorySheetId) {
                    await musicHistory.removeMusic(musicItem);
                } else {
                    await MusicSheet.removeMusic(musicSheet!.id, musicItem);
                }
                Toast.success(t("toast.deleteSuccess"));
                hidePanel();
            },
        },
        {
            key: "removeDownload",
            icon: "trash-outline",
            title: t("panel.musicItemOptions.deleteLocalDownload"),
            show: !!downloaded,
            onPress: () => {
                showDialog("SimpleDialog", {
                    title: t("panel.musicItemOptions.deleteLocalDownload"),
                    content: t(
                        "panel.musicItemOptions.deleteLocalDownloadConfirm",
                    ),
                    async onOk() {
                        try {
                            await LocalMusicSheet.removeMusic(musicItem, true);
                            Toast.success(t("toast.deleteSuccess"));
                        } catch (e: any) {
                            Toast.warn(
                                `${t("panel.musicItemOptions.deleteFailed")} ${e?.message ?? e}`,
                            );
                        }
                    },
                });
            },
        },
        {
            key: "lyric",
            icon: "link",
            divider: true,
            title: associatedLrc
                ? t("panel.musicItemOptions.associatedLyric", {
                    platform: associatedLrc.platform,
                    id: associatedLrc.id,
                })
                : t("panel.musicItemOptions.associateLyric"),
            onPress: () => {
                if (
                    Config.getConfig("basic.associateLyricType") === "input"
                ) {
                    showPanel("AssociateLrc", { musicItem });
                } else {
                    showPanel("SearchLrc", { musicItem });
                }
            },
        },
        {
            key: "unassociateLyric",
            icon: "link-slash",
            title: t("panel.musicItemOptions.unassociateLyric"),
            show: !!associatedLrc,
            onPress: () => {
                lyricManager.unassociateLyric(musicItem);
                Toast.success(
                    t("panel.musicItemOptions.unassociateLyricSuccess"),
                );
                hidePanel();
            },
        },
        {
            key: "timingClose",
            icon: "alarm-outline",
            divider: true,
            title: t("panel.musicItemOptions.timingClose"),
            show: from === ROUTE_PATH.MUSIC_DETAIL,
            onPress: () => {
                showPanel("TimingClose");
            },
        },
        {
            key: "clearCache",
            icon: "archive-box-x-mark",
            title: t("panel.musicItemOptions.clearPluginCache"),
            onPress: () => {
                mediaCache.removeMediaCache(musicItem);
                Toast.success(t("panel.musicItemOptions.cacheCleared"));
            },
        },
    ];
}
