/**
 * react-native-device-info 的 Web/Electron 实现
 */
import { host } from "../host";

const appVersion = host?.appVersion ?? "1.0.0";

const DeviceInfo = {
    getApplicationName: () => "Fly音乐",
    getBrand: () => "Fly",
    getBuildNumber: () => "1",
    getBundleId: () => "fun.upup.musicfree",
    getDeviceId: () => "fly-web",
    getModel: () => "Desktop",
    getSystemName: () => "Windows",
    getSystemVersion: () => "10",
    getVersion: () => appVersion,
    isTablet: () => Promise.resolve(false),
    getUniqueId: () => Promise.resolve("fly-web"),
    getTotalDiskCapacity: () => Promise.resolve(0),
    getFreeDiskStorage: () => Promise.resolve(0),
    getUsedMemory: () => Promise.resolve(0),
};

export default DeviceInfo;
export const deviceInfoModule = DeviceInfo;
