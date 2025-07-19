const CONFIG = {
    addonName: "Premiumize Files",
    premiumizeFolderId: "",
    premiumizeApiKey: "",
    tmdbApiKey: "",
    rpdbApiKey: "",
};

const MANIFEST = {
    id: "stremio.premiumize.worker",
    version: "1.0.0",
    name: CONFIG.addonName,
    description: "Stream your files from Premiumize within Stremio!",
    catalogs: [],
    resources: [
        { name: "catalog", types: ["movie", "series"] },
        { name: "meta", types: ["movie", "series"], idPrefixes: ["premiumize-"] },
        { name: "stream", types: ["movie", "series"], idPrefixes: ["premiumize-", "tt"] }
    ],
    types: ["movie", "series"]
};

const HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const API_ENDPOINTS = {
    PREMIUMIZE_FOLDER_LIST: "https://www.premiumize.me/api/folder/list?apikey={apiKey}&id={folderId}",
    PREMIUMIZE_FOLDER_SEARCH: "https://www.premiumize.me/api/folder/search?apikey={apiKey}&q={query}",
    PREMIUMIZE_ITEM_DETAILS: "https://www.premiumize.me/api/item/details?apikey={apiKey}&id={itemId}",
    RPDB_POSTER: "https://api.ratingposterdb.com/{api_key}/{source}/poster-default/{id}.jpg",
};

const REGEX_PATTERNS = {
    validRequests: {
        Stream: /^\/stream\/(movie|series)\/([a-zA-Z0-9:%\-\._]+)\.json$/,
        Playback: /\/playback\/([a-zA-Z0-9%:\-_]+)\/(.+)/,
        Catalog: /^\/catalog\/premiumize\/(premiumize-\w+)\.json$/,
        Meta: /^\/meta\/(movie|series)\/premiumize-([^\.]+)\.json$/,
    },
};

function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data, null, 4), {
        headers: HEADERS,
        status: status,
    });
}

function replaceParams(url, params) {
    for (const key in params) {
        url = url.replace(`{${key}}`, encodeURIComponent(params[key] || ""));
    }
    return url;
}

async function folderList(folderId) {
    const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_FOLDER_LIST, {
        apiKey: CONFIG.premiumizeApiKey,
        folderId: folderId || ""
    });
    const res = await fetch(url);
    const json = await res.json();
    return json.content || [];
}

async function itemDetails(itemId) {
    const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_ITEM_DETAILS, {
        apiKey: CONFIG.premiumizeApiKey,
        itemId: itemId
    });
    const res = await fetch(url);
    const json = await res.json();
    return json || {};
}

function extractIdsFromName(name) {
    const match = name.match(/\[tt(\d+)-(\d+)\]/i);
    if (match) {
        return {
            imdb: `tt${match[1]}`,
            tmdb: `tmdb:${match[2]}`
        };
    }
    return {};
}

function cleanName(name) {
    return name.replace(/\s*\[tt\d+-\d+\]$/, '').trim();
}

function getPosterUrlFromIds(ids) {
    if (ids && ids.imdb) {
        return API_ENDPOINTS.RPDB_POSTER
            .replace("{api_key}", CONFIG.rpdbApiKey)
            .replace("{source}", "imdb")
            .replace("{id}", ids.imdb);
    }
    return null;
}

async function collectMovies(folderId) {
    const contents = await folderList(folderId);
    return contents.filter(f => f.type === "file" && /\.(mp4|mkv|avi)$/i.test(f.name)).map(file => {
        const ids = extractIdsFromName(file.name);
        return {
            id: ids.tmdb || `premiumize-${file.id}`,
            type: "movie",
            name: cleanName(file.name.replace(/\.(mp4|mkv|avi)$/i, "")),
            poster: getPosterUrlFromIds(ids),
            description: null
        };
    });
}

async function collectSeries(folderId) {
    const series = [];
    const showFolders = await folderList(folderId);

    for (const show of showFolders.filter(f => f.type === "folder")) {
        const episodes = await collectEpisodes(show.id);
        if (episodes.length > 0) {
            const ids = extractIdsFromName(show.name);
            series.push({
                id: ids.tmdb || `premiumize-${show.name}`,
                type: "series",
                name: cleanName(show.name),
                poster: getPosterUrlFromIds(ids),
                description: null
            });
        }
    }
    return series;
}

async function collectEpisodes(folderId) {
    const contents = await folderList(folderId);
    return contents.filter(f => f.type === "file" && /S\d{2}E\d{2}/i.test(f.name) && /\.(mp4|mkv|avi)$/i.test(f.name));
}

async function getMeta(id) {
    const folderId = id.split("premiumize-")[1];
    const files = await collectEpisodes(folderId);

    const videosBySeason = {};
    for (const f of files) {
        const match = f.name.match(/S(\d{2})E(\d{2})/i);
        if (match) {
            const season = parseInt(match[1]);
            const episode = parseInt(match[2]);
            if (!videosBySeason[season]) videosBySeason[season] = [];
            videosBySeason[season].push({
                id: `premiumize-${f.id}`,
                title: `S${season}:E${episode}`,
                season,
                episode,
                released: "2000-01-01T00:00:00.000Z"
            });
        }
    }

    const allEpisodes = Object.entries(videosBySeason).flatMap(([seasonNum, episodes]) =>
        episodes.map(ep => ({
            id: `${ep.id}`,
            title: `S${ep.season}:E${ep.episode}`,
            season: ep.season,
            episode: ep.episode,
            released: ep.released
        }))
    );

    return {
        id,
        type: "series",
        name: "Premiumize Series",
        poster: null,
        description: null,
        background: null,
        genres: [],
        cast: [],
        director: [],
        runtime: null,
        videos: allEpisodes
    };
}

