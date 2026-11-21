import { RequestStateCode } from "@/constants/commonConst";
import PluginManager from "@/core/pluginManager";
import { resetMediaItem } from "@/utils/mediaUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 一页 3 行；进来先放两页，往下滚触底再放行下一页 */
const ROWS_PER_PAGE = 3;
const INITIAL_PAGES = 2;
/** 首屏不足两页时最多自动补拉几次，避免插件返回空页时原地空转 */
const MAX_AUTO_FILL = 4;
/** 两次触底的最小间隔，避免一次手势连跳多页 */
const LOAD_MORE_INTERVAL = 400;

/**
 * 推荐歌单数据源。
 *
 * 插件一次往往返回几十上百条，整批塞进列表会在第一帧一次性铺开，既卡又亮。
 * 这里把「已拉到的数据」和「实际展示多少条」分开：缓存照常攒，窗口按页放行。
 */
export default function (
    pluginHash: string,
    tag: ICommon.IUnique,
    columns = 6,
) {
    const [allSheets, setAllSheets] = useState<IMusic.IMusicSheetItemBase[]>([]);
    const [visibleCount, setVisibleCount] = useState(0);
    const [requestState, setRequestState] = useState(RequestStateCode.IDLE);
    const currentTagRef = useRef<string>();
    const pageRef = useRef(0);
    /** 缓存条数 / 可见条数各留一份 ref：触底判断发生在回调里，读 state 会拿到旧值 */
    const totalRef = useRef(0);
    const visibleRef = useRef(0);
    const lastLoadAtRef = useRef(0);
    const autoFillRef = useRef(0);

    const pageCount = Math.max(columns, 1) * ROWS_PER_PAGE;
    const pageCountRef = useRef(pageCount);
    pageCountRef.current = pageCount;

    const applyVisible = useCallback((next: number) => {
        visibleRef.current = next;
        setVisibleCount(next);
    }, []);

    /**
     * 放行条数永远对齐整行：宁可少放几张留给下一次触底，
     * 也别在底部留一排半截卡片。对齐单位是「一行几张」而不是「一页几张」，
     * 否则数据量不是整页倍数时（插件一页 30 条、每页 18 张）会少放半页。
     */
    const fitRows = useCallback((want: number, total: number) => {
        if (want >= total) {
            return total;
        }
        const perRow = Math.max(pageCountRef.current / ROWS_PER_PAGE, 1);
        return Math.floor(want / perRow) * perRow;
    }, []);

    const query = useCallback(async () => {
        if (
            (requestState === RequestStateCode.FINISHED ||
                requestState === RequestStateCode.PENDING_FIRST_PAGE ||
                requestState === RequestStateCode.PENDING_REST_PAGE) &&
            currentTagRef.current === tag.id
        ) {
            return;
        }
        try {
            // 换了标签：缓存、窗口、游标一起归零
            const isFreshTag = currentTagRef.current !== tag.id;
            if (isFreshTag) {
                totalRef.current = 0;
                applyVisible(0);
                setAllSheets([]);
                pageRef.current = 0;
                autoFillRef.current = 0;
            }
            // 页码只在意请求成功后才推进，失败重试仍打同一页，不会漏数据
            const nextPage = pageRef.current + 1;
            currentTagRef.current = tag.id;
            const plugin = PluginManager.getByHash(pluginHash);
            if (!plugin) {
                setRequestState(RequestStateCode.FINISHED);
                setAllSheets([]);
                totalRef.current = 0;
                applyVisible(0);
                return;
            }
            setRequestState(
                nextPage === 1
                    ? RequestStateCode.PENDING_FIRST_PAGE
                    : RequestStateCode.PENDING_REST_PAGE,
            );
            const res = await plugin.methods?.getRecommendSheetsByTag?.(
                tag,
                nextPage,
            );
            if (!res) {
                setRequestState(RequestStateCode.FINISHED);
                return;
            }
            const data = (res.data ?? []).map(item =>
                resetMediaItem(item, plugin.instance.platform),
            );
            if (tag.id !== currentTagRef.current) {
                return;
            }
            pageRef.current = nextPage;
            setRequestState(
                res.isEnd
                    ? RequestStateCode.FINISHED
                    : RequestStateCode.PARTLY_DONE,
            );
            totalRef.current += data.length;
            setAllSheets(prev => [...prev, ...data]);
            // 放行量只跟「页」走，不跟插件一页给多少条走：
            // 插件可能一次给 30 条，但屏幕上仍然只该多出 3 行内容
            const initialTarget = pageCountRef.current * INITIAL_PAGES;
            applyVisible(
                fitRows(
                    visibleRef.current < initialTarget
                        ? initialTarget
                        : visibleRef.current + pageCountRef.current,
                    totalRef.current,
                ),
            );
        } catch {
            setRequestState(RequestStateCode.ERROR);
        }
    }, [tag, pluginHash, requestState, applyVisible, fitRows]);

    /** 首屏数据不够两页就一直补，直到够数、插件翻完或连续空页 */
    useEffect(() => {
        if (
            requestState === RequestStateCode.PARTLY_DONE &&
            totalRef.current > 0 &&
            visibleCount < pageCount * INITIAL_PAGES &&
            autoFillRef.current < MAX_AUTO_FILL
        ) {
            autoFillRef.current++;
            query();
        }
    }, [requestState, visibleCount, pageCount, query]);

    /** 触底：先放本地缓存，缓存见底才向插件要下一页 */
    const loadMore = useCallback(() => {
        if (visibleRef.current < totalRef.current) {
            // 本地放行是纯同步的，不节流：滚到底必须立刻有反应
            applyVisible(
                fitRows(
                    visibleRef.current + pageCountRef.current,
                    totalRef.current,
                ),
            );
            return;
        }
        if (
            requestState === RequestStateCode.FINISHED ||
            requestState === RequestStateCode.ERROR
        ) {
            return;
        }
        const now = Date.now();
        if (now - lastLoadAtRef.current < LOAD_MORE_INTERVAL) {
            return;
        }
        lastLoadAtRef.current = now;
        query();
    }, [query, requestState, applyVisible, fitRows]);

    useEffect(() => {
        query();
    }, [tag]);

    const sheets = useMemo(
        () => allSheets.slice(0, visibleCount),
        [allSheets, visibleCount],
    );

    /** 缓存里还有没放行的，或插件还没翻完，都算「还有更多」 */
    const hasMore =
        visibleCount < allSheets.length ||
        (requestState !== RequestStateCode.FINISHED &&
            requestState !== RequestStateCode.ERROR);

    return [query, sheets, requestState, loadMore, hasMore] as const;
}
