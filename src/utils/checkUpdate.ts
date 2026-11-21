import axios from "axios";
import { compare } from "compare-versions";
import DeviceInfo from "react-native-device-info";

// Fly音乐：不再使用上游 MusicFree 的发布源。
// 保留上游地址会导致检查到「新版」后把原版 APK 下载安装，应用名被覆盖回 MusicFree。
// 将来自建发布源时，把自有 release/version.json 地址填进这个数组即可，其余逻辑不用改。
const updateList: string[] = [];

interface IUpdateInfo {
    needUpdate: boolean;
    data: {
        version: string;
        changeLog: string[];
        download: string[];
    };
}

export default async function checkUpdate(): Promise<IUpdateInfo | undefined> {
    const currentVersion = DeviceInfo.getVersion();
    for (let i = 0; i < updateList.length; ++i) {
        try {
            const rawInfo = (await axios.get(updateList[i])).data;
            if (compare(rawInfo.version, currentVersion, ">")) {
                return {
                    needUpdate: true,
                    data: rawInfo,
                };
            }
        } catch {}
    }
}