async function getMovieMeta(id) {
    const fileId = id.split("premiumize-")[1];
    return {
        id,
        type: "movie",
        name: "Premiumize Movie",
        poster: null,
        description: null
    };
}

async function getStream(type, id) {
    let details = null;
    id = decodeURIComponent(id);

    if (id.startsWith("premiumize-")) {
        const fileId = id.split("premiumize-")[1];
        details = await itemDetails(fileId);
    }
    else if (/^tt\d+:\d+:\d+$/.test(id)) {
        console.log(`Fetching details for series episode with id: ${id}`);
        const [imdbId, season, episode] = id.split(":");
        const sxxexx = `S${season.padStart(2, "0")}E${episode.padStart(2, "0")}`;
        const query = `${sxxexx} [${imdbId}`;
        const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_FOLDER_SEARCH, {
            apiKey: CONFIG.premiumizeApiKey,
            query: query
        });
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === "success" && json.content && json.content.length > 0) {
            details = json.content[0];
        }
    }
    else if (id.startsWith("tt")) {
        console.log(`Fetching details for movie with id: ${id}`);
        const query = `[${id}`;
        const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_FOLDER_SEARCH, {
            apiKey: CONFIG.premiumizeApiKey,
            query: query
        });
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === "success" && json.content && json.content.length > 0) {
            details = json.content[0];
        }
    }
    else {
        const query = id;
        const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_FOLDER_SEARCH, {
            apiKey: CONFIG.premiumizeApiKey,
            query: query
        });
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === "success" && json.content && json.content.length > 0) {
            details = json.content[0];
        }
    }

    if (!details || !details.stream_link) {
        return [createErrorStream("File not found or not streamable")];
    }

    return [{
        name: MANIFEST.name,
        title: "[PLAY]",
        url: details.stream_link
    }];
}

function createErrorStream(description) {
    return {
        name: `[⚠️] ${MANIFEST.name}`,
        description: description,
        externalUrl: "",
    };
}

async function handleRequest(request) {
    try {
        const url = new URL(request.url);

        // Manifest
        if (url.pathname === "/manifest.json") {
            const rootFolders = await folderList(CONFIG.premiumizeFolderId);

            MANIFEST.catalogs = rootFolders.filter(f => f.type === "folder").map(folder => ({
                type: CONFIG.addonName,
                id: `premiumize-${folder.name.toLowerCase()}`,
                name: folder.name
            }));

            return createJsonResponse(MANIFEST);
        }

        if (url.pathname === "/") {
            return Response.redirect(url.origin + "/manifest.json", 301);
        }

        const streamMatch = REGEX_PATTERNS.validRequests.Stream.exec(url.pathname);
        const playbackMatch = REGEX_PATTERNS.validRequests.Playback.exec(url.pathname);
        const catalogMatch = REGEX_PATTERNS.validRequests.Catalog.exec(url.pathname);
        const metaMatch = REGEX_PATTERNS.validRequests.Meta.exec(url.pathname);

        if (!(playbackMatch || streamMatch || catalogMatch || metaMatch)) {
            return new Response("Bad Request", { status: 400 });
        }

        // Catalogs
        if (catalogMatch) {
            const catalogId = catalogMatch[1];
            const rootFolders = await folderList(CONFIG.premiumizeFolderId);
            const matchedFolder = rootFolders.find(f => `premiumize-${f.name.toLowerCase()}` === catalogId);

            if (!matchedFolder) return createJsonResponse({ metas: [] });

            const folderName = matchedFolder.name.toLowerCase();
            let metas = [];

            if (folderName === "movies") {
                metas = await collectMovies(matchedFolder.id);
            } else {
                metas = await collectSeries(matchedFolder.id);
            }

            return createJsonResponse({ metas });
        }

        // Meta
        if (metaMatch) {
            const id = metaMatch[2];
            if (id.startsWith("premiumize-")) {
                const type = metaMatch[1];
                const meta = type === "series" ? await getMeta(id) : await getMovieMeta(id);
                return createJsonResponse({ meta });
            }
            return createJsonResponse({ meta: null });
        }

        // Stream
        if (streamMatch) {
            const type = streamMatch[1];
            const id = streamMatch[2];
            const streams = await getStream(type, id);
            return createJsonResponse({ streams });
        }

        return new Response("Not Found", { status: 404 });
    }
    catch (error) {
        console.error({
            message: "An unexpected error occurred",
            error: error.toString(),
        });
        return new Response("Internal Server Error", { status: 500 });
    }
}

export default {
    async fetch(request, env, ctx) {
        CONFIG.addonName = CONFIG.addonName || env.ADDON_NAME;
        CONFIG.premiumizeFolderId = CONFIG.premiumizeFolderId || env.PREMIUMIZE_FOLDER_ID;
        CONFIG.premiumizeApiKey = CONFIG.premiumizeApiKey || env.PREMIUMIZE_API_KEY;
        CONFIG.tmdbApiKey = CONFIG.tmdbApiKey || env.TMDB_API_KEY;
        CONFIG.rpdbApiKey = CONFIG.rpdbApiKey || env.RPDB_API_KEY;
        return handleRequest(request);
    }
};
