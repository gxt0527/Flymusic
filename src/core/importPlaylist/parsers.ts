/**
 * 导入歌单：链接识别 / 歌单解析。
 *
 * 这里只产出「文本曲目」(title / artist / album? / originId?)，不伪造任何可播放
 * 音源、不写死 platform / id；后续由 App 侧用插件歌源搜索补全。
 *
 * 注意：plugin.ts 把全局 axios.defaults.timeout 改成了 2000ms，本文件必须用独立
 * 实例（12s），既避免污染全局默认值，也避免被短超时截断。
 */
import axios from "axios";
import * as cheerio from "cheerio";
import he from "he";
import qs from "qs";
import strings from "./strings";
import type {
    IImportTrack,
    IParseResult,
    ImportPlatform,
    ParseProgress,
} from "./types";

/** 第三方响应都是动态结构，统一用宽松字典承载 */
type Dict = Record<string, any>;

interface Resp {
    /** 已解析的 JSON；不是 JSON 时为 null */
    json: any;
    /** 原始文本（对象时回填 JSON.stringify，便于正则兜底） */
    text: string;
    /** 跟随 302 之后的最终地址（短链解析用） */
    finalUrl?: string;
}

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 独立 axios 实例：不校验状态码，部分平台 4xx 也能带数据回来 */
const http = axios.create({
    timeout: 12000,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, text/html, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
});

/** 从整段分享文字里抓 URL（含无 scheme 的裸域名），遇中文/全角标点即止 */
const URL_PATTERN =
    "(?:https?:\\/\\/)?(?:[a-z0-9-]+\\.)+(?:com|cn|tv|net|me|cc|la|io)" +
    "(?::\\d+)?(?:[/?#][^\\s\"'<>\\u4e00-\\u9fff\\uff00-\\uffef]*)?";

/**
 * 需要手动跟随 302 才能拿到歌单 id 的短链。
 * QQ 音乐分享短链形如 https://c6.y.qq.com/base/fcgi-bin/u?__=xxxx
 * （c / c1 / c2 / c6 等数字后缀都可能），旧正则只认 c.y.qq.com，
 * 导致 id 提不到、解析直接失败。
 */
const SHORT_HOST_RE =
    /163cn\.tv|t1\.kugou\.com|url\.cn|kugou\.com\/s\/|(?:c\d*|i|c)\.y\.qq\.com\/base\//i;

/** 内嵌 JSON 的全局变量赋值形式 */
const ASSIGN_PATTERN =
    /(?:window\.)?(?:__INITIAL_STATE__|__NUXT__|__NUXT_DATA__|__SPECIAL_INFO__|__INITIAL_DATA__|__SSR_DATA__|__APOLLO_STATE__|dataFromSmarty|__PLAYLIST__|__SONG_LIST__|globalData)\s*=\s*/gi;

/** 曲目字段候选（按优先级，songname 优先于泛化的 name） */
const NAME_KEYS = [
    "songname",
    "songorig",
    "song_name",
    "songName",
    "name",
    "title",
];
const ARTIST_KEYS = [
    "singer",
    "singers",
    "singername",
    "singer_name",
    "singerName",
    "artist",
    "artists",
    "artistname",
    "artist_name",
    "artistName",
    "ar",
    "author",
];
const ALBUM_KEYS = ["albumname", "album_name", "albumName", "album"];
const ID_KEYS = ["songmid", "songid", "song_id", "id"];

function urlRe(): RegExp {
    return new RegExp(URL_PATTERN, "gi");
}

function toAbs(url: string): string {
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function resolveUrl(base: string, location: string): string {
    if (/^https?:\/\//i.test(location)) return location;
    const m = /^(https?:\/\/[^/]+)/i.exec(base);
    if (!m) return location;
    return location.charAt(0) === "/"
        ? `${m[1]}${location}`
        : `${m[1]}/${location}`;
}

/** 宽松抽取整段文字里的所有 URL */
function extractUrls(raw: string): string[] {
    if (!raw) return [];
    const re = urlRe();
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        if (!m[0]) {
            re.lastIndex++;
            continue;
        }
        out.push(m[0].replace(/[)\],.;!?，。；！？、]+$/g, ""));
    }
    return out.filter(Boolean);
}

/** 依次尝试多个正则，返回第一个捕获组 */
function pickGroup(hay: string, patterns: RegExp[]): string {
    for (const re of patterns) {
        re.lastIndex = 0;
        const m = re.exec(hay);
        if (m && m[1]) return m[1];
    }
    return "";
}

// ---------------------------------------------------------------------------
// 通用小工具
// ---------------------------------------------------------------------------

function firstString(obj: any, keys: string[]): string {
    if (!obj || typeof obj !== "object") return "";
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v;
        if (typeof v === "number" || typeof v === "boolean") return String(v);
    }
    return "";
}

function firstDefined(obj: any, keys: string[]): any {
    if (!obj || typeof obj !== "object") return undefined;
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
}

/** 取 al / album 这类对象里的 name */
function firstNestedName(obj: any, keys: string[]): string {
    if (!obj || typeof obj !== "object") return "";
    for (const k of keys) {
        const v = obj[k];
        if (v && typeof v === "object") {
            const n = firstString(v, ["name", "title", "albumname", "albumName"]);
            if (n) return n;
        }
    }
    return "";
}

/** singer 可能是字符串 / 字符串数组 / [{name}] / {name} */
function flattenArtist(v: any): string {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.map(flattenArtist).filter(Boolean).join("/");
    if (typeof v === "object") {
        return flattenArtist(
            firstDefined(v, [
                "name",
                "title",
                "singerName",
                "singername",
                "artistName",
                "author",
            ]),
        );
    }
    return "";
}

