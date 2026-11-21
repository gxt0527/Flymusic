/**
 * react-native/Libraries/Image/resolveAssetSource 的 Web 实现
 *
 * 用 react-native-web 的 AssetRegistry 解析打包后的图片资源 id。
 */
import { getAssetByID } from "react-native-web/dist/modules/AssetRegistry";

export default function resolveAssetSource(source: any) {
    if (source === null || source === undefined) {
        return null;
    }
    if (typeof source === "object") {
        return source;
    }
    if (typeof source === "number") {
        const asset = getAssetByID(source);
        if (!asset) {
            return null;
        }
        if (typeof asset === "string") {
            return { uri: asset };
        }
        const uri =
            asset.uri ??
            (asset.httpServerLocation
                ? `${asset.httpServerLocation}/${asset.name}`
                : undefined);
        return uri ? { uri, ...asset } : null;
    }
    return null;
}

export function getAssetByIDCompat(id: number) {
    return getAssetByID(id);
}
