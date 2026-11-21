/**
 * 批量编辑页的音乐行
 *
 * 移动端沿用 <MusicItem />（List 行高 120rpx，触控区大）；
 * 桌面端换成与其它列表一致的 56 高紧凑行：勾选框 · 封面 40 · 歌名/歌手。
 */
import React, { memo, useCallback } from "react";
import {
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { produce } from "immer";
import { useAtom, useSetAtom } from "jotai";

import CheckBox from "@/components/base/checkbox";
import FastImage from "@/components/base/fastImage";
import Empty from "@/components/base/empty";
import SortableFlatList from "@/components/base/SortableFlatList";
import { useLayoutMode } from "@/components/layout";
import MusicItem from "@/components/mediaItem/musicItem";
import { ImgAsset } from "@/constants/assetsConst";
import { useI18N } from "@/core/i18n";
import { useTokens } from "@/theme";
import rpx from "@/utils/rpx";

import {
    IEditorMusicItem,
    editingMusicListAtom,
    musicListChangedAtom,
} from "../store/atom";

const ITEM_HEIGHT_MOBILE = 68;
const ITEM_HEIGHT_DESKTOP = 56;

const webCursor = Platform.OS === "web" ? ({ cursor: "pointer" } as any) : null;

interface IMusicEditorItemProps {
    index: number;
    editorMusicItem: IEditorMusicItem;
    desktop?: boolean;
}

function _MusicEditorItem(props: IMusicEditorItemProps) {
    const { index, editorMusicItem, desktop } = props;
    const setEditingMusicList = useSetAtom(editingMusicListAtom);
    const t = useTokens();
    const { t: translate } = useI18N();

    const onPress = useCallback(() => {
        setEditingMusicList(
            produce(draft => {
                draft[index].checked = !draft[index].checked;
            }),
        );
    }, [index]);

    if (desktop) {
        const { musicItem, checked } = editorMusicItem;
        return (
            <Pressable
                onPress={onPress}
                style={[
                    styles.row,
                    webCursor,
                    checked && {
                        backgroundColor: t.isDark
                            ? "rgba(255,255,255,0.05)"
                            : "rgba(0,0,0,0.045)",
                    },
                ]}>
                <View style={styles.check}>
                    <CheckBox checked={checked} />
                </View>
                <FastImage
                    style={styles.cover}
                    source={musicItem.artwork}
                    placeholderSource={ImgAsset.albumDefault}
                />
                <View style={styles.meta}>
                    <Text
                        numberOfLines={1}
                        style={[styles.title, { color: t.color.text.primary }]}>
                        {musicItem.title}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[
                            styles.artist,
                            { color: t.color.text.secondary },
                        ]}>
                        {musicItem.artist ??
                            translate("common.unknownArtist")}
                    </Text>
                </View>
            </Pressable>
        );
    }

    return (
        <MusicItem
            musicItem={editorMusicItem.musicItem}
            left={() => (
                <View style={styles.checkBoxMobile}>
                    <CheckBox checked={editorMusicItem.checked} />
                </View>
            )}
            showMoreIcon={false}
            itemPaddingRight={rpx(100)}
            onItemPress={onPress}
        />
    );
}

const MusicEditorItem = memo(
    _MusicEditorItem,
    (prev, curr) =>
        prev.editorMusicItem === curr.editorMusicItem &&
        prev.index === curr.index &&
        prev.desktop === curr.desktop,
);

/** 音乐列表 */
export default function MusicList() {
    const [editingMusicList, setEditingMusicList] =
        useAtom(editingMusicListAtom);
    const setMusicListChanged = useSetAtom(musicListChangedAtom);
    const desktop = useLayoutMode() !== "tab";
    const t = useTokens();

    const renderItem = useCallback(
        ({ index, item }: any) => {
            return (
                <MusicEditorItem
                    editorMusicItem={item}
                    index={index!}
                    desktop={desktop}
                />
            );
        },
        [editingMusicList, desktop],
    );

    if (!editingMusicList?.length) {
        return <Empty />;
    }

    return (
        <SortableFlatList
            activeBackgroundColor={t.color.bg.hover}
            marginTop={desktop ? 180 : 100}
            data={editingMusicList}
            renderItem={renderItem}
            itemHeight={desktop ? ITEM_HEIGHT_DESKTOP : ITEM_HEIGHT_MOBILE}
            onSortEnd={newData => {
                setEditingMusicList(newData);
                setMusicListChanged(true);
            }}
        />
    );
}

const styles = StyleSheet.create({
    checkBoxMobile: {
        height: "100%",
        justifyContent: "center",
        marginRight: 8,
    },
    row: {
        height: ITEM_HEIGHT_DESKTOP,
        /** SortableFlatList 的 item 容器是 flex-end 行布局，不给 flex 会被推到右侧 */
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 6,
        paddingRight: 60,
        borderRadius: 8,
    },
    check: {
        width: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    cover: {
        width: 38,
        height: 38,
        borderRadius: 7,
    },
    meta: {
        minWidth: 0,
        flex: 1,
    },
    title: {
        fontSize: 13.5,
        lineHeight: 19,
        fontWeight: "500",
        includeFontPadding: false,
    },
    artist: {
        marginTop: 2,
        fontSize: 11.5,
        lineHeight: 15,
        includeFontPadding: false,
    },
});