/** 去 HTML 实体 / 标签 / 多余空白 */
function normalize(value: unknown): string {
    let s = typeof value === "string" ? value : value == null ? "" : String(value);
    if (!s) return "";
    try {
        s = he.decode(s);
        s = he.decode(s); // 兼容 &amp;lt; 这类双重编码
    } catch {
        /* he 不可用/异常时保留原值 */
    }
    s = s.replace(/<[^>]*>/g, "");
    s = s.replace(/&nbsp;|&#160;/gi, " ");
    s = s.replace(/[\u00a0\u3000]/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    return s;
}

function cleanSheetTitle(raw: string): string {
    let s = normalize(raw);
    if (!s) return "";
    s = s.replace(/^【[^】]*】/, "").trim();
    s = s
        .replace(
            /[-–—_|]\s*(?:QQ音乐|网易云音乐|酷狗音乐|酷我音乐|虾米音乐)(?:\s*官网)?\s*$/gi,
            "",
        )
        .trim();
    s = s.replace(/\s*[（(]\s*来自[^）)]*[）)]\s*$/g, "").trim();
    return s;
}

/**
 * 从「分享歌单: 不是山谷里的风啊喜欢的音乐 不是山谷里的风啊 https://...」
 * 这类分享文案里提取歌单名，作为接口拿不到名称时的兜底。
 * 网易云「XX喜欢的音乐」后面常跟创建者昵称，昵称往往是歌单名的前缀，
 * 这时取更长的那段。
 */
function sheetTitleFromShareText(raw: string): string {
    if (!raw) return "";
    const text = raw.replace(urlRe(), " ").replace(/\s+/g, " ").trim();
    const m = /(?:分享|推荐)\s*(?:歌单)?\s*[:：]?\s*(.+)$/i.exec(text);
    if (!m) return "";
    const parts = m[1].trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    let best = parts[0];
    for (const p of parts.slice(1)) {
        if (p.length > best.length && p.startsWith(parts[0])) {
            best = p;
        }
    }
    return cleanSheetTitle(best);
}

/** 把任意对象映射成文本曲目（用于结构化的 API 响应） */
function trackFromObject(t: any): IImportTrack | null {
    if (!t || typeof t !== "object") return null;
    const title = firstString(t, NAME_KEYS);
    if (!title || /^https?:\/\//i.test(title)) return null;
    const artist = flattenArtist(firstDefined(t, ARTIST_KEYS));
    const item: IImportTrack = { title, artist };
    const album =
        firstNestedName(t, ["al", "album"]) || firstString(t, ALBUM_KEYS);
    if (album) item.album = album;
    const originId = firstString(t, ID_KEYS);
    if (originId) item.originId = originId;
    return item;
}

function mapTracks(arr: any[]): IImportTrack[] {
    const out: IImportTrack[] = [];
    for (const t of arr) {
        const item = trackFromObject(t);
        if (item) out.push(item);
    }
    return out;
}

/**
 * 网易云歌单详情的响应容器在不同版本里结构不一致：
 *   /api/playlist/detail    -> { result: {...} }（已废弃，现返回 code 20001）
 *   /api/v6/playlist/detail -> { playlist: {...} }
 *   /api/v3/playlist/detail -> { playlist: {...} }
 * 之前只认 result，导致 v6/v3 明明返回 200 + 完整数据却解析出 0 首，
 * 最后退化成 HTML 兜底把「歌单名 + 昵称」当成 1 首歌。
 */
function pickPlaylistContainer(json: any): Dict | null {
    if (!json || typeof json !== "object") return null;
    const root = json as Dict;
    const candidates: any[] = [
        root.playlist,
        root.result,
        root.data?.playlist,
        root.data?.result,
        root.data,
        root,
    ];
    for (const c of candidates) {
        if (!c || typeof c !== "object") continue;
        if (
            firstString(c, ["name", "title", "dissname", "specialname"]) ||
            Array.isArray(c.tracks) ||
            Array.isArray(c.trackIds)
        ) {
            return c as Dict;
        }
    }
    return null;
}

/** 取 trackIds 里的数字 id（可能是 number 或 {id} 对象） */
function readTrackIds(value: any): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map(x => String(x && typeof x === "object" ? x.id ?? "" : x ?? ""))
        .filter(s => /^\d+$/.test(s));
}

/** 递归遍历内嵌 JSON，按 name/artist 字段组合抓曲目（通用 HTML 兜底） */
function walkForTracks(node: any, out: IImportTrack[], depth = 0): void {
    if (node == null || depth > 10) return;
    if (Array.isArray(node)) {
        for (const item of node) walkForTracks(item, out, depth + 1);
        return;
    }
    if (typeof node !== "object") return;

    // 页面内嵌 JSON 里的「歌单对象」带 trackIds / trackCount / creator，
    // 并不是歌曲；若按 name + 创建者昵称组合，会误产出 1 首假曲目。
    const isSheetLike =
        Array.isArray(node.trackIds) ||
        typeof node.trackCount === "number" ||
        typeof node.songCount === "number" ||
        (node.creator && typeof node.creator === "object") ||
        (node.playlist && typeof node.playlist === "object");
    const hasSongMarker = [
        "songname",
        "songorig",
        "song_name",
        "songName",
        "filename",
        "fileName",
        "songmid",
        "songid",
        "song_id",
    ].some(k => node[k] !== undefined);
    if (isSheetLike && !hasSongMarker) {
        // 只递归子节点，不把歌单元数据本身当曲目
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (v && typeof v === "object") walkForTracks(v, out, depth + 1);
        }
        return;
    }

    // 酷狗 filename："歌手 - 歌名"
    const filename = firstString(node, ["filename", "fileName"]);
    if (filename) {
        const parts = splitDash(filename);
        if (parts) out.push({ title: parts.right, artist: parts.left });
    }

    const title = firstString(node, NAME_KEYS);
    const artist = flattenArtist(firstDefined(node, ARTIST_KEYS));
    if (title && artist && title !== artist && title.length <= 120 && !/^https?:\/\//i.test(title)) {
        const item: IImportTrack = { title, artist };
        const album =
            firstNestedName(node, ["al", "album"]) || firstString(node, ALBUM_KEYS);
        if (album) item.album = album;
        const originId = firstString(node, ID_KEYS);
        if (originId) item.originId = originId;
        out.push(item);
    }

    for (const k of Object.keys(node)) {
        const v = node[k];
        if (v && typeof v === "object") walkForTracks(v, out, depth + 1);
    }
}

/** 递归找歌单名（只认平台专用键，避免泛化 name 误命中） */
function findSheetName(node: any, depth = 0): string {
    if (!node || typeof node !== "object" || depth > 8) return "";
    if (Array.isArray(node)) {
        for (const it of node) {
            const n = findSheetName(it, depth + 1);
            if (n) return n;
        }
        return "";
    }
    const v = firstString(node, [
        "dissname",
        "diss_name",
        "specialName",
        "specialname",
        "playlistName",
        "playlistname",
        "sheetName",
    ]);
    if (v) return cleanSheetTitle(v);
    for (const k of Object.keys(node)) {
        const n = findSheetName((node as Dict)[k], depth + 1);
        if (n) return n;
    }
    return "";
}

/** 按 " - " 切一次；filename 里左边是歌手、右边是歌名 */
function splitDash(s: string): { left: string; right: string } | null {
    const m = /\s*[-–—~～]\s*/.exec(s);
    if (!m) return null;
    const left = s.slice(0, m.index).trim();
    const right = s.slice(m.index + m[0].length).trim();
    return left && right ? { left, right } : null;
}

function decodeJsonString(raw: string): string {
    try {
        return JSON.parse(`"${raw}"`);
    } catch {
        return raw;
    }
}

