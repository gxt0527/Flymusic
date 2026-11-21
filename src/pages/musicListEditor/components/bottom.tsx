import Icon, { IIconName } from "@/components/base/icon.tsx";
import ThemeText from "@/components/base/themeText";
import { useLayoutMode } from "@/components/layout";
import { showPanel } from "@/components/panels/usePanel";
import { iconSizeConst } from "@/constants/uiConst";
import downloader from "@/core/downloader";
import { useI18N } from "@/core/i18n";
import { useParams } from "@/core/router";
import TrackPlayer from "@/core/trackPlayer";
import useColors from "@/hooks/useColors";
import { useTokens } from "@/theme";
import rpx from "@/utils/rpx";
import Toast from "@/utils/toast";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { editingMusicListAtom, musicListChangedAtom } from "../store/atom";

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

export default function Bottom() {
    const { musicSheet } = useParams<"music-list-editor">();
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const { t } = useI18N();
    const desktop = useLayoutMode() !== "tab";
    const tokens = useTokens();

    const selectedEditorItems = useMemo(
        () => editingMusicList.filter(_ => _.checked),
        [editingMusicList],
    );

    const selectedItems = useMemo(
        () => selectedEditorItems.map(_ => _.musicItem),
        [selectedEditorItems],
    );

    function resetSelectedIndices() {
        setEditingMusicList(
            editingMusicList.map(_ => ({
                musicItem: _.musicItem,
                checked: false,
            })),
        );
    }

    const actions = (
        <>
            <BottomIcon
                icon="motion-play"
                title={t("musicListEditor.addToNextPlay")}
                desktop={desktop}
                onPress={async () => {
                    TrackPlayer.addNext(selectedItems);
                    resetSelectedIndices();
                    Toast.success(t("toast.addToNextPlay"));
                }}
            />
            <BottomIcon
                icon="folder-plus"
                title={t("musicListEditor.addToSheet")}
                desktop={desktop}
                onPress={() => {
                    if (selectedItems.length) {
                        showPanel("AddToMusicSheet", {
                            musicItem: selectedItems,
                        });
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                icon="arrow-down-tray"
                title={t("common.download")}
                desktop={desktop}
                onPress={() => {
                    if (selectedItems.length) {
                        downloader.download(selectedItems);
                        Toast.success(t("toast.beginDownload"));
                        resetSelectedIndices();
                    }
                }}
            />
            <BottomIcon
                icon="trash-outline"
                title={t("common.delete")}
                desktop={desktop}
                disabled={!selectedItems.length || !musicSheet?.id}
                onPress={() => {
                    if (selectedItems.length && musicSheet?.id) {
                        setEditingMusicList(
                            produce(prev => prev.filter(_ => !_.checked)),
                        );
                        setMusicListChanged(true);
                        Toast.warn(t("toast.rememberToSave"));
                    }
                }}
            />
        </>
    );

    /** 桌面：手机底部四宫格换成一条右对齐工具条 */
    if (desktop) {
        return (
            <View
                style={[
                    styles.wrapperDesktop,
                    {
                        backgroundColor: tokens.color.bg.raised,
                        borderTopColor: tokens.color.divider,
                    },
                ]}>
                <ThemeText
                    fontSize="description"
                    fontColor="textSecondary"
                    numberOfLines={1}>
                    {t("musicListEditor.selectMusicCount", {
                        count: selectedItems.length,
                    })}
                </ThemeText>
                <View style={styles.grow} />
                <View style={styles.actionsDesktop}>{actions}</View>
            </View>
        );
    }

    return <View style={styles.wrapper}>{actions}</View>;
}

interface IBottomIconProps {
    icon: IIconName;
    title: string;
    onPress: () => void;
    /** 桌面：横向 icon + 文案、无底色、hover 高亮 */
    desktop?: boolean;
    disabled?: boolean;
}

function BottomIcon(props: IBottomIconProps) {
    const { icon, title, onPress, desktop, disabled } = props;
    const colors = useColors();
    const tokens = useTokens();
    const [hovered, setHovered] = useState(false);

    if (desktop) {
        return (
            <Pressable
                onPress={onPress}
                onHoverIn={() => setHovered(true)}
                onHoverOut={() => setHovered(false)}
                style={[
                    styles.actionButton,
                    webCursor,
                    hovered && { backgroundColor: tokens.color.bg.hover },
                    disabled && { opacity: 0.42 },
                ]}>
                <Icon name={icon} size={17} color={tokens.color.text.primary} />
                <ThemeText
                    fontSize="description"
                    fontColor="text"
                    numberOfLines={1}>
                    {title}
                </ThemeText>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.bottomIconWrapper,
                { backgroundColor: colors.appBar },
            ]}>
            <Icon
                name={icon}
                color={colors.appBarText}
                style={disabled ? styles.opacity_06 : undefined}
                size={iconSizeConst.big}
            />
            <ThemeText
                fontSize="subTitle"
                fontColor={"appBarText"}
                opacity={disabled ? 0.6 : undefined}
                style={styles.bottomIconText}>
                {title}
            </ThemeText>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: "100%",
        height: rpx(144),
        flexDirection: "row",
    },
    /** 桌面：56 高、右对齐工具条，与播放条同一条视觉基线 */
    wrapperDesktop: {
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    grow: {
        flex: 1,
    },
    actionsDesktop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    actionButton: {
        height: 34,
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    bottomIconWrapper: {
        flex: 1,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
    },
    bottomIconText: {
        marginTop: rpx(12),
    },
    opacity_06: {
        opacity: 0.6,
    },
});
