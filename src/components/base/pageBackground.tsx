import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import useColors from "@/hooks/useColors";

function PageBackground() {
    const colors = useColors();

    return (
        <View
            style={[
                style.wrapper,
                {
                    backgroundColor:
                        colors?.pageBackground ?? colors.background,
                },
            ]}
        />
    );
}
export default memo(PageBackground, () => true);

const style = StyleSheet.create({
    wrapper: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
    },
});