/** 从 from 起找第一个 { 或 [，做带字符串感知的括号配平，取出完整 JSON 文本 */
function grabJson(text: string, from: number): string | null {
    let start = -1;
    const searchEnd = Math.min(text.length, from + 500);
    for (let i = from; i < searchEnd; i++) {
        const ch = text.charAt(i);
        if (ch === "{" || ch === "[") {
            start = i;
            break;
        }
    }
    if (start < 0) return null;

    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    const scanEnd = Math.min(text.length, start + 400000);
    for (let i = start; i < scanEnd; i++) {
        const ch = text.charAt(i);
        if (inStr) {
            if (esc) {
                esc = false;
                continue;
            }
            if (ch === "\\") {
                esc = true;
                continue;
            }
            if (ch === "\"") inStr = false;
            continue;
        }
        if (ch === "\"") {
            inStr = true;
        } else if (ch === "{" || ch === "[") {
            stack.push(ch === "{" ? "}" : "]");
        } else if (ch === "}" || ch === "]") {
            const top = stack.pop();
            if (top !== ch) return null;
            if (stack.length === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

function matchValues(text: string, re: RegExp): string[] {
    const out: string[] = [];
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        out.push(m[1] || "");
        if (!m[0]) r.lastIndex++;
    }
    return out;
}

function extractJsonAssignments(s: string): any[] {
    const out: any[] = [];
    const re = new RegExp(ASSIGN_PATTERN.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
        const raw = grabJson(s, m.index + m[0].length);
        if (raw) {
            try {
                out.push(JSON.parse(raw));
            } catch {
                /* 不是合法 JSON，跳过 */
            }
        }
        if (!m[0]) re.lastIndex++;
    }
    return out;
}

/** 收集页面里的 <script> / JSON-LD / 全局变量内嵌 JSON */
function extractEmbeddedJson(text: string): any[] {
    const out: any[] = [];
    try {
        const $ = cheerio.load(text);
        $("script").each((_i, el) => {
            const content = ($(el).html() || "").trim();
            if (!content) return;
            const type = ($(el).attr("type") || "").toLowerCase();
            if (type.indexOf("json") >= 0) {
                try {
                    out.push(JSON.parse(content));
                } catch {
                    /* 忽略 */
                }
            } else {
                out.push(...extractJsonAssignments(content));
            }
        });
    } catch {
        /* cheerio 解析失败不影响其他路径 */
    }
    out.push(...extractJsonAssignments(text));
    return out;
}

/** 通用 HTML 解析：歌单名 + 多种曲目提取方式叠加 */
function collectFromHtml(text: string): {
    sheetTitle: string;
    tracks: IImportTrack[];
} {
    const tracks: IImportTrack[] = [];
    const titlePatterns: RegExp[] = [
        /var\s+specialName\s*=\s*"((?:\\.|[^"\\])*)"/i,
        /"specialName"\s*:\s*"((?:\\.|[^"\\])*)"/i,
        /"specialname"\s*:\s*"((?:\\.|[^"\\])*)"/i,
        /<meta[^>]+(?:property|name)\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i,
        /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]*(?:property|name)\s*=\s*["']og:title["']/i,
        /<title[^>]*>([\s\S]*?)<\/title>/i,
        /"dissname"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    ];
    let sheetTitle = "";
    for (const re of titlePatterns) {
        const m = re.exec(text);
        if (m && m[1]) {
            const s = cleanSheetTitle(normalize(decodeJsonString(m[1])));
            if (s) {
                sheetTitle = s;
                break;
            }
        }
    }

    for (const obj of extractEmbeddedJson(text)) {
        walkForTracks(obj, tracks, 0);
        if (!sheetTitle) sheetTitle = findSheetName(obj);
    }

    // 成对的 "songname":"..." 与 "singername":"..."
    const songVals = matchValues(
        text,
        /"songname"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
    );
    const singerVals = matchValues(
        text,
        /"singername"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
    );
    const pairs = Math.min(songVals.length, singerVals.length);
    for (let i = 0; i < pairs; i++) {
        const title = decodeJsonString(songVals[i]);
        const artist = decodeJsonString(singerVals[i]);
        if (title) tracks.push({ title, artist });
    }

    // "filename":"歌手 - 歌名"
    for (const raw of matchValues(
        text,
        /"filename"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
    )) {
        const parts = splitDash(decodeJsonString(raw));
        if (parts) tracks.push({ title: parts.right, artist: parts.left });
    }

    // 通用兜底：name/songname/title 与 singer/artist/author 字段组合。
    // 键必须带引号，避免把 "filename" 里的 name 误当成字段。
    const genericRes: RegExp[] = [
        /"(?:songname|name|title|song_name|songName)"\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]{0,300}?"(?:singer|artist|singername|author|singer_name|artist_name)"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
        /"(?:singer|artist|singername|author|singer_name|artist_name)"\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]{0,300}?"(?:songname|name|title|song_name|songName)"\s*:\s*"((?:\\.|[^"\\])*)"/gi,
    ];
    for (const re of genericRes) {
        const r = new RegExp(re.source, re.flags);
        let m: RegExpExecArray | null;
        let count = 0;
        while ((m = r.exec(text)) !== null && count < 400) {
            const a = decodeJsonString(m[1] || "");
            const b = decodeJsonString(m[2] || "");
            // 第一个正则 title 在前，第二个 artist 在前
            const isForward = genericRes.indexOf(re) === 0;
            const title = isForward ? a : b;
            const artist = isForward ? b : a;
            if (title && artist && title !== artist) {
                tracks.push({ title, artist });
                count++;
            }
            if (!m[0]) r.lastIndex++;
        }
    }

    return { sheetTitle, tracks };
}

