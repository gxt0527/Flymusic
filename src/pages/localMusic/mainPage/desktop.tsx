/**
 * 本地音乐 - 桌面端（Windows）
 *
 * 和移动端最大的区别：选目录不跳页面。
 * 之前点「扫描本地音乐」会进 `file-selector` —— 那是 Android 的文件浏览器
 * （右侧复选框、底部通栏按钮、根目录时返回键点不动），在 1440px 的桌面上
 * 完全不是一回事。桌面这里直接调 Windows 原生资源管理器对话框选文件夹，
 * 选完当场扫描，选过的目录以卡片形式留在页面上，可以重新扫描 / 在资源
 * 管理器里打开 / 移除。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Color from "color";

import Icon, { IIconName } from "@/components/base/icon";
import MusicList from "@/components/musicList";
import { showDialog } from "@/components/dialogs/useDialog";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import LocalMusicSheet from "@/core/localMusicSheet";
import { useI18N } from "@/core/i18n";
import { useLayoutMode } from "@/components/layout";
import { localMusicSheetId, localPluginPlatform, RequestStateCode } from "@/constants/commonConst";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import Toast from "@/utils/toast";
import {
    folderName,
    hasNativeDirectoryPicker,
    pickDirectory,
} from "@/utils/directoryPicker";
import { invoke, isElectron } from "@/platform/web/host";
import { getLocalPath } from "@/utils/mediaUtils";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface IToolButtonProps {
    icon: IIconName;
    label: string;
    disabled?: boolean;
    /** 侧栏收成图标栏（窗口较窄）时不显示文字，避免工具条被挤爆 */
    iconOnly?: boolean;
    onPress: () => void;
}

function ToolButton(props: IToolButtonProps) {
    const colors = useColors();
    const { icon, label, disabled, iconOnly, onPress } = props;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.toolButton,
                iconOnly && styles.toolButtonIconOnly,
                webCursor,
                disabled && { opacity: 0.35 },
                pressed && !disabled && { backgroundColor: colors.card },
            ]}>
            <Icon name={icon} size={15} color={colors.textSecondary} />
            {iconOnly ? null : (
                <Text
                    style={[styles.toolText, { color: colors.textSecondary }]}
                    numberOfLines={1}>
                    {label}
                </Text>
            )}
        </Pressable>
    );
}

interface IFolderCardProps {
    path: string;
    count: number;
    onRescan: (path: string) => void;
    onRemove: (path: string) => void;
}

function FolderCard(props: IFolderCardProps) {
    const { path, count, onRescan, onRemove } = props;
    const colors = useColors();
    const { t } = useI18N();

    const openInExplorer = useCallback(() => {
        if (isElectron) {
            invoke("shell:openPath", path).catch(() => {});
        }
    }, [path]);

    return (
        <View
            style={[
                styles.folderCard,
                {
                    backgroundColor: Color(colors.card).alpha(0.55).toString(),
                    borderColor: Color(colors.text).alpha(0.07).toString(),
                },
            ]}>
            <View style={styles.folderIconWrap}>
                <Icon name="folder" size={17} color={colors.primary} />
            </View>
            <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("localMusic.openInExplorer")}
                onPress={openInExplorer}
                style={[styles.folderInfo, webCursor]}>
                <View style={styles.folderNameRow}>
                    <Text
                        numberOfLines={1}
                        style={[styles.folderName, { color: colors.text }]}>
                        {folderName(path)}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.folderCount,
                            { color: colors.textSecondary },
                        ]}>
                        {t("localMusic.songsCount", { count })}
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    ellipsizeMode="middle"
                    style={[
                        styles.folderPath,
                        { color: colors.textSecondary },
                    ]}>
                    {path}
                </Text>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("localMusic.rescan")}
                onPress={() => onRescan(path)}
                style={({ pressed }) => [
                    styles.folderAction,
                    webCursor,
                    pressed && { backgroundColor: colors.card },
                ]}>
                <Icon name="arrow-path" size={14} color={colors.textSecondary} />
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("localMusic.removeFolder")}
                onPress={() => onRemove(path)}
                style={({ pressed }) => [
                    styles.folderAction,
                    webCursor,
                    pressed && { backgroundColor: colors.card },
                ]}>
                <Icon
                    name="trash-outline"
                    size={14}
                    color={colors.textSecondary}
                />
            </Pressable>
        </View>
    );
}

