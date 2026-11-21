import React from "react";
import { ImageProps } from "react-native";

import FadeImage from "./fadeImage";

interface IImageProps extends ImageProps {
    uri?: string | null;
    emptySrc?: any;
}
export default function (props: Omit<IImageProps, "source">) {
    const { uri, emptySrc } = props;
    const source = typeof uri === "string"
        ? {
            uri,
        }
        : emptySrc;
    return <FadeImage {...props} source={source} />;
}
