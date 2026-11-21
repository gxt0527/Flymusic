import React from "react";
import {
    ActivityIndicator,
    Platform,
    StyleProp,
    StyleSheet,
    TouchableOpacity,
    View,
    ViewStyle,
    useWindowDimensions,
} from "react-native";
import rpx from "@/utils/rpx";
import ListItem from "../base/listItem";

import { breakpoint } from "@/theme";
import LocalMusicSheet from "@/core/localMusicSheet";
import strings from "@/core/importPlaylist/strings";
import { ImportItemStatus } from "@/core/importPlaylist/types";
import { getPressAnchor } from "../panels/anchor";
import { showPanel } from "../panels/usePanel";
import TitleAndTag from "./titleAndTag";
import ThemeText from "../base/themeText";
import TrackPlayer from "@/core/trackPlayer";
import Icon from "@/components/base/icon.tsx";
import useColors from "@/hooks/useColors";

interface IMusicItemProps {
    index?: string | number;
    showMoreIcon?: boolean;
    musicItem: IMusic.IMusicItem;
    musicSheet?: IMusic.IMusicSheetItem;
    onItemPress?: (musicItem: IMusic.IMusicItem) => void;
    onItemLongPress?: () => void;
    itemPaddingRight?: number;
    left?: () => JSX.Element;
    containerStyle?: StyleProp<ViewStyle>;
    highlight?: boolean;
    /** 导入歌单占位项的状态；有值且不是 resolved 时整行置灰、禁止播放 */
    importStatus?: ImportItemStatus;
    onImportRetry?: () => void;
    onImportSearchMore?: () => void;
}
export default function MusicItem(props: IMusicItemProps) {
    const {
        musicItem,
        index,
        onItemPress,
        onItemLongPress,
        musicSheet,
        itemPaddingRight,
        showMoreIcon = true,
        left: Left,
        containerStyle,
        highlight = false,
        importStatus,
        onImportRetry,
        onImportSearchMore,
    } = props;
    const colors = useColors();
    const { width: windowWidth } = useWindowDimensions();
    /** 宽屏下把三点按钮位置带给面板，让菜单贴着按钮展开；窄屏保持底部抽屉 */
    const wideWeb = Platform.OS === "web" && windowWidth >= breakpoint.compact;
    const isPlaceholder = !!importStatus && importStatus !== "resolved";
    const isMatching =
        importStatus === "pending" || importStatus === "matching";

    return (
        <ListItem
            heightType="big"
            style={containerStyle}
            withHorizontalPadding
            leftPadding={index !== undefined ? 0 : undefined}
            rightPadding={itemPaddingRight}
            onLongPress={onItemLongPress}
            onPress={
                isPlaceholder
                    ? undefined
                    : () => {
                        if (onItemPress) {
                            onItemPress(musicItem);
                        } else {
                            TrackPlayer.play(musicItem);
                        }
                    }
            }>
            {Left ? <Left /> : null}
            {index !== undefined ? (
                <ListItem.ListItemText
                    width={rpx(82)}
                    position="none"
                    fixedWidth
                    fontColor={
                        isPlaceholder
                            ? "textSecondary"
                            : highlight
                                ? "primary"
                                : "text"
                    }
                    contentStyle={styles.indexText}>
                    {index}
                </ListItem.ListItemText>
            ) : null}
            <ListItem.Content
                title={
                    isPlaceholder ? (
                        <View style={styles.placeholderTitle}>
                            <ThemeText
                                numberOfLines={1}
                                fontColor="textSecondary"
                                style={styles.placeholderName}>
                                {musicItem.title}
                            </ThemeText>
                            <ThemeText
                                numberOfLines={1}
                                fontSize="description"
                                fontColor="textSecondary">
                                {isMatching
                                    ? strings.statusMatching
                                    : strings.statusFailed}
                            </ThemeText>
                        </View>
                    ) : (
                        <TitleAndTag
                            title={musicItem.title}
                            titleFontColor={highlight ? "primary" : "text"}
                            tag={musicItem.platform}
                        />
                    )
                }
                description={
                    <View style={styles.descContainer}>
                        {LocalMusicSheet.isLocalMusic(musicItem) && (
                            <Icon
                                style={styles.icon}
                                color="#11659a"
                                name="check-circle"
                                size={rpx(22)}
                            />
                        )}
                        <ThemeText
                            numberOfLines={1}
                            fontSize="description"
                            fontColor={
                                highlight ? "primary" : "textSecondary"
                            }>
                            {musicItem.artist}
                            {musicItem.album ? ` - ${musicItem.album}` : ""}
                        </ThemeText>
                    </View>
                }
            />
            {isPlaceholder ? (
                <View style={styles.importActions}>
                    {isMatching ? (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                        />
                    ) : (
                        <>
                            <TouchableOpacity
                                accessibilityLabel={strings.retry}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                onPress={onImportRetry}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary">
                                    {strings.retry}
                                </ThemeText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                accessibilityLabel={strings.searchMore}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                                onPress={onImportSearchMore}>
                                <ThemeText
                                    fontSize="description"
                                    fontColor="primary">
                                    {strings.searchMoreShort}
                                </ThemeText>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ) : showMoreIcon ? (
                /** 加宽透明命中区（按钮本身无背景，视觉不变），避免误触整行播放 */
                <ListItem.ListItemIcon
                    width={rpx(72)}
                    fixedWidth
                    position="none"
                    icon="ellipsis-vertical"
                    onPress={(e?: unknown) => {
                        showPanel("MusicItemOptions", {
                            musicItem,
                            musicSheet,
                            anchor: wideWeb ? getPressAnchor(e) : undefined,
                        });
                    }}
                />
            ) : null}
        </ListItem>
    );
}

const styles = StyleSheet.create({
    icon: {
        marginRight: rpx(6),
    },
    descContainer: {
        flexDirection: "row",
        marginTop: rpx(16),
    },

    indexText: {
        fontStyle: "italic",
        textAlign: "center",
        padding: rpx(2),
    },
    placeholderTitle: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: rpx(12),
    },
    placeholderName: {
        flexShrink: 1,
    },
    importActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: rpx(20),
        minWidth: rpx(150),
    },
});
