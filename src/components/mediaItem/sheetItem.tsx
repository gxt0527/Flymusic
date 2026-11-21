import { useLayoutMode } from "@/components/layout";
import React from "react";
import { StyleSheet, View } from "react-native";
import rpx from "@/utils/rpx";
import { ROUTE_PATH, useNavigate } from "@/core/router";
import ImageBtn from "../base/imageBtn";

interface ISheetItemProps {
    pluginHash: string;
    sheetInfo: IMusic.IMusicSheetItemBase;
}

const marginBottom = rpx(16);

export default function SheetItem(props: ISheetItemProps) {
    const { sheetInfo, pluginHash } = props ?? {};
    const navigate = useNavigate();
    const isDesktop = useLayoutMode() !== "tab";
    return (
        <View style={[style.imageWrapper, isDesktop && style.imageWrapperDesktop]}>
            <ImageBtn
                fluid={isDesktop}
                style={{
                    marginBottom: isDesktop ? 0 : marginBottom,
                }}
                uri={sheetInfo?.artwork ?? sheetInfo?.coverImg}
                title={sheetInfo?.title}
                onPress={() => {
                    navigate(ROUTE_PATH.PLUGIN_SHEET_DETAIL, {
                        pluginHash,
                        sheetInfo,
                    });
                }}
            />
        </View>
    );
}
const style = StyleSheet.create({
    imageWrapper: {
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
    },
    /** 桌面网格：列间留白放在卡片外层，卡片自身宽度跟随列 */
    imageWrapperDesktop: {
        alignItems: "stretch",
        paddingHorizontal: 6,
        paddingBottom: 14,
    },
});