/** 清洗 / 去重 / 截断 */
function cleanTracks(tracks: IImportTrack[], limit = 1000): IImportTrack[] {
    const seen = new Set<string>();
    const out: IImportTrack[] = [];
    for (const raw of tracks) {
        if (!raw) continue;
        const title = normalize(raw.title);
        const artist = normalize(raw.artist || "");
        if (!title || /^(?:https?:\/\/|www\.)/i.test(title)) continue; // 过滤空标题 / URL
        const key = `${title.toLowerCase()}\u0000${artist.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const item: IImportTrack = { title, artist };
        const album = normalize(raw.album || "");
        if (album) item.album = album;
        if (raw.originId) item.originId = String(raw.originId);
        out.push(item);
        if (out.length >= limit) break;
    }
    return out;
}

function cleanResult(result: IParseResult): IParseResult {
    const tracks = cleanTracks(result.tracks);
    const declaredTotal = result.declaredTotal ?? 0;
    // 清洗去重后数量可能变少，提示里的「拿到 N 首」要按最终曲目数重算；
    // 只有原本就标了「部分解析」的结果才需要这段提示
    const notice =
        result.notice && declaredTotal
            ? declaredTotal > tracks.length
                ? strings.qqPartial(tracks.length, declaredTotal)
                : undefined
            : result.notice;
    return {
        platform: result.platform,
        sheetTitle: cleanSheetTitle(result.sheetTitle) || strings.namePlaceholder,
        tracks,
        ...(declaredTotal ? { declaredTotal } : {}),
        ...(notice ? { notice } : {}),
    };
}

// ---------------------------------------------------------------------------
// 网络层：所有请求都吞掉异常，单条路径失败不影响整体
// ---------------------------------------------------------------------------

interface HostResp {
    ok: boolean;
    status?: number;
    text?: string;
    headers?: Dict;
    /** 主进程跟随重定向后的最终地址 */
    finalUrl?: string;
    error?: string;
}

/**
 * 桌面端优先走 Electron 主进程发请求：能带上完整的 Referer / Cookie / UA，
 * 也不受 CORS 限制（网易云带上 os=pc Cookie 时会直接返回全量曲目）。
 * 没有 flyHost（RN 原生 / 普通浏览器）时返回 null，由 request / postForm
 * 自动回落到 axios 直连。
 */
async function hostRequest(options: {
    url: string;
    method?: "GET" | "POST";
    headers?: Dict;
    body?: string;
    timeout?: number;
}): Promise<Resp | null> {
    const host = (globalThis as any)?.flyHost;
    if (!host || typeof host.invoke !== "function") {
        return null;
    }
    try {
        const r: HostResp = await host.invoke("net:request", options);
        if (!r || !r.ok || typeof r.text !== "string" || !r.text) {
            return null;
        }
        let json: any = null;
        try {
            json = JSON.parse(r.text);
        } catch {
            /* HTML / 纯文本 */
        }
        return {
            json,
            text: r.text,
            ...(r.finalUrl ? { finalUrl: r.finalUrl } : {}),
        };
    } catch {
        return null;
    }
}

async function request(
    url: string,
    headers: Dict = {},
): Promise<Resp | null> {
    const viaHost = await hostRequest({
        url,
        method: "GET",
        headers: { "User-Agent": UA, ...headers },
        timeout: 12000,
    });
    if (viaHost) {
        return viaHost;
    }
    try {
        const resp = await http.get(url, {
            headers: { "User-Agent": UA, ...headers },
        });
        const data = resp.data;
        // 浏览器 XHR 会自动跟随 302，responseURL 是唯一的最终地址来源
        const finalUrl = (resp.request as any)?.responseURL as
            | string
            | undefined;
        const extra = finalUrl ? { finalUrl } : {};
        if (typeof data === "string") {
            let json: any = null;
            try {
                json = JSON.parse(data);
            } catch {
                /* HTML / 纯文本 */
            }
            return { json, text: data, ...extra };
        }
        if (data && typeof data === "object") {
            let text = "";
            try {
                text = JSON.stringify(data);
            } catch {
                /* 忽略循环引用 */
            }
            return { json: data, text, ...extra };
        }
        return { json: null, text: "", ...extra };
    } catch {
        return null;
    }
}

async function postForm(
    url: string,
    body: string,
    headers: Dict = {},
): Promise<Resp | null> {
    const allHeaders = {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        ...headers,
    };
    const viaHost = await hostRequest({
        url,
        method: "POST",
        headers: allHeaders,
        body,
        timeout: 12000,
    });
    if (viaHost) {
        return viaHost;
    }
    try {
        const resp = await http.post(url, body, {
            headers: allHeaders,
        });
        const data = resp.data;
        if (typeof data === "string") {
            let json: any = null;
            try {
                json = JSON.parse(data);
            } catch {
                /* HTML / 纯文本 */
            }
            return { json, text: data };
        }
        if (data && typeof data === "object") {
            return { json: data, text: JSON.stringify(data) };
        }
        return { json: null, text: "" };
    } catch {
        return null;
    }
}

/** 兼容 JSONP（callback({...})）与直接 JSON */
function jsonFromResp(resp: Resp | null): any {
    if (!resp) return null;
    if (resp.json !== null && resp.json !== undefined) return resp.json;
    if (!resp.text) return null;
    const start = resp.text.search(/[\[{]/);
    if (start >= 0) {
        const raw = grabJson(resp.text, start);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch {
                /* 忽略 */
            }
        }
    }
    return null;
}

/** 记录是否至少有一次请求拿到了响应，用于区分「网络失败」与「链接有效但没歌」 */
class Probe {
    ok = 0;

    async get(url: string, headers: Dict = {}): Promise<Resp | null> {
        const r = await request(url, headers);
        if (r && (r.json !== null || r.text.length > 0)) this.ok++;
        return r;
    }

    async post(
        url: string,
        body: string,
        headers: Dict = {},
    ): Promise<Resp | null> {
        const r = await postForm(url, body, headers);
        if (r && (r.json !== null || r.text.length > 0)) this.ok++;
        return r;
    }
}

/**
 * 短链跟随：拿到 302 之后的真实歌单地址。
 *
 * 三条路径按可用性依次尝试：
 *  1. Electron 主进程 net:request（跟随重定向后回传 finalUrl，不受 CORS 限制）
 *  2. axios 直连读 302 的 Location（RN 原生 / Node）
 *  3. 浏览器 XHR 自动跟随后读 responseURL
 */
async function resolveShortLinks(urls: string[]): Promise<string> {
    const resolved: string[] = [];
    for (const u of urls.slice(0, 4)) {
        let current = toAbs(u);
        for (let hop = 0; hop < 3; hop++) {
            if (!SHORT_HOST_RE.test(current)) break;
            let next = "";

            const viaHost = await request(current, { "User-Agent": UA }).catch(
                () => null,
            );
            if (viaHost?.finalUrl && viaHost.finalUrl !== current) {
                next = viaHost.finalUrl;
            }

            if (!next) {
                try {
                    const resp = await http.get(current, {
                        maxRedirects: 0,
                        validateStatus: () => true,
                        headers: { "User-Agent": UA },
                    });
                    const loc = (resp.headers?.location ||
                        resp.headers?.Location ||
                        "") as string;
                    const finalUrl = (resp.request as any)?.responseURL as
                        | string
                        | undefined;
                    next = loc ? resolveUrl(current, loc) : finalUrl || "";
                } catch {
                    /* 短链解析失败不影响后续 */
                }
            }
            if (!next || next === current) break;
            current = next;
        }
        resolved.push(current);
    }
    return resolved.join("\n");
}

// ---------------------------------------------------------------------------
// 平台识别 / id 提取
// ---------------------------------------------------------------------------

/** 识别链接所属平台；无法识别时返回 "text" */
export function detectPlatform(raw: string): Exclude<ImportPlatform, "auto"> {
    const text = typeof raw === "string" ? raw : "";
    const urls = extractUrls(text);
    const hay = `${urls.join("\n")}\n${text}`;
    if (/music\.163\.com|163cn\.tv/i.test(hay)) return "netease";
    if (/y\.qq\.com|disstid\s*=/i.test(hay)) return "qq";
    if (/kugou\.com/i.test(hay)) return "kugou";
    return "text";
}

/** 平台中文名 */
export function platformName(platform: ImportPlatform): string {
    switch (platform) {
    case "auto":
        return strings.auto;
    case "qq":
        return strings.qq;
    case "netease":
        return strings.netease;
    case "kugou":
        return strings.kugou;
    case "text":
        return strings.text;
    default:
        return strings.title;
    }
}

function extractPlaylistId(
    raw: string,
    platform: Exclude<ImportPlatform, "auto">,
): string {
    const urls = extractUrls(raw);
    const hay = `${urls.join("\n")}\n${raw}`;
    switch (platform) {
    case "netease":
        return pickGroup(hay, [
            /[?&#/]id=(\d{2,})/i,
            /\bid=(\d{2,})/i,
            /playlist\/(\d{2,})/i,
            /(?:playlist|special|album|discover|toplist)\/(\d{2,})/i,
            /\/(\d{5,})(?:\.html)?/i,
        ]);
    case "qq":
        return pickGroup(hay, [
            /disstid=([A-Za-z0-9_-]+)/i,
            /[?&]id=([A-Za-z0-9_-]+)/i,
            /playlist\/([A-Za-z0-9_-]+)/i,
            /(?:taoge|playlist)\/([A-Za-z0-9_-]+)/i,
        ]);
    case "kugou":
        return pickGroup(hay, [
            /specialid=([A-Za-z0-9_-]+)/i,
            /special\/single\/([A-Za-z0-9_-]+)/i,
            /songlist\/([A-Za-z0-9_-]+)/i,
            /[?&]id=([A-Za-z0-9_-]+)/i,
            /\/([A-Za-z0-9_-]{3,})\.html/i,
        ]);
    case "text":
    default:
        return "";
    }
}

// ---------------------------------------------------------------------------
// 文本列表解析
// ---------------------------------------------------------------------------

const INDEX_RE =
    /^\s*(?:\d{1,3}\s*[\.、\)．:：]|[（(]\s*\d{1,3}\s*[)）]|\[\s*\d{1,3}\s*\])\s*/;

function hasSeparator(s: string): boolean {
    return s.indexOf("\t") >= 0 || /\s*[-–—~～]\s*/.test(s);
}

function stripIndexPrefix(line: string): string {
    let s = line.replace(INDEX_RE, "").trim();
    if (s === line) {
        // "1 歌名 - 歌手"：仅当剥掉后仍含分隔符时才认为是序号
        const bare = line.replace(/^\s*\d{1,3}\s+/, "").trim();
        if (bare !== line && hasSeparator(bare)) s = bare;
    }
    return s || line;
}

/** 把一行拆成 { title, artist }；支持制表符 / 各种短横线 / 单词个连字符 */
function splitTitleArtist(line: string): IImportTrack | null {
    const text = line.trim();
    if (!text) return null;

    if (text.indexOf("\t") >= 0) {
        let parts = text
            .split(/\t+/)
            .map((p) => p.trim())
            .filter(Boolean);
        if (parts.length > 2 && /^\d{1,3}$/.test(parts[0])) parts = parts.slice(1);
        if (parts.length >= 2) {
            const item: IImportTrack = { title: parts[0], artist: parts[1] };
            if (parts.length > 2) item.album = parts.slice(2).join(" ");
            return item;
        }
    }

    const dashSeps: RegExp[] = [
        /\s+[-–—~～]{1,2}\s+/,
        /\s+[-–—~～]{1,2}\s*/,
        /\s*[-–—~～]{1,2}\s+/,
    ];
    for (const re of dashSeps) {
        const m = re.exec(text);
        if (!m) continue;
        const title = text.slice(0, m.index).trim();
        const artist = text.slice(m.index + m[0].length).trim();
        if (title && artist) return { title, artist };
    }

    // 无空格且全行只有一个连字符：歌名-歌手
    const hyphens = text.match(/-/g);
    if (hyphens && hyphens.length === 1) {
        const idx = text.indexOf("-");
        const title = text.slice(0, idx).trim();
        const artist = text.slice(idx + 1).trim();
        if (title && artist) return { title, artist };
    }

    // 没有分隔符：整行当歌名，歌手留空（后续按歌名搜索）
    return { title: text, artist: "" };
}

/** 把「歌名 - 歌手」多行文本解析成曲目 */
export function parseTextList(raw: string): IParseResult {
    const text = typeof raw === "string" ? raw : "";
    const lines = text.split(/\r?\n/);
    let sheetTitle = "";
    let firstLine = true;
    const tracks: IImportTrack[] = [];

    for (let line of lines) {
        line = line.replace(urlRe(), "").trim(); // 去掉行内链接，避免 URL 变成曲目
        if (!line) continue;
        if (!/[a-zA-Z0-9\u4e00-\u9fff]/.test(line)) continue; // 纯符号行

        const isFirst = firstLine;
        firstLine = false;

        // 首行 "# 歌单名"
        if (isFirst && /^#{1,6}\s*(?!\d)/.test(line)) {
            sheetTitle = cleanSheetTitle(line.replace(/^#{1,6}\s*/, ""));
            continue;
        }

        const stripped = stripIndexPrefix(line);
        const item = splitTitleArtist(stripped) || splitTitleArtist(line);
        if (item) tracks.push(item);
    }

    return cleanResult({
        platform: "text",
        sheetTitle: sheetTitle || strings.namePlaceholder,
        tracks,
    });
}

// ---------------------------------------------------------------------------
// 各平台取数（每个平台至少两条路径，主路径失败自动 fallback）
// ---------------------------------------------------------------------------

async function fetchNetease(
    id: string,
    urls: string[],
    onBatch?: (done: number, total: number) => void,
): Promise<IParseResult> {
    const probe = new Probe();
    const headers: Dict = {
        Referer: "https://music.163.com/",
        "User-Agent": UA,
        Cookie: "os=pc; appver=2.0.2; channel=netease;",
        Accept: "application/json, text/plain, */*",
    };
    let sheetTitle = "";
    let detailSongs: any[] = [];
    let tracks: IImportTrack[] = [];
    let trackIds: string[] = [];
    let trackCount = 0;

    // 经典 /api/playlist/detail 已被风控下线（返回 code 20001），
    // v6 / v3 才是当前可用接口，必须放在前面，并且要按 {playlist:{...}} 解析。
    const apis = [
        `https://music.163.com/api/v6/playlist/detail?id=${encodeURIComponent(id)}&n=1000`,
        `https://music.163.com/api/v3/playlist/detail?id=${encodeURIComponent(id)}&n=1000`,
        `https://music.163.com/api/playlist/detail?id=${encodeURIComponent(id)}&limit=1000&offset=0`,
    ];
    for (const api of apis) {
        const resp = await probe.get(api, headers);
        const container = pickPlaylistContainer(jsonFromResp(resp));
        if (!container) continue;
        if (!sheetTitle) {
            sheetTitle = cleanSheetTitle(
                firstString(container, ["name", "title"]),
            );
        }
        const list = Array.isArray(container.tracks)
            ? (container.tracks as any[])
            : [];
        if (list.length) {
            const mapped = mapTracks(list);
            if (mapped.length) {
                detailSongs = list;
                tracks = mapped;
            }
        }
        const ids = readTrackIds(container.trackIds);
        if (ids.length > trackIds.length) trackIds = ids;
        const count = Number(
            firstString(container, [
                "trackCount",
                "track_count",
                "songCount",
            ]) || 0,
        );
        if (count > trackCount) trackCount = count;
        // 已经拿到全量曲目就不必再打后面的接口
        if (
            tracks.length &&
            (!trackIds.length || tracks.length >= trackIds.length)
        ) {
            break;
        }
    }

    // 现在的 v6 只返回前几首完整曲目，其余全部藏在 trackIds 里
    // （本次反馈的歌单：6 首完整 + 354 个 trackIds），必须按 100 分批补全，
    // 再按 trackIds 顺序还原，否则歌单顺序会乱、歌曲也会缺一大半。
    const total = Math.min(Math.max(trackIds.length, trackCount), 1000);
    if (trackIds.length && detailSongs.length < total) {
        const byId = new Map<string, IImportTrack>();
        for (const s of detailSongs) {
            if (!s || typeof s !== "object") continue;
            const sid = String(s.id ?? "");
            const item = trackFromObject(s);
            if (sid && item) byId.set(sid, item);
        }
        const ids = trackIds.slice(0, total);
        for (let i = 0; i < ids.length && byId.size < total; i += 100) {
            const batch = ids.slice(i, i + 100);
            let songs: any[] = [];
            // 优先 v3（带 ar 歌手信息），失败再退老接口
            const v3 = await probe.post(
                "https://music.163.com/api/v3/song/detail",
                `c=${encodeURIComponent(
                    JSON.stringify(batch.map(n => ({ id: Number(n) }))),
                )}`,
                headers,
            );
            const v3json = jsonFromResp(v3) as Dict | null;
            if (v3json && Array.isArray(v3json.songs)) songs = v3json.songs;
            if (!songs.length) {
                const legacy = await probe.get(
                    `https://music.163.com/api/song/detail?ids=${encodeURIComponent(
                        JSON.stringify(batch.map(Number)),
                    )}`,
                    headers,
                );
                const ljson = jsonFromResp(legacy) as Dict | null;
                if (ljson && Array.isArray(ljson.songs)) songs = ljson.songs;
            }
            for (const s of songs) {
                if (!s || typeof s !== "object") continue;
                const sid = String(s.id ?? "");
                const item = trackFromObject(s);
                if (sid && item && !byId.has(sid)) byId.set(sid, item);
            }
            onBatch?.(Math.min(i + 100, ids.length), ids.length);
        }
        const ordered: IImportTrack[] = [];
        for (const sid of ids) {
            const item = byId.get(sid);
            if (item) ordered.push(item);
        }
        if (ordered.length > tracks.length) tracks = ordered;
    }

    // 路径 5：页面 HTML 兜底
    if (!tracks.length) {
        const pages = [
            `https://music.163.com/playlist?id=${encodeURIComponent(id)}`,
            ...urls.slice(0, 2).map(toAbs),
        ];
        for (const p of pages) {
            if (!p) continue;
            const resp = await probe.get(toAbs(p), headers);
            if (!resp) continue;
            const parsed = collectFromHtml(resp.text);
            if (!sheetTitle) sheetTitle = parsed.sheetTitle;
            if (parsed.tracks.length > 1) {
                tracks = parsed.tracks;
                break;
            }
        }
    }

    if (!probe.ok) throw new Error(strings.parseFail);
    return {
        platform: "netease",
        sheetTitle: sheetTitle || strings.namePlaceholder,
        tracks,
    };
}

