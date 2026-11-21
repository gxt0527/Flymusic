import React from "react";

import Header from "./header";
import Body from "./body";
import PanelBase, { IPanelAnchor } from "../../base/panelBase";
import Divider from "@/components/base/divider";
import { vh } from "@/utils/rpx";

export interface IPlayListPanelProps {
    /**
     * 桌面端播放条「播放列表」按钮的位置。
     * 传了就把浮层挂到按钮正上方、与按钮竖直中线对齐；
     * 不传（移动端、其他入口）时仍是底部抽屉。
     */
    anchor?: IPanelAnchor;
}

export default function (props: IPlayListPanelProps) {
    return (
        <PanelBase
            height={vh(80)}
            keyboardAvoidBehavior="none"
            positionMethod={props.anchor ? "anchor" : "bottom"}
            anchor={props.anchor}
            renderBody={loading => (
                <>
                    <Header />
                    <Divider />
                    <Body loading={loading} />
                </>
            )}
        />
    );
}
