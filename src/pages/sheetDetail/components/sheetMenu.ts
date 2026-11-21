/**
 * 歌单详情页的三点菜单项
 *
 * 菜单按钮在两种布局下的落点不同：
 *   - 窄屏（底部 Tab）：仍挂在标题栏右侧；
 *   - 桌面：挂在操作行（播放全部 / 管理 / 导入歌单 同一排），
 *     这样向下滚动收起标题时 ⋮ 不会跟着一起消失。
 * 两处必须是同一份菜单，所以抽成 hook。
 */
import { showDialog } from "@/components/dialogs/useDialog";
import type { IMenuOption } from "@/components/base/menuButton";
import { showPanel } from "@/components/panels/usePanel.ts";
import { SortType } from "@/constants/commonConst.ts";
import { useI18N } from "@/core/i18n";
import MusicSheet from "@/core/musicSheet";
import { ROUTE_PATH } from "@/core/router";
import Toast, { default as toast } from "@/utils/toast";
import { useNavigation } from "@react-navigation/native";

export default function useSheetMenu(
    id: string,
    musicSheet: IMusic.IMusicSheetItem,
): IMenuOption[] {
    const navigation = useNavigation<any>();
    const { t } = useI18N();

    return [
        {
            icon: "pencil-outline",
            title: t("sheetDetail.editSheetInfo"),
            onPress() {
                showPanel("EditMusicSheetInfo", {
                    musicSheet: musicSheet,
                });
            },
        },
        {
            icon: "pencil-square",
            title: t("sheetDetail.batchEditMusic"),
            onPress() {
                navigation.navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                    musicList: musicSheet.musicList,
                    musicSheet: musicSheet,
                });
            },
        },
        {
            icon: "sort-outline",
            title: t("sheetDetail.sortMusic"),
            onPress() {
                showDialog("RadioDialog", {
                    content: [
                        {
                            value: SortType.Title,
                            label: t("sheetDetail.sortMusicOption.byTitle"),
                        },
                        {
                            value: SortType.Artist,
                            label: t("sheetDetail.sortMusicOption.byArtist"),
                        },
                        {
                            value: SortType.Album,
                            label: t("sheetDetail.sortMusicOption.byAlbum"),
                        },
                        {
                            value: SortType.Newest,
                            label: t("sheetDetail.sortMusicOption.newest"),
                        },
                        {
                            value: SortType.Oldest,
                            label: t("sheetDetail.sortMusicOption.oldest"),
                        },
                    ],
                    defaultSelected:
                        MusicSheet.getSheetMeta(id, "sort") || SortType.None,
                    title: t("sheetDetail.sortMusic"),
                    async onOk(value) {
                        await MusicSheet.setSortType(id, value as SortType);
                        toast.success(t("toast.sortHasBeenUpdated"));
                    },
                });
            },
        },
        {
            icon: "trash-outline",
            title: t("sheetDetail.deleteSheet"),
            show: id !== "favorite",
            onPress() {
                showDialog("SimpleDialog", {
                    title: t("sheetDetail.deleteSheet"),
                    content: t("sheetDetail.deleteSheetContent", {
                        name: musicSheet.title,
                    }),
                    onOk: async () => {
                        await MusicSheet.removeSheet(id);
                        Toast.success(t("toast.deleteSuccess"));
                        navigation.goBack();
                    },
                });
            },
        },
    ];
}