/**
 * QQ 页面的 window.__INITIAL_DATA__ 是 JS 对象字面量（含 :undefined），
 * 不是合法 JSON，直接 JSON.parse 会失败。
 */
function parseLooseJson(raw: string): any {
    const candidates = [
        raw,
        raw
            .replace(/:\s*undefined\b/g, ":null")
            .replace(/,\s*undefined\b/g, ",null"),
    ];
    for (const c of candidates) {
        try {
            return JSON.parse(c);
        } catch {
            /* 继续尝试宽松版本 */
        }
    }
    return null;
}

/**
 * QQ 音乐歌单页（taoge.html / ryqq playlist）的 SSR 数据。
 *
 * 「我喜欢的音乐」这类未登录私有歌单，fcg 接口直接返回
 * {"code":0,"subcode":4000,"msg":"check privacy error!"}，
 * 但页面里仍带 window.__INITIAL_DATA__：detail.title 是歌单名、
 * songList 是前 10 首、totalNum 是总曲目数。
 */
function parseQQPage(text: string): {
    tracks: IImportTrack[];
    sheetTitle: string;
    totalNum: number;
} {
    let tracks: IImportTrack[] = [];
    let sheetTitle = "";
    let totalNum = 0;

    const marker = "window.__INITIAL_DATA__";
    const idx = text.indexOf(marker);
    if (idx >= 0) {
        const raw = grabJson(text, idx + marker.length);
        const json = raw ? parseLooseJson(raw) : null;
        if (json && typeof json === "object") {
            const detail =
                json.detail && typeof json.detail === "object"
                    ? (json.detail as Dict)
                    : {};
            sheetTitle = cleanSheetTitle(
                firstString(detail, [
                    "title",
                    "origin_title",
                    "dissname",
                    "name",
                ]),
            );
            totalNum =
                Number(json.totalNum ?? detail.songnum ?? 0) || 0;
            const list = Array.isArray(json.songList)
                ? json.songList
                : Array.isArray(detail.songlist)
                    ? detail.songlist
                    : Array.isArray(json.songs)
                        ? json.songs
                        : [];
            tracks = mapTracks(list);
        }
    }

    if (!sheetTitle) {
        const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(text);
        if (h2) sheetTitle = cleanSheetTitle(normalize(h2[1]));
    }
    if (!sheetTitle) {
        const title = /<title>([\s\S]*?)<\/title>/i.exec(text);
        if (title) sheetTitle = cleanSheetTitle(normalize(title[1]));
    }

    // __INITIAL_DATA__ 结构变化时，还能从 SSR 的 <li class="songlist__item"> 读曲目
    if (!tracks.length && /songlist__songname_txt/.test(text)) {
        try {
            const $ = cheerio.load(text);
            $("ul.songlist__list > li").each((_i, el) => {
                const nameEl = $(el)
                    .find(".songlist__songname_txt a")
                    .first();
                const songTitle = normalize(
                    nameEl.attr("title") || nameEl.text(),
                );
                if (!songTitle) return;
                const artist = normalize(
                    $(el).find(".songlist__artist").first().text(),
                );
                const albumEl = $(el).find(".songlist__album a").first();
                const album = normalize(
                    albumEl.attr("title") || albumEl.text(),
                );
                const item: IImportTrack = { title: songTitle, artist };
                if (album) item.album = album;
                tracks.push(item);
            });
        } catch {
            /* cheerio 解析失败不影响其它路径 */
        }
    }

    return { tracks, sheetTitle, totalNum };
}