export default function DesktopLocalMusic() {
    const { t } = useI18N();
    const colors = useColors();
    const navigate = useNavigate();
    const musicList = LocalMusicSheet.useMusicList();
    const folders = LocalMusicSheet.useFolders();
    const [pending, setPending] = useState(false);
    /** 窗口 600–840 时侧栏收成图标栏，工具条也要跟着收成纯图标 */
    const iconOnly = useLayoutMode() === "rail";

    const summary = useMemo(() => {
        const folderText = folders.length
            ? t("localMusic.foldersCount", { count: folders.length })
            : t("localMusic.noFolder");
        return `${folderText} · ${t("localMusic.songsCount", {
            count: musicList.length,
        })}`;
    }, [folders.length, musicList.length, t]);

    /** 扫描 + 入库：目录先记账，再走一遍原有的扫描逻辑 */
    const runImport = useCallback(
        (paths: string[]) =>
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
                        Toast.warn(
                            `${t("localMusic.scanFailed")} ${e?.message ?? ""}`,
                        );
                        hideDialog();
                        resolve(false);
                    },
                    onCancel(hideDialog) {
                        LocalMusicSheet.cancelImportLocal();
                        hideDialog();
                        resolve(false);
                    },
                });
            }),
        [t],
    );

    /** 桌面：原生对话框；非桌面（理论上不会走到）回落到应用内文件选择页 */
    const addFolders = useCallback(async () => {
        if (pending) {
            return;
        }
        if (!hasNativeDirectoryPicker) {
            navigate(ROUTE_PATH.FILE_SELECTOR, {
                fileType: "folder",
                multi: true,
                actionText: t("localMusic.beginScan"),
                async onAction(selectedFiles: any[]) {
                    await runImport(selectedFiles.map(_ => _.path));
                    return true;
                },
            });
            return;
        }
        setPending(true);
        try {
            const picked = await pickDirectory({
                title: t("localMusic.importFoldersTitle"),
                buttonLabel: t("localMusic.beginScan"),
                multiple: true,
            });
            if (picked && picked.length) {
                await runImport(picked);
            }
        } finally {
            setPending(false);
        }
    }, [navigate, pending, runImport, t]);

    const rescan = useCallback(
        (path: string) => {
            runImport([path]);
        },
        [runImport],
    );

    const removeFolder = useCallback(
        (path: string) => {
            showDialog("SimpleDialog", {
                title: t("localMusic.removeFolder"),
                content: `${path}\n\n${t("localMusic.removeFolderConfirm")}`,
                okText: t("localMusic.removeFolder"),
                async onOk() {
                    await LocalMusicSheet.removeFolder(path);
                    Toast.success(t("toast.deleteSuccess"));
                },
            });
        },
        [t],
    );

    const playAll = useCallback(() => {
        if (musicList.length) {
            TrackPlayer.playWithReplacePlayList(musicList[0], musicList);
        }
    }, [musicList]);

    const empty = musicList.length === 0;

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {t("home.localMusic")}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.subtitle,
                            { color: colors.textSecondary },
                        ]}>
                        {summary}
                    </Text>
                </View>

                <ToolButton
                    icon="play-circle"
                    label={t("playAllBar.title")}
                    disabled={empty}
                    iconOnly={iconOnly}
                    onPress={playAll}
                />
                <ToolButton
                    icon="magnifying-glass"
                    label={t("common.search")}
                    disabled={empty}
                    iconOnly={iconOnly}
                    onPress={() =>
                        navigate(ROUTE_PATH.SEARCH_MUSIC_LIST, {
                            musicList: LocalMusicSheet.getMusicList(),
                        })
                    }
                />
                <ToolButton
                    icon="pencil-square"
                    label={t("common.batchEdit")}
                    disabled={empty}
                    iconOnly={iconOnly}
                    onPress={() =>
                        navigate(ROUTE_PATH.MUSIC_LIST_EDITOR, {
                            musicList: LocalMusicSheet.getMusicList(),
                            musicSheet: {
                                id: localMusicSheetId,
                                // 不带 title 时页头会退回默认的「歌单」
                                title: t("nav.localMusic"),
                            },
                        })
                    }
                />
                <ToolButton
                    icon="arrow-down-tray"
                    label={t("localMusic.downloadList")}
                    iconOnly={iconOnly}
                    onPress={() => navigate(ROUTE_PATH.DOWNLOADING)}
                />

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("localMusic.addFolder")}
                    onPress={addFolders}
                    style={({ pressed }) => [
                        styles.addButton,
                        { backgroundColor: colors.primary },
                        webCursor,
                        (pressed || pending) && { opacity: 0.8 },
                    ]}>
                    <Icon name="folder-plus" size={15} color="#0B1A15" />
                    <Text style={styles.addText}>
                        {t("localMusic.addFolder")}
                    </Text>
                </Pressable>
            </View>

            {folders.length ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.folderStrip}
                    contentContainerStyle={styles.folderStripContent}>
                    {folders.map(path => (
                        <FolderCard
                            key={path}
                            path={path}
                            count={LocalMusicSheet.getFolderMusicCount(path)}
                            onRescan={rescan}
                            onRemove={removeFolder}
                        />
                    ))}
                </ScrollView>
            ) : null}

            {empty ? (
                <View style={styles.empty}>
                    <View
                        style={[
                            styles.emptyIcon,
                            {
                                backgroundColor: Color(colors.card)
                                    .alpha(0.6)
                                    .toString(),
                            },
                        ]}>
                        <Icon
                            name="folder-music-outline"
                            size={30}
                            color={Color(colors.text).alpha(0.45).toString()}
                        />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                        {folders.length
                            ? t("localMusic.noMusicInFolder")
                            : t("localMusic.emptyTitle")}
                    </Text>
                    <Text
                        style={[
                            styles.emptyDesc,
                            { color: colors.textSecondary },
                        ]}>
                        {t("localMusic.emptyDescDesktop")}
                    </Text>
                    <Text
                        style={[
                            styles.emptyHint,
                            { color: Color(colors.text).alpha(0.32).toString() },
                        ]}>
                        {t("localMusic.supportFormat")}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("localMusic.addFolder")}
                        onPress={addFolders}
                        style={({ pressed }) => [
                            styles.emptyButton,
                            { backgroundColor: colors.primary },
                            webCursor,
                            pressed && { opacity: 0.86 },
                        ]}>
                        <Icon name="folder-plus" size={15} color="#0B1A15" />
                        <Text style={styles.addText}>
                            {t("localMusic.addFolder")}
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.listWrap}>
                    <MusicList
                        musicList={musicList}
                        showIndex
                        state={RequestStateCode.IDLE}
                        desktopPadding={{ left: 20, right: 15 }}
                        // 本地曲目普遍没有 artist 标签，第二行原本一律是
                        // 「未知歌手」；改成显示文件路径，至少能看出是哪一份文件
                        getSubtitle={musicItem =>
                            getLocalPath(musicItem) ?? undefined
                        }
                        musicSheet={
                            {
                                id: localMusicSheetId,
                                title: t("home.localMusic"),
                                platform: localPluginPlatform,
                                musicList: musicList,
                            } as IMusic.IMusicSheetItem
                        }
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        minHeight: 0,
        width: "100%",
    },
    header: {
        height: 52,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        gap: 6,
    },
    headerText: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
    },
    title: {
        fontSize: 19,
        lineHeight: 25,
        fontWeight: "600",
        includeFontPadding: false,
    },
    subtitle: {
        marginTop: 2,
        fontSize: 12,
        lineHeight: 16,
        includeFontPadding: false,
    },
    toolButton: {
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    toolButtonIconOnly: {
        width: 32,
        paddingHorizontal: 0,
        justifyContent: "center",
    },
    toolText: {
        fontSize: 12.5,
        lineHeight: 17,
        includeFontPadding: false,
    },
    addButton: {
        marginLeft: 6,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    addText: {
        fontSize: 13,
        lineHeight: 18,
        fontWeight: "600",
        color: "#0B1A15",
        includeFontPadding: false,
    },
    folderStrip: {
        flexGrow: 0,
        marginBottom: 12,
    },
    folderStripContent: {
        paddingHorizontal: 20,
        gap: 10,
    },
    folderCard: {
        width: 330,
        height: 60,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        gap: 10,
    },
    folderIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    folderInfo: {
        flex: 1,
        minWidth: 0,
    },
    folderNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    folderName: {
        flexShrink: 1,
        fontSize: 13.5,
        lineHeight: 18,
        fontWeight: "500",
        includeFontPadding: false,
    },
    folderPath: {
        marginTop: 2,
        fontSize: 11,
        lineHeight: 15,
        includeFontPadding: false,
    },
    folderCount: {
        fontSize: 11,
        lineHeight: 15,
        includeFontPadding: false,
    },
    folderAction: {
        width: 26,
        height: 26,
        borderRadius: 7,
        alignItems: "center",
        justifyContent: "center",
    },
    listWrap: {
        flex: 1,
        minHeight: 0,
        paddingRight: 5,
    },
    empty: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 40,
    },
    emptyIcon: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyTitle: {
        marginTop: 20,
        fontSize: 17,
        lineHeight: 23,
        fontWeight: "600",
        includeFontPadding: false,
    },
    emptyDesc: {
        marginTop: 10,
        maxWidth: 420,
        textAlign: "center",
        fontSize: 13,
        lineHeight: 20,
        includeFontPadding: false,
    },
    emptyHint: {
        marginTop: 8,
        fontSize: 11.5,
        lineHeight: 16,
        includeFontPadding: false,
    },
    emptyButton: {
        marginTop: 22,
        height: 38,
        paddingHorizontal: 20,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
});
