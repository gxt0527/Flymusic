/**
 * Fly音乐 - Desktop (Electron) 入口
 *
 * 与 RN 入口 index.js 的差异：
 * - 不注册后台播放服务（web 端由 trackPlayer shim 内部处理）
 * - 通过 AppRegistry.runApplication 挂载到 DOM
 */
import { AppRegistry } from "react-native";
import Pages from "@/entry";
import { player } from "@/platform/web/modules/trackPlayer";
import trackPlayer from "@/core/trackPlayer";
import appConfig from "@/core/appConfig";

const appName = "Fly";

// 调试：暴露给自动化验证脚本使用
globalThis.__flyPlayer = player;
globalThis.__flyTrackPlayer = trackPlayer;
globalThis.__flyAppName = appName;
globalThis.__flyConfig = appConfig;

AppRegistry.registerComponent(appName, () => Pages);

AppRegistry.runApplication(appName, {
    rootTag: document.getElementById("root"),
});