async function fetchQQ(id: string, urls: string[]): Promise<IParseResult> {
    const probe = new Probe();
    const headers: Dict = {
        Referer: "https://y.qq.com/",
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
    };
    let sheetTitle = "";
    let tracks: IImportTrack[] = [];
    let declaredTotal = 0;
    /** 是否退到了只公开前 N 首的歌单页（用于决定是否提示用户） */
    let partialFromPage = false;

    const baseQuery: Dict = {
        type: 1,
        json: 1,
        utf8: 1,
        onlysong: 0,
        disstid: id,
        g_tk: 0,
        loginUin: 0,
        hostUin: 0,
        inCharset: "utf8",
        outCharset: "utf-8",
        notice: 0,
        platform: "yqq",
        needNewCode: 0,
    };
    // 路径 1：fcg 接口。
    //  c.y.qq.com/qzone/... 对「我喜欢的音乐」这类未登录歌单会返回
    //  {"code":0,"subcode":4000,"msg":"check privacy error!"}；
    //  i.y.qq.com/qzone-music/... 不做该校验，能直接给出全部 songlist（实测 280/280）。
    // format=json 在部分链路上只回 "[object Object]"，jsonp + jsonCallback
    // 才是稳定的 JSON（jsonFromResp 会剥掉包装函数），两种都试。
    const qzoneHosts = [
        "https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg",
        "https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg",
        "https://c.y.qq.com/v8/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg",
    ];
    const formats: Dict[] = [
        { format: "json" },
        { format: "jsonp", jsonCallback: "MusicJsonCallback" },
    ];
    const apis: string[] = [];
    for (const host of qzoneHosts) {
        for (const f of formats) {
            apis.push(`${host}?${qs.stringify({ ...baseQuery, ...f })}`);
        }
    }
    for (const api of apis) {
        const resp = await probe.get(api, headers);
        const json = jsonFromResp(resp);
        const root = json && typeof json === "object" ? (json as Dict) : null;
        let cdlist: any[] = [];
        if (root) {
            if (Array.isArray(root.cdlist)) cdlist = root.cdlist;
            else if (root.data && Array.isArray((root.data as Dict).cdlist))
                cdlist = (root.data as Dict).cdlist;
        }
        for (const cd of cdlist) {
            if (!cd || typeof cd !== "object") continue;
            if (!sheetTitle)
                sheetTitle = cleanSheetTitle(
                    firstString(cd, ["dissname", "diss_name", "name", "title"]),
                );
            const cdTotal = Number(cd.songnum ?? cd.total_song_num ?? 0) || 0;
            if (cdTotal > declaredTotal) declaredTotal = cdTotal;
            const list = Array.isArray((cd as Dict).songlist)
                ? ((cd as Dict).songlist as any[])
                : [];
            const mapped = mapTracks(list);
            if (mapped.length) tracks = mapped;
            if (tracks.length) break;
        }
        if (tracks.length) break;
    }

    // 路径 2：抓歌单页。未登录私有歌单（「我喜欢的音乐」）fcg 会返回
    // check privacy error，只有页面里的 __INITIAL_DATA__ 还给出前 10 首。
    if (!tracks.length) {
        const pages = [
            `https://y.qq.com/n/ryqq/playlist/${encodeURIComponent(id)}`,
            `https://i.y.qq.com/n2/m/share/details/taoge.html?id=${encodeURIComponent(id)}`,
            `https://y.qq.com/w/taoge.html?id=${encodeURIComponent(id)}`,
            ...urls.map(toAbs),
        ];
        for (const p of pages) {
            if (!p) continue;
            const resp = await probe.get(toAbs(p), headers);
            if (!resp) continue;
            const page = parseQQPage(resp.text);
            if (!sheetTitle && page.sheetTitle) sheetTitle = page.sheetTitle;
            if (page.totalNum > declaredTotal) declaredTotal = page.totalNum;
            if (page.tracks.length) {
                tracks = page.tracks;
                partialFromPage = true;
                break;
            }
            // 通用 HTML 兜底：只接受 2 首以上，避免把「歌单名 + 昵称」当成一首歌
            const parsed = collectFromHtml(resp.text);
            if (!sheetTitle) sheetTitle = parsed.sheetTitle;
            if (parsed.tracks.length > 1) {
                tracks = parsed.tracks;
                partialFromPage = true;
                break;
            }
        }
    }

    if (!probe.ok) throw new Error(strings.parseFail);
    const notice =
        partialFromPage && declaredTotal > tracks.length
            ? strings.qqPartial(tracks.length, declaredTotal)
            : undefined;
    return {
        platform: "qq",
        sheetTitle: sheetTitle || strings.namePlaceholder,
        tracks,
        ...(declaredTotal ? { declaredTotal } : {}),
        ...(notice ? { notice } : {}),
    };
}

