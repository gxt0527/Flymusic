import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import LocalMusicSheet from "@/core/localMusicSheet";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicList from "./localMusicList";
import MusicBar from "@/components/musicBar";
import Toast from "@/utils/toast";
import { showDialog } from "@/components/dialogs/useDialog";
import AppBar from "@/components/base/appBar";
import Icon from "@/components/base/icon";
import { useLayoutMode } from "@/components/layout";
import { useTokens } from "@/theme";
import { useI18N } from "@/core/i18n";
import DesktopLocalMusic from "./desktop";
import { localMusicSheetId } from "@/constants/commonConst";
import { hasNativeDirectoryPicker, pickDirectory } from "@/utils/directoryPicker";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

/**
 * 移动端 / 窄窗口的本地音乐页。
 * 桌面宽屏走 `desktop.tsx`（原生目录对话框 + 文件夹卡片）。
 */
function MobileMainPage() {
    const navigate = useNavigate();
    const { t } = useI18N();
    const tokens = useTokens();
    const musicList = LocalMusicSheet.useMusicList();

    const importPaths = (paths: string[]) =>
        new Promise<boolean>(resolve => {
            showDialog("LoadingDialog", {
                title: t("localMusic.scanLocalMusic"),
                promise: (async () => {
                    await LocalMusicSheet.addFolders(paths);
                    await LocalMusicSheet.importLocal(paths);
                })(),
                onResolve(_data, hideDialog) {
                    Toast.success(t("toast.importSuccess"));
                    hideDialog();
                    resolve(true);
                },
                onReject(e: any, hideDialog) {
                    Toast.warn(`${t("localMusic.scanFailed")} ${e?.message ?? ""}`);
                    hideDialog();
                    resolve(false);
                },
                onCancel(hideDialog) {
                    LocalMusicSheet.cancelImportLocal();
                    hideDialog();
                    resolve(false);
                },
            });
        });

    const scanLocalMusic = async () => {
        if (hasNativeDirectoryPicker) {
            const picked = await pickDirectory({
                title: t("localMusic.importFoldersTitle"),
                buttonLabel: t("localMusic.beginScan"),
                multiple: true,
            });
            if (picked && picked.length) {
                await importPaths(picked);
            }
            return;
        }
        navigate(ROUTE_PATH.FILE_SELECTOR, {
            fileType: "folder",
            multi: true,
            actionText: t("localMusic.beginScan"),
            async onAction(selectedFiles: any[]) {
                await importPaths(selectedFiles.map(_ => _.path));
                return true;
            },
        });
    };

    return (
        <>
            <AppBar
                withStatusBar
                actions={[
                    {
                        icon: "magnifying-glass",
                        onPress() {
                            navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                                musicList: LocalMusicSheet.getMusicList(),
                            });
                        },
                    },
                ]}
                menu={[
                    {
                        icon: "folder-plus",
                        title: t("localMusic.scanLocalMusic"),
                        async onPress() {
                            await scanLocalMusic();
                        },
                    },
                    {
                        icon: "pencil-square",
                        title: t("common.batchEdit"),
                        async onPress() {
                            navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                                musicList: LocalMusicSheet.getMusicList(),
                                musicSheet: {
                                    id: localMusicSheetId,
                                },
                            });
                        },
                    },
                    {
                        icon: "arrow-down-tray",
                        title: t("localMusic.downloadList"),
                        async onPress() {
                            navigate(ROUTE_PATH.DOWNLOADING);
                        },
                    },
                ]}>
                {t("home.localMusic")}
            </AppBar>

            {musicList.length === 0 ? (
                <View style={styles.empty}>
                    <View style={styles.emptyIcon}>
                        <Icon
                            name="folder-music-outline"
                            size={28}
                            color="rgba(255,255,255,0.4)"
                        />
                    </View>
                    <Text style={styles.emptyTitle}>
                        {t("localMusic.emptyTitle")}
                    </Text>
                    <Text style={styles.emptyDesc}>
                        {t("localMusic.emptyDesc")}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("localMusic.scanLocalMusic")}
                        onPress={scanLocalMusic}
                        style={({ pressed }) => [
                            styles.pill,
                            { backgroundColor: tokens.color.primary.base },
                            webCursor,
                            pressed && { opacity: 0.88 },
                        ]}>
                        <Icon
                            name="plus"
                            size={14}
                            color={tokens.color.text.onPrimary}
                        />
                        <Text style={styles.pillText}>
                            {t("localMusic.scanLocalMusic")}
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <LocalMusicList />
            )}

            <MusicBar />
        </>
    );
}

export default function MainPage() {
    const layoutMode = useLayoutMode();

    if (layoutMode !== "tab") {
        return <DesktopLocalMusic />;
    }
    return <MobileMainPage />;
}

const styles = StyleSheet.create({
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    emptyTitle: {
        marginTop: 18,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "500",
        color: "rgba(255,255,255,0.86)",
        includeFontPadding: false,
    },
    emptyDesc: {
        marginTop: 9,
        fontSize: 13,
        lineHeight: 19,
        color: "rgba(255,255,255,0.42)",
        includeFontPadding: false,
    },
    pill: {
        marginTop: 22,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        height: 38,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    pillText: {
        fontSize: 13.5,
        lineHeight: 18,
        fontWeight: "500",
        color: "#0B1A15",
        includeFontPadding: false,
    },
});
