/**
 * 状态栏歌词工具 - Web/桌面端实现
 *
 * 桌面端没有系统状态栏歌词，全部降级为空实现。
 * 保持与原实现一致的导出结构，避免调用方修改。
 */

export enum NativeTextAlignment {
    LEFT = 3,
    RIGHT = 5,
    CENTER = 17,
}

const noop = async () => {};

const LyricUtil = {
    showStatusBarLyric: noop,
    hideStatusBarLyric: noop,
    setStatusBarLyricText: noop,
    setStatusBarLyricTop: noop,
    setStatusBarLyricLeft: noop,
    setStatusBarLyricWidth: noop,
    setStatusBarLyricFontSize: noop,
    setStatusBarLyricAlign: noop,
    setStatusBarColors: noop,
    checkSystemAlertPermission: async () => false,
    requestSystemAlertPermission: async () => false,
};

export default LyricUtil;