async function fetchKugou(id: string, urls: string[]): Promise<IParseResult> {
    const probe = new Probe();
    const headers: Dict = {
        Referer: "https://www.kugou.com/",
        "User-Agent": UA,
        Accept: "text/html,application/json,text/plain,*/*",
    };
    let sheetTitle = "";
    let tracks: IImportTrack[] = [];

    // 路径 1：歌单页面（dataFromSmarty / __SPECIAL_INFO__ / __INITIAL_STATE__ /
    //        songname+singername 成对 / filename 形式 / var specialName）
    const pages = [
        `https://www.kugou.com/yy/special/single/${encodeURIComponent(id)}.html`,
        `https://www.kugou.com/songlist/${encodeURIComponent(id)}`,
        `https://m.kugou.com/yy/special/single/${encodeURIComponent(id)}.html`,
        ...urls.slice(0, 2).map(toAbs),
    ];
    for (const p of pages) {
        if (!p) continue;
        const resp = await probe.get(toAbs(p), headers);
        if (!resp) continue;
        const parsed = collectFromHtml(resp.text);
        if (!sheetTitle) sheetTitle = parsed.sheetTitle;
        if (parsed.tracks.length) {
            tracks = parsed.tracks;
            break;
        }
    }

    // 路径 2：getSpecialSongs 接口
    if (!tracks.length) {
        const api = `https://www.kugou.com/yy/special/getSpecialSongs?specialid=${encodeURIComponent(id)}&page=1&pagesize=200`;
        const resp = await probe.get(api, {
            ...headers,
            Referer: `https://www.kugou.com/yy/special/single/${encodeURIComponent(id)}.html`,
        });
        const json = jsonFromResp(resp);
        if (json && typeof json === "object") {
            const root = json as Dict;
            const lists: any[][] = [];
            for (const v of [
                root.data?.info,
                root.data?.songs,
                root.data?.list,
                root.list,
                root.songs,
                root.info,
            ]) {
                if (Array.isArray(v)) lists.push(v);
            }
            for (const arr of lists) {
                const mapped = mapTracks(arr);
                if (mapped.length) {
                    tracks = mapped;
                    break;
                }
            }
            if (!tracks.length) {
                const walked: IImportTrack[] = [];
                walkForTracks(json, walked, 0);
                if (walked.length) tracks = walked;
            }
            if (!sheetTitle) sheetTitle = findSheetName(json);
        }
    }

    if (!probe.ok) throw new Error(strings.parseFail);
    return {
        platform: "kugou",
        sheetTitle: sheetTitle || strings.namePlaceholder,
        tracks,
    };
}

