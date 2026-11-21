/**
 * 桌面「基本设置」。
 *
 * 与移动端 basicSetting.tsx 完全分开：桌面没有系统通知栏、移动网络、
 * 状态栏歌词与本地备份，这些项本来就是空实现，不再搬过来。
 * 所有行走 Windows 分组卡片，配置项键名与移动端保持一致，设置不会丢。
 */
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { readdir } from "react-native-fs";

import Icon from "@/components/base/icon";
import { showDialog } from "@/components/dialogs/useDialog";
import { showPanel } from "@/components/panels/usePanel";
import { SortType } from "@/constants/commonConst.ts";
import pathConst from "@/constants/pathConst";
import Config, { useAppConfig } from "@/core/appConfig";
import { useI18N } from "@/core/i18n";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import { NativeTextAlignment } from "@/native/lyricUtil";
import type { AppConfigPropertyKey } from "@/types/core/config";
import { useTokens } from "@/theme";
import {
    clearCache,
    getCacheSize,
    sizeFormatter,
} from "@/utils/fileUtils";
import {
    hasNativeDirectoryPicker,
    pickDirectory,
} from "@/utils/directoryPicker";
import { qualityKeys } from "@/utils/qualities";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import {
    ISettingSelectOption,
    SettingButton,
    SettingGroup,
    SettingRow,
    SettingSelect,
    SettingSlider,
    SettingToggle,
    SettingValue,
    SettingsPage,
} from "./components";

const qualityOptions = (t: (key: any) => string): ISettingSelectOption[] =>
    qualityKeys.map(key => ({ label: t(`musicQuality.${key}`), value: key }));

const orderOptions = (t: (key: any) => string): ISettingSelectOption[] => [
    { label: t("basicSettings.playQualityOrder.asc"), value: "asc" },
    { label: t("basicSettings.playQualityOrder.desc"), value: "desc" },
];

/** 布尔配置行：直接绑定 Config，避免每项都写一串 useAppConfig */
function ConfigToggle({
    title,
    description,
    configKey,
    fallback = false,
}: {
    title: string;
    description?: string;
    configKey: AppConfigPropertyKey;
    fallback?: boolean;
}) {
    const value = useAppConfig(configKey as any) as boolean | undefined;
    return (
        <SettingRow
            title={title}
            description={description}
            right={
                <SettingToggle
                    value={value ?? fallback}
                    onValueChange={next =>
                        Config.setConfig(configKey as any, next as any)
                    }
                />
            }
        />
    );
}

function ConfigSelect({
    title,
    description,
    configKey,
    fallback,
    options,
    onChange,
    testID,
}: {
    title: string;
    description?: string;
    configKey: AppConfigPropertyKey;
    fallback: string | number;
    options: ISettingSelectOption[];
    onChange?: (value: string | number) => void;
    testID?: string;
}) {
    const raw = useAppConfig(configKey as any) as
        | string
        | number
        | undefined;
    const value = (raw ?? fallback) as string | number;
    const valueLabel =
        options.find(option => option.value === value)?.label ?? String(value);
    return (
        <SettingSelect
            testID={testID}
            title={title}
            description={description}
            value={value}
            valueLabel={valueLabel}
            options={options}
            onSelect={next => {
                Config.setConfig(configKey as any, next as any);
                onChange?.(next);
            }}
        />
    );
}

