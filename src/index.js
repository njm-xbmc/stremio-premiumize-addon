const MANIFEST = {
    id: "stremio.premiumize.worker",
    version: "1.0.0",
    name: "Premiumize Files",
    description: "Stream your files from Premiumize within Stremio!",
    catalogs: [
        { type: "premiumize", id: "premiumize_movies", name: "Movies" },
        { type: "premiumize", id: "premiumize_series", name: "Series" },
        { type: "premiumize", id: "premiumize_anime", name: "Anime" }
    ],
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

const SAMPLE_ITEMS = {
    premiumize_movies: [
        {
            id: "premiumize:movie1",
            type: "premiumize",
            name: "How to Train Your Dragon",
            poster: "https://via.placeholder.com/200x300?text=Movie+1",
            description: "Película de prueba"
        }
    ],
    premiumize_series: [
        {
            id: "premiumize:series1",
            type: "premiumize",
            name: "Sample Series",
            poster: "https://via.placeholder.com/200x300?text=Series+1",
            description: "Serie de prueba"
        }
    ],
    premiumize_anime: [
        {
            id: "premiumize:anime1",
            type: "premiumize",
            name: "Anime Example",
            poster: "https://via.placeholder.com/200x300?text=Anime+1",
            description: "Anime de prueba"
        }
    ]
};

export default {
    async fetch(request) {
        const url = new URL(request.url);

        // MANIFEST
        if (url.pathname === "/manifest.json") {
            return new Response(JSON.stringify(MANIFEST), { headers: HEADERS });
        }

        // CATALOG
        const catalogMatch = url.pathname.match(/^\/catalog\/premiumize\/(premiumize_\w+)\.json$/);
        if (catalogMatch) {
            const catalogId = catalogMatch[1];
            const metas = SAMPLE_ITEMS[catalogId] || [];
            return new Response(JSON.stringify({ metas }), { headers: HEADERS });
        }

        // META
        const metaMatch = url.pathname.match(/^\/meta\/premiumize\/(.+)\.json$/);
        if (metaMatch) {
            const id = metaMatch[1];
            const item = Object.values(SAMPLE_ITEMS).flat().find(i => i.id === `premiumize:${id}`);
            if (!item) return new Response("Not Found", { status: 404 });
            return new Response(JSON.stringify({ meta: item }), { headers: HEADERS });
        }

        // STREAM
        const streamMatch = url.pathname.match(/^\/stream\/premiumize\/(.+)\.json$/);
        if (streamMatch) {
            const id = streamMatch[1];
            return new Response(JSON.stringify({
                streams: [
                    {
                        title: "Stream de prueba",
                        url: "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4"
                    }
                ]
            }), { headers: HEADERS });
        }

        return new Response("Not Found", { status: 404 });
    }
};