async function fetchGenericHtml(
    urls: string[],
    platform: Exclude<ImportPlatform, "auto">,
): Promise<IParseResult | null> {
    for (const u of urls.slice(0, 2)) {
        const url = toAbs(u);
        if (!url) continue;
        const resp = await request(url, {
            "User-Agent": UA,
            Referer: url,
        }).catch(() => null);
        if (!resp || !resp.text) continue;
        const parsed = collectFromHtml(resp.text);
        if (parsed.tracks.length) {
            return {
                platform,
                sheetTitle: parsed.sheetTitle || strings.namePlaceholder,
                tracks: parsed.tracks,
            };
        }
    }
    return null;
}

async function fetchByPlatform(
    platform: Exclude<ImportPlatform, "auto">,
    id: string,
    urls: string[],
    onBatch?: (done: number, total: number) => void,
): Promise<IParseResult> {
    switch (platform) {
    case "netease":
        return fetchNetease(id, urls, onBatch);
    case "qq":
        return fetchQQ(id, urls);
    case "kugou":
        return fetchKugou(id, urls);
    case "text":
    default:
        return parseTextList(urls.join("\n"));
    }
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/** 主入口：解析歌单，按阶段上报进度；失败抛中文 message 的 Error */
export async function parsePlaylist(
    raw: string,
    platform: ImportPlatform,
    onProgress: ParseProgress,
): Promise<IParseResult> {
    const input = typeof raw === "string" ? raw.trim() : "";
    const report = (percent: number, label: string) => {
        try {
            onProgress(percent, label);
        } catch {
            /* 进度回调异常不影响解析 */
        }
    };

    report(6, "识别歌单平台");
    const detected: Exclude<ImportPlatform, "auto"> =
        platform === "auto" ? detectPlatform(input) : platform;

    report(18, "解析歌单链接");
    const urls = extractUrls(input);
    let rawForId = input;
    if (urls.length && SHORT_HOST_RE.test(urls.join(" "))) {
        const resolved = await resolveShortLinks(urls).catch(() => "");
        if (resolved) rawForId = `${input}\n${resolved}`;
    }
    const playlistId =
        detected === "text" ? "" : extractPlaylistId(rawForId, detected);
    const idUrls = extractUrls(rawForId);

    report(35, "拉取歌单曲目");
    let result: IParseResult;
    // 输入里带平台链接时，绝不能把「分享文案」当成歌曲列表
    const isLinkInput = detected !== "text" && idUrls.length > 0;
    const onBatch = (done: number, total: number) => {
        report(
            35 + Math.round((done / Math.max(total, 1)) * 40),
            `补全曲目信息 ${done}/${total}`,
        );
    };

    if (detected === "text" || (!playlistId && !isLinkInput)) {
        // 纯文本列表：用户主动选了「文本列表」，或粘贴的是不带链接的文本
        result = parseTextList(input);
    } else if (!playlistId) {
        // 有平台链接但提不到歌单 id：抓页面做最后一次尝试
        const fallback = await fetchGenericHtml(idUrls, detected).catch(
            () => null,
        );
        if (fallback && fallback.tracks.length) {
            result = fallback;
        } else {
            throw new Error(strings.parseFail);
        }
    } else {
        try {
            result = await fetchByPlatform(
                detected,
                playlistId,
                idUrls,
                onBatch,
            );
        } catch {
            // 平台主路径全部失败：再试一次通用 HTML 兜底
            const fallback = await fetchGenericHtml(idUrls, detected).catch(
                () => null,
            );
            if (fallback && fallback.tracks.length) {
                result = {
                    platform: detected,
                    sheetTitle: fallback.sheetTitle,
                    tracks: fallback.tracks,
                };
            } else {
                throw new Error(strings.parseFail);
            }
        }
    }

    report(78, "整理曲目信息");
    let cleaned = cleanResult(result);

    // 接口没给歌单名时，用「分享歌单: XXX」里的名字兜底
    if (cleaned.sheetTitle === strings.namePlaceholder) {
        const shareTitle = sheetTitleFromShareText(input);
        if (shareTitle) cleaned = { ...cleaned, sheetTitle: shareTitle };
    }

    // 链接输入却只得到 1 首，或只得到「歌单名同名」的曲目 —— 基本可以断定
    // 是把分享文案 / 歌单元数据误当成歌曲了。宁可报错走插件兜底，
    // 也不要生成一个「未找到 1 首」的假歌单。
    if (isLinkInput) {
        const titleNorm = normalize(cleaned.sheetTitle);
        const meaningful = cleaned.tracks.filter(
            t => normalize(t.title) !== titleNorm,
        );
        if (meaningful.length !== cleaned.tracks.length) {
            cleaned = { ...cleaned, tracks: meaningful };
        }
        if (cleaned.tracks.length <= 1) {
            throw new Error(strings.parseTooFew);
        }
    }
    if (cleaned.tracks.length === 0) {
        throw new Error(strings.parseEmpty);
    }
    report(100, "解析完成");
    return cleaned;
}
