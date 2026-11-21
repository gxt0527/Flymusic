import React from "react";
import { StyleSheet, View } from "react-native";
import rpx, { vh } from "@/utils/rpx";
import ThemeText from "@/components/base/themeText";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import PanelBase from "../base/panelBase";
import { ScrollView } from "react-native-gesture-handler";
import TypeTag from "@/components/base/typeTag";
import PanelHeader from "../base/panelHeader";
import { useI18N } from "@/core/i18n";

interface ISheetTagsProps {
    tags: IMusic.IMusicSheetGroupItem[];
    /** 点击tag */
    onTagPressed: (tag: ICommon.IUnique) => void;
    /** 当前选中分类（桌面端菜单回显用） */
    selected?: ICommon.IUnique;
    /** 触发按钮的窗口坐标（桌面端菜单贴按钮展开） */
    anchor?: { x: number; y: number; width: number; height: number };
}

export default function SheetTags(props: ISheetTagsProps) {
    const { tags, onTagPressed } = props ?? {};
    const i18n = useI18N();

    const safeAreaInsets = useSafeAreaInsets();

    return (
        <PanelBase
            height={vh(70)}
            renderBody={() => (
                <>
                    <PanelHeader title={i18n.t("panel.sheetTags.title")} hideButtons />
                    <ScrollView
                        style={[
                            style.body,
                            { marginBottom: safeAreaInsets.bottom },
                        ]}>
                        <View style={style.groupItem}>
                            <TypeTag
                                // backgroundColor={backgroundColor}
                                title={i18n.t("common.default")}
                                style={[style.tagItem]}
                                onPress={() => {
                                    onTagPressed({
                                        title: i18n.t("common.default"),
                                        id: "",
                                    });
                                }}
                            />
                        </View>
                        {tags.map((tagGroupItem, index) => (
                            <>
                                <View
                                    style={style.groupItem}
                                    key={tagGroupItem.title ?? index}>
                                    {tagGroupItem.title ? (
                                        <ThemeText
                                            fontSize="content"
                                            fontWeight="medium">
                                            {tagGroupItem.title}
                                        </ThemeText>
                                    ) : null}
                                </View>
                                <View style={style.groupItem}>
                                    {tagGroupItem.data.map(_ => (
                                        <TypeTag
                                            key={_.id}
                                            // backgroundColor={backgroundColor}
                                            title={_.title || i18n.t("common.unknownName")}
                                            style={[style.tagItem]}
                                            onPress={() => {
                                                onTagPressed(_);
                                            }}
                                        />
                                    ))}
                                </View>
                            </>
                        ))}
                    </ScrollView>
                </>
            )}
        />
    );
}

const style = StyleSheet.create({
    header: {
        width: "100%",
        flexDirection: "row",
        padding: rpx(24),
        marginTop: rpx(12),
    },
    body: {
        flex: 1,
        paddingHorizontal: rpx(24),
    },
    item: {
        height: rpx(96),
        justifyContent: "center",
    },
    groupItem: {
        flexDirection: "row",
        paddingVertical: rpx(12),
        flexWrap: "wrap",
    },
    tagItem: {
        marginLeft: 0,
        marginBottom: rpx(20),
    },
});
