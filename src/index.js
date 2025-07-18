const PREMIUMIZE = {
    apiKey: "",
    rootFolderId: ""
};

const MANIFEST = {
    id: "stremio.premiumize.worker",
    version: "1.0.0",
    name: "Premiumize Files",
    description: "Stream your files from Premiumize within Stremio!",
    catalogs: [],
    resources: [
        { name: "catalog", types: ["premiumize"] },
        { name: "meta", types: ["premiumize"], idPrefixes: ["premiumize:"] },
        { name: "stream", types: ["premiumize"], idPrefixes: ["premiumize:"] }
    ],
    types: ["premiumize"]
};

const HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const API_ENDPOINTS = {
    PREMIUMIZE_FOLDER_LIST: "https://www.premiumize.me/api/folder/list?apikey={apiKey}&id={folderId}",
    PREMIUMIZE_ITEM_DETAILS: "https://www.premiumize.me/api/item/details?apikey={apiKey}&id={itemId}",
    CINEMETA: "https://v3-cinemeta.strem.io/meta/{type}/{id}.json",
    IMDB_SUGGEST: "https://v3.sg.media-imdb.com/suggestion/a/{id}.json",
    TMDB_FIND: "https://api.themoviedb.org/3/find/{id}?api_key={apiKey}&external_source=imdb_id",
    TMDB_DETAILS: "https://api.themoviedb.org/3/{type}/{id}?api_key={apiKey}",
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

async function listFolder(folderId) {
    const url = replaceParams(API_ENDPOINTS.PREMIUMIZE_FOLDER_LIST, {
        apiKey: PREMIUMIZE.apiKey,
        folderId: folderId || ""
    });
    const res = await fetch(url);
    const json = await res.json();
    return json.content || [];
}

async function handleRequest(request) {
    const url = new URL(request.url);

    // Manifest
    if (url.pathname === "/manifest.json") {
        const rootFolders = await listFolder(PREMIUMIZE.rootFolderId);

        MANIFEST.catalogs = rootFolders.filter(f => f.type === "folder").map(folder => ({
            type: "premiumize",
            id: `premiumize_${folder.name.toLowerCase()}`,
            name: folder.name
        }));

        return createJsonResponse(MANIFEST);
    }

    // Catalogs
    const catalogMatch = url.pathname.match(/^\/catalog\/premiumize\/(premiumize_\w+)\.json$/);
    if (catalogMatch) {
        const catalogId = catalogMatch[1];
        const rootFolders = await listFolder(PREMIUMIZE.rootFolderId);
        const matchedFolder = rootFolders.find(f => `premiumize_${f.name.toLowerCase()}` === catalogId);

        if (!matchedFolder) return createJsonResponse({ metas: [] });

        const folderContents = await listFolder(matchedFolder.id);
        const files = folderContents.filter(i => i.type === "file" && /\.(mp4|mkv|avi)$/.test(i.name));

        const metas = files.map(file => ({
            id: `premiumize:${file.id}`,
            type: "premiumize",
            name: file.name.replace(/\.(mp4|mkv|avi)$/i, ""),
            poster: null,
            description: null
        }));

        return createJsonResponse({ metas });
    }

    return new Response("Not Found", { status: 404 });
}

export default {
    async fetch(request, env, ctx) {
        PREMIUMIZE.apiKey = PREMIUMIZE.apiKey || env.PREMIUMIZE_API_KEY;
        PREMIUMIZE.rootFolderId = PREMIUMIZE.rootFolderId || env.PREMIUMIZE_ROOT_FOLDER;
        return handleRequest(request);
    }
};