/** 缓存上限统一按整数 MB 显示，未设置时与播放器默认值 512MB 一致 */
function formatCacheLimit(bytes?: number) {
    if (!bytes || bytes <= 0) {
        return "512 MB";
    }
    return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export interface ICacheSize {
    music: number;
    lyric: number;
    image: number;
}

/**
 * 缓存大小没有持久化记录，每次都实时遍历目录。
 * 只在挂载时刷一次会留下陈旧值（播放/下载期间数字一直不动），
 * 所以再补一条导航 focus 监听，从别的页面回到设置时重新统计。
 */
function useCacheSize() {
    const [cacheSize, setCacheSize] = useState<ICacheSize>({
        music: 0,
        lyric: 0,
        image: 0,
    });
    const navigation = useNavigation<any>();

    const refresh = useCallback(async () => {
        const [music, lyric, image] = await Promise.all([
            getCacheSize("music"),
            getCacheSize("lyric"),
            getCacheSize("image"),
        ]);
        setCacheSize({ music, lyric, image });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        const unsubscribe = navigation.addListener("focus", () => {
            refresh();
        });
        return unsubscribe;
    }, [navigation, refresh]);

    return [cacheSize, refresh] as const;
}

export default function BasicSettingDesktop() {
    const { t } = useI18N();
    const tokens = useTokens();
    const navigate = useNavigate();
    const [cacheSize, refreshCacheSize] = useCacheSize();

    const downloadPath = useAppConfig("basic.downloadPath");
    const maxCacheSize = useAppConfig("basic.maxCacheSize");
    const widthPercent = useAppConfig("lyric.widthPercent");
    const fontSize = useAppConfig("lyric.fontSize");

    const openDownloadPath = async () => {
        if (hasNativeDirectoryPicker) {
            const picked = await pickDirectory({
                title: t("basicSettings.downloadPath" as any),
                buttonLabel: t("basicSettings.fileSelector.selectFolder" as any),
                defaultPath: downloadPath ?? pathConst.downloadMusicPath,
            });
            if (picked === null) {
                // 宿主不支持原生对话框，落到应用内选择页
            } else if (picked.length === 0) {
                return;
            } else {
                try {
                    await readdir(picked[0]);
                    Config.setConfig("basic.downloadPath", picked[0]);
                } catch {
                    Toast.warn(t("toast.folderNotExistOrNoPermission" as any));
                }
                return;
            }
        }
        navigate<"file-selector">(ROUTE_PATH.FILE_SELECTOR, {
            fileType: "folder",
            multi: false,
            actionText: t("basicSettings.fileSelector.selectFolder" as any),
            async onAction(selectedFiles) {
                try {
                    const targetDir = selectedFiles[0];
                    await readdir(targetDir.path);
                    Config.setConfig("basic.downloadPath", targetDir.path);
                    return true;
                } catch {
                    Toast.warn(t("toast.folderNotExistOrNoPermission" as any));
                    return false;
                }
            },
        });
    };

    const openCacheFolder = async () => {
        const host = (globalThis as any)?.flyHost;
        if (!host?.invoke || !pathConst.cacheRoot) {
            return;
        }
        try {
            await host.invoke("shell:openPath", pathConst.cacheRoot);
        } catch {
            Toast.warn(t("toast.folderNotExistOrNoPermission" as any));
        }
    };

    const confirmClear = (
        type: "music" | "lyric" | "image",
        titleKey: string,
        contentKey: string,
        successKey: string,
    ) => {
        showDialog("SimpleDialog", {
            title: t(titleKey as any),
            content: t(contentKey as any),
            async onOk() {
                const ok = await clearCache(type);
                await refreshCacheSize();
                if (ok === false) {
                    Toast.warn(t("setting.cache.clearFailed" as any));
                } else {
                    Toast.success(t(successKey as any));
                }
            },
        });
    };

    return (
        <SettingsPage
            title={t("sidebar.basicSettings" as any)}
            description={t("setting.desktop.basicDescription" as any)}>
            <SettingGroup title={t("basicSettings.common" as any)}>
                <ConfigSelect
                    testID="setting-select-close-action"
                    title={t("basicSettings.closeAction" as any)}
                    configKey="basic.closeAction"
                    fallback="tray"
                    options={[
                        {
                            label: t("basicSettings.closeAction.tray" as any),
                            value: "tray",
                        },
                        {
                            label: t("basicSettings.closeAction.quit" as any),
                            value: "quit",
                        },
                    ]}
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.sheetAndAlbum" as any)}>
                <ConfigSelect
                    title={t("basicSettings.clickMusicInSearch" as any)}
                    configKey="basic.clickMusicInSearch"
                    fallback="playMusic"
                    options={[
                        {
                            label: t(
                                "basicSettings.clickMusicInSearch.playMusic" as any,
                            ),
                            value: "playMusic",
                        },
                        {
                            label: t(
                                "basicSettings.clickMusicInSearch.playMusicAndReplace" as any,
                            ),
                            value: "playMusicAndReplace",
                        },
                    ]}
                />
                <ConfigSelect
                    title={t("basicSettings.clickMusicInAlbum" as any)}
                    configKey="basic.clickMusicInAlbum"
                    fallback="playAlbum"
                    options={[
                        {
                            label: t(
                                "basicSettings.clickMusicInAlbum.playMusic" as any,
                            ),
                            value: "playMusic",
                        },
                        {
                            label: t(
                                "basicSettings.clickMusicInAlbum.playAlbum" as any,
                            ),
                            value: "playAlbum",
                        },
                    ]}
                />
                <ConfigSelect
                    title={t("basicSettings.musicOrderInLocalSheet" as any)}
                    configKey="basic.musicOrderInLocalSheet"
                    fallback="end"
                    options={[
                        { label: t("common.default" as any), value: "end" },
                        {
                            label: t(
                                "basicSettings.musicOrderInLocalSheet.title" as any,
                            ),
                            value: SortType.Title,
                        },
                        {
                            label: t(
                                "basicSettings.musicOrderInLocalSheet.artist" as any,
                            ),
                            value: SortType.Artist,
                        },
                        {
                            label: t(
                                "basicSettings.musicOrderInLocalSheet.album" as any,
                            ),
                            value: SortType.Album,
                        },
                        {
                            label: t(
                                "basicSettings.musicOrderInLocalSheet.newest" as any,
                            ),
                            value: SortType.Newest,
                        },
                        {
                            label: t(
                                "basicSettings.musicOrderInLocalSheet.oldest" as any,
                            ),
                            value: SortType.Oldest,
                        },
                    ]}
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.plugin" as any)}>
                <ConfigToggle
                    title={t("basicSettings.autoUpdatePlugin" as any)}
                    configKey="basic.autoUpdatePlugin"
                />
                <ConfigToggle
                    title={t("basicSettings.lazyLoadPlugin" as any)}
                    configKey="basic.lazyLoadPlugin"
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.playback" as any)}>
                <ConfigToggle
                    title={t("basicSettings.autoPlayWhenAppStart" as any)}
                    configKey="basic.autoPlayWhenAppStart"
                />
                <ConfigToggle
                    title={t("basicSettings.tryChangeSourceWhenPlayFail" as any)}
                    configKey="basic.tryChangeSourceWhenPlayFail"
                />
                <ConfigToggle
                    title={t("basicSettings.autoStopWhenError" as any)}
                    configKey="basic.autoStopWhenError"
                />
                <ConfigSelect
                    title={t("basicSettings.defaultPlayQuality" as any)}
                    configKey="basic.defaultPlayQuality"
                    fallback="standard"
                    options={qualityOptions(t as any)}
                />
                <ConfigSelect
                    title={t("basicSettings.playQualityOrder" as any)}
                    configKey="basic.playQualityOrder"
                    fallback="asc"
                    options={orderOptions(t as any)}
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.download" as any)}>
                <SettingRow
                    title={t("basicSettings.downloadPath" as any)}
                    description={
                        downloadPath ?? pathConst.downloadMusicPath
                    }
                    onPress={openDownloadPath}
                    right={
                        <Icon
                            name="chevron-right"
                            size={14}
                            color={tokens.color.text.tertiary}
                        />
                    }
                />
                <ConfigSelect
                    title={t("basicSettings.maxDownload" as any)}
                    configKey="basic.maxDownload"
                    fallback={3}
                    options={[1, 3, 5, 7].map(value => ({
                        label: String(value),
                        value,
                    }))}
                />
                <ConfigSelect
                    title={t("basicSettings.defaultDownloadQuality" as any)}
                    configKey="basic.defaultDownloadQuality"
                    fallback="standard"
                    options={qualityOptions(t as any)}
                />
                <ConfigSelect
                    title={t("basicSettings.downloadQualityOrder" as any)}
                    configKey="basic.downloadQualityOrder"
                    fallback="asc"
                    options={orderOptions(t as any)}
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.lyric" as any)}>
                <ConfigToggle
                    title={t("basicSettings.lyric.autoSearchLyric" as any)}
                    configKey="lyric.autoSearchLyric"
                    fallback
                />
                <SettingSlider
                    title={t("basicSettings.lyric.width" as any)}
                    value={widthPercent ?? 1}
                    min={0}
                    max={1}
                    step={0.01}
                    formatValue={v => `${Math.round(v * 100)}%`}
                    onSlidingComplete={value =>
                        Config.setConfig("lyric.widthPercent", value)
                    }
                />
                <SettingSlider
                    title={t("basicSettings.lyric.fontSize" as any)}
                    value={fontSize ?? Math.round(rpx(30))}
                    min={Math.round(rpx(18))}
                    max={Math.round(rpx(56))}
                    step={0.5}
                    formatValue={v => `${Math.round(v)}`}
                    onSlidingComplete={value =>
                        Config.setConfig("lyric.fontSize", value)
                    }
                />
                <ConfigSelect
                    testID="setting-select-lyric-align"
                    title={t("basicSettings.lyric.align" as any)}
                    configKey="lyric.align"
                    fallback={NativeTextAlignment.CENTER}
                    options={[
                        {
                            label: t("basicSettings.lyric.align.left" as any),
                            value: NativeTextAlignment.LEFT,
                        },
                        {
                            label: t("basicSettings.lyric.align.center" as any),
                            value: NativeTextAlignment.CENTER,
                        },
                        {
                            label: t("basicSettings.lyric.align.right" as any),
                            value: NativeTextAlignment.RIGHT,
                        },
                    ]}
                />
            </SettingGroup>

            <SettingGroup title={t("basicSettings.cache" as any)}>
                <SettingRow
                    testID="setting-cache-location"
                    title={t("setting.cache.location" as any)}
                    description={pathConst.cacheRoot || t("setting.cache.locationDescription" as any)}
                    right={
                        <SettingButton
                            label={t("setting.cache.openFolder" as any)}
                            onPress={openCacheFolder}
                            disabled={!pathConst.cacheRoot}
                        />
                    }
                />
                <SettingRow
                    title={t("basicSettings.cache.musicCacheLimit" as any)}
                    description={t("setting.cache.limitDescription" as any)}
                    onPress={() => {
                        showPanel("SimpleInput", {
                            title: t("dialog.setCacheTitle" as any),
                            placeholder: t("dialog.setCachePlaceholder" as any),
                            onOk(text, closePanel) {
                                let val = parseInt(text, 10);
                                if (val < 100) {
                                    val = 100;
                                } else if (val > 8192) {
                                    val = 8192;
                                }
                                if (val >= 100 && val <= 8192) {
                                    Config.setConfig(
                                        "basic.maxCacheSize",
                                        val * 1024 * 1024,
                                    );
                                    closePanel();
                                    Toast.success(
                                        t("toast.cacheSetSuccess" as any),
                                    );
                                }
                            },
                        });
                    }}
                    right={
                        <View style={inlineGroup.compactRow}>
                            <SettingValue text={formatCacheLimit(maxCacheSize)} />
                            <Icon
                                name="chevron-right"
                                size={14}
                                color={tokens.color.text.tertiary}
                            />
                        </View>
                    }
                />
                <SettingRow
                    testID="setting-cache-music"
                    title={t("basicSettings.cache.clearMusicCache" as any)}
                    description={t("setting.cache.musicDescription" as any)}
                    right={
                        <View style={inlineGroup.row}>
                            <SettingValue text={sizeFormatter(cacheSize.music)} />
                            <SettingButton
                                label={t("common.clear" as any)}
                                onPress={() =>
                                    confirmClear(
                                        "music",
                                        "dialog.clearMusicCacheTitle",
                                        "dialog.clearMusicCacheContent",
                                        "toast.musicCacheCleared",
                                    )
                                }
                            />
                        </View>
                    }
                />
                <SettingRow
                    testID="setting-cache-lyric"
                    title={t("basicSettings.cache.clearLyricCache" as any)}
                    description={t("setting.cache.lyricDescription" as any)}
                    right={
                        <View style={inlineGroup.row}>
                            <SettingValue text={sizeFormatter(cacheSize.lyric)} />
                            <SettingButton
                                label={t("common.clear" as any)}
                                onPress={() =>
                                    confirmClear(
                                        "lyric",
                                        "dialog.clearLyricCacheTitle",
                                        "dialog.clearLyricCacheContent",
                                        "toast.lyricCacheCleared",
                                    )
                                }
                            />
                        </View>
                    }
                />
                <SettingRow
                    testID="setting-cache-image"
                    title={t("basicSettings.cache.clearImageCache" as any)}
                    description={t("setting.cache.imageDescription" as any)}
                    right={
                        <View style={inlineGroup.row}>
                            <SettingValue text={sizeFormatter(cacheSize.image)} />
                            <SettingButton
                                label={t("common.clear" as any)}
                                onPress={() =>
                                    confirmClear(
                                        "image",
                                        "dialog.clearImageCacheTitle",
                                        "dialog.clearImageCacheContent",
                                        "toast.imageCacheCleared",
                                    )
                                }
                            />
                        </View>
                    }
                />
            </SettingGroup>
        </SettingsPage>
    );
}

const inlineGroup = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    compactRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
});
