const CREDENTIALS = {
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    refreshToken: "YOUR_REFRESH_TOKEN",
};

const CONFIG = {
    resolutions: ["2160p", "1080p", "720p", "480p", "Unknown"],
    qualities: [
        "BluRay REMUX",
        "BDRip",
        "BluRay",
        "HDRip",
        "WEB-DL",
        "WEBRip",
        "WEB",
        "CAM/TS",
        "Unknown",
    ],
    sortBy: ["resolution", "hdrdv", "quality", "size"],
    addonName: "GDrive",
    prioritiseLanguage: null,
    driveQueryTerms: {
        episodeFormat: "fullText",
        movieYear: "name",
    },
};

const MANIFEST = {
    id: "stremio.gdrive.worker",
    version: "1.1.0",
    name: CONFIG.addonName,
    description: "Stream your files from Google Drive within Stremio!",
    catalogs: [],
    resources: ["stream"],
    types: ["movie", "series"],
};

const HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const API_ENDPOINTS = {
    DRIVE_FETCH_FILES: "https://content.googleapis.com/drive/v3/files",
    DRIVE_STREAM_FILE:
        "https://www.googleapis.com/drive/v3/files/{fileId}?alt=media",
    DRIVE_TOKEN: "https://oauth2.googleapis.com/token",
    CINEMETA: "https://v3-cinemeta.strem.io/meta/{type}/{id}.json",
    IMDB_SUGGEST: "https://v3.sg.media-imdb.com/suggestion/a/{id}.json",
};

const REGEX_PATTERNS = {
    validRequest: /\/stream\/(movie|series)\/([a-zA-Z0-9%:]+)\.json/,
    resolutions: {
        "2160p": /(?:\[)?\b_?(4k|2160p|uhd)_?\b(?:\])?/i,
        "1080p": /(?:\[)?\b_?(1080p|fhd)_?\b(?:\])?/i,
        "720p": /(?:\[)?\b_?(720p|hd)_?\b(?:\])?/i,
        "480p": /(?:\[)?\b_?(480p|sd)_?\b(?:\])?/i,
    },
    qualities: {
        "BluRay REMUX":
            /(?:\[)?\b_?(blu[\s\.\-_]?ray[\s\.\-_]?remux|bd[\s\.\-_]?remux)_?\b(?:\])?/i,
        BDRip: /(?:\[)?\b_?(bd[\s\.\-_]?rip|blu[\s\.\-_]?ray[\s\.\-_]?rip|br[\s\.\-_]?rip)_?\b(?:\])?/i,
        BluRay: /(?:\[)?\b_?(blu[\s\.\-_]?ray|bd)_?\b(?:\])?/i,
        HDRip: /(?:\[)?\b_?(hd[\s\.\-_]?rip)_?\b(?:\])?/i,
        "WEB-DL": /(?:\[)?\b_?(web[\s\.\-_]?dl)_?\b(?:\])?/i,
        WEBRip: /(?:\[)?\b_?(web[\s\.\-_]?rip)_?\b(?:\])?/i,
        WEB: /(?:\[)?\b_?(web)_?\b(?:\])?/i,
        "CAM/TS": /(?:\[)?\b_?(cam|ts|tc|telesync|hdts|hdtc|telecine)_?\b(?:\])?/i,
    },
    visualTags: {
        "HDR10+": /(?:\[)?\b_?(hdr10[\s\.\-_]?[+]?|hdr10plus)_?\b(?:\])?/i,
        HDR10: /(?:\[)?\b_?(hdr10)_?\b(?:\])?/i,
        HDR: /(?:\[)?\b_?(hdr)_?\b(?:\])?/i,
        DV: /(?:\[)?\b_?(dolby[\s\.\-_]?vision|dolby[\s\.\-_]?vision[\s\.\-_]?atmos|dv)_?\b(?:\])?/i,
        IMAX: /(?:\[)?\b_?(imax)_?\b(?:\])?/i,
    },
    audioTags: {
        Atmos: /(?:\[)?\b_?(atmos)_?\b(?:\])?/i,
        "DDP5.1":
            /(?:\[)?\b_?(ddp5\.1|dolby[\s\.\-_]?digital[\s\.\-_]?plus[\s\.\-_]?5\.1)_?\b(?:\])?/i,
        "Dolby Digital Plus": /(?:\[)?\b_?(ddp|dolby[\s\.\-_]?digital[\s\.\-_]?plus)_?\b(?:\])?/i,
        "Dolby Digital": /(?:\[)?\b_?(dd|dolby[\s\.\-_]?digital)_?\b(?:\])?/i,
        "DTS HD": /(?:\[)?\b_?(dts[\s\.\-_]?hd[\s\.\-_]?ma)_?\b(?:\])?/i,
        DTS: /(?:\[)?\b_?(dts)_?\b(?:\])?/i,
        TrueHD: /(?:\[)?\b_?(truehd)_?\b(?:\])?/i,
        5.1: /(?:\[)?\b_?(5\.1)_?\b(?:\])?/i,
        7.1: /(?:\[)?\b_?(7\.1)_?\b(?:\])?/i,
        AC3: /(?:\[)?\b_?(ac[\s\.\-_]?3)_?\b(?:\])?/i,    
    },
    encodes: {
        x265: /(?:\[)?\b_?(x265|h265|hevc|h\.265)_?\b(?:\])?/i,
        x264: /(?:\[)?\b_?(x264|h264|avc|h\.264)_?\b(?:\])?/i,
    },
    languages: {
        English: /(?:\[)?\b_?(english|eng)_?\b(?:\])?/i,
        Hindi: /(?:\[)?\b_?(hindi|hin)_?\b(?:\])?/i,
        Tamil: /(?:\[)?\b_?(tamil|tam)_?\b(?:\])?/i,
        Telugu: /(?:\[)?\b_?(telugu)_?\b(?:\])?/i,
        Malayalam: /(?:\[)?\b_?(malayalam)_?\b(?:\])?/i,
        Kannada: /(?:\[)?\b_?(kannada)_?\b(?:\])?/i,
        Bengali: /(?:\[)?\b_?(bengali)_?\b(?:\])?/i,
        Punjabi: /(?:\[)?\b_?(punjabi)_?\b(?:\])?/i,
        Marathi: /(?:\[)?\b_?(marathi)_?\b(?:\])?/i,
        French: /(?:\[)?\b_?(french|fra)_?\b(?:\])?/i,
        Spanish: /(?:\[)?\b_?(spanish|spa)_?\b(?:\])?/i,
        German: /(?:\[)?\b_?(german|deu)_?\b(?:\])?/i,
        Italian: /(?:\[)?\b_?(italian|ita)_?\b(?:\])?/i,
        Japanese: /(?:\[)?\b_?(japanese|jpn)_?\b(?:\])?/i,
        Korean: /(?:\[)?\b_?(korean|kor)_?\b(?:\])?/i,
        Chinese: /(?:\[)?\b_?(chinese|chn)_?\b(?:\])?/i,
    },
};


const createJsonResponse = (data, status = 200) =>
    new Response(JSON.stringify(data, null, 4), {
        headers: HEADERS,
        status: status,
    });

const validateConfig = () => {
    const requiredFields = [
        { value: CREDENTIALS.clientId, error: "Missing clientId. Add your client ID to the credentials object" },
        { value: CREDENTIALS.clientSecret, error: "Missing clientSecret! Add your client secret to the credentials object" },
        { value: CREDENTIALS.refreshToken, error: "Missing refreshToken! Add your refresh token to the credentials object" },
        { value: CONFIG.addonName, error: "Missing addonName! Provide it in the config object" },
    ];

    for (const { value, error } of requiredFields) {
        if (!value) {
            console.error({ message: error, yourValue: value });
            return false;
        }
    }

    const validValues = {
        resolutions: [...Object.keys(REGEX_PATTERNS.resolutions), "Unknown"],
        qualities: [...Object.keys(REGEX_PATTERNS.qualities), "Unknown"],
        sortBy: ["resolution", "size", "quality", "hdrdv"],
        languages: [...Object.keys(REGEX_PATTERNS.languages), "Unknown"],
    };

    const keyToSingular = {
        resolutions: "resolution",
        qualities: "quality",
        sortBy: "sort criterion",
    };

    for (const key of ["resolutions", "qualities", "sortBy"]) {
        const configValue = CONFIG[key];
        if (!Array.isArray(configValue)) {
            console.error(`Invalid ${key}: ${configValue} is not an array`);
            return false;
        }
        for (const value of CONFIG[key]) {
            if (!validValues[key].includes(value)) {
                console.error({message: `Invalid ${keyToSingular[key]}: ${value}`, validValues: validValues[key]});
                return false;
            }
        }
    }

    if (CONFIG.prioritiseLanguage && !validValues.languages.includes(CONFIG.prioritiseLanguage)) {
        console.error({message: `Invalid prioritised language: ${CONFIG.prioritiseLanguage}`, validValues: validValues.languages});
        return false;
    }

    return true;
};

const refreshToken = async () => {
    const params = new URLSearchParams({
        client_id: CREDENTIALS.clientId,
        client_secret: CREDENTIALS.clientSecret,
        refresh_token: CREDENTIALS.refreshToken,
        grant_type: "refresh_token",
    });

    try {
        const response = await fetch(API_ENDPOINTS.DRIVE_TOKEN, {
            method: "POST",
            body: params,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        if (!response.ok) {
            let err = await response.json()
            throw new Error(JSON.stringify(err));
        }

        const { access_token } = await response.json();
        return access_token;
    } catch (error) {
        console.error({ message: "Failed to refresh token", error: JSON.parse(error.message) });
        return undefined;
    }
};

export default {
    async fetch(request) {
        return handleRequest(request);
    },
};
async function handleRequest(request) {
    try {
        const url = new URL(
            decodeURIComponent(request.url).replace("%3A", ":")
        );

        if (url.pathname === "/manifest.json")
            return createJsonResponse(MANIFEST);

        if (url.pathname === "/")
            return Response.redirect(url.origin + "/manifest.json", 301);

        const streamMatch = REGEX_PATTERNS.validRequest.exec(url.pathname);

        if (!streamMatch) return new Response("Bad Request", { status: 400 });

        if (validateConfig() === false) {
            return createJsonResponse({
                streams: [
                    createErrorStream(
                        "Invalid configuration\nEnable and check the logs for more information\nClick for setup instructions"
                    ),
                ],
            });
        }

        const type = streamMatch[1];
        const [imdbId, season, episode] = streamMatch[2].split(":");

        const metadata = await getMetadata(type, imdbId);

        if (!metadata) return createJsonResponse({ streams: [] });

        const parsedStreamRequest = {
            type: type,
            id: imdbId,
            season: parseInt(season) || undefined,
            episode: parseInt(episode) || undefined,
            metadata: metadata,
        };

        const streams = await getStreams(parsedStreamRequest);

        if (streams.length === 0) {
            return createJsonResponse({
                streams: [
                    createErrorStream(
                        "No streams found\nTry joining more team drives"
                    ),
                ],
            });
        }
        return createJsonResponse({ streams: streams });
    } catch (error) {
        console.error({ message: "An unexpected error occurred", error: error.toString() });
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function getMetadata(type, id) {
    let meta;

    try {
        meta = await getCinemetaMeta(type, id);
        if (meta) {
            console.log({message: "Successfully retrieved metadata from Cinemeta", meta});
            return meta;
        }
    } catch (error) {
        console.error({ message: "Error fetching metadata from Cinemeta", error: error.toString() });
    }

    try {
        meta = await getImdbSuggestionMeta(id);
        if (meta) {
            console.log({message: "Successfully retrieved metadata from IMDb Suggestions", meta});
            return meta;
        }
    } catch (error) {
        console.error({ message: "Error fetching metadata from IMDb Suggestions", error: error.toString() });
    }

    console.error({ message: "Failed to get metadata from Cinemeta or IMDb Suggestions, returning null"});
    return null;
}

async function getCinemetaMeta(type, id) {
    const response = await fetch(
        API_ENDPOINTS.CINEMETA.replace("{type}", type).replace("{id}", id)
    );
    if (!response.ok) {
        let err = await response.text();
        throw new Error(err);
    }
    const data = await response.json();
    if (!data?.meta) {
        throw new Error("Meta object not found in response");
    }
    if (!data.meta.name || !data.meta.year) {
        throw new Error("Either name or year not found in meta object");
    }
    return {
        name: data.meta.name,
        year: data.meta.year,
    };
}

async function getImdbSuggestionMeta(id) {
    const response = await fetch(
        API_ENDPOINTS.IMDB_SUGGEST.replace("{id}", id)
    );
    if (!response.ok) {
        let err = await response.text();
        throw new Error(err);
    }
    const data = await response.json();
    if (!data?.d) {
        throw new Error("No suggestions in d object");
    }

    const item = data.d.find((item) => item.id === id);
    if (!item) {
        throw new Error("No matching item found with the given id");
    }

    if (!item?.l || !item?.q) {
        throw new Error("Missing name or year");
    }

    return {
        name: item.l,
        year: item.q,
    };
}

async function getStreams(streamRequest) {
    const streams = [];
    const query = await buildSearchQuery(streamRequest);
    console.log({ message: "Built search query", query, config: CONFIG });

    const queryParams = {
        q: query,
        corpora: "allDrives",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        pageSize: "1000",
        fields: "files(id,name,size)",
    };

    const fetchUrl = new URL(API_ENDPOINTS.DRIVE_FETCH_FILES);
    fetchUrl.search = new URLSearchParams(queryParams).toString();

    const token = await refreshToken();

    if (!token) {
        return [
            createErrorStream(
                "Invalid Credentials\nEnable and check the logs for more information\nClick for setup instructions"
            ),
        ];
    }

    const results = await fetchFiles(fetchUrl, token);

    if (results?.incompleteSearch) {
        console.warn({ message: "The search was incomplete", results });
    }

    if (!results?.files || results.files.length === 0) {
        console.log({ message: "No files found"});
        return streams;
    }

    console.log({ message: "Fetched files from Google Drive", files: results.files });

    const parsedFiles = parseAndFilterFiles(results.files);
    
    console.log(results.files.length - parsedFiles.length === 0 ? {message: `${parsedFiles.length} files successfully parsed`, files: parsedFiles} : { 
        message: `${ results.files.length - parsedFiles.length} files were filtered out after parsing`,
        filesFiltered: results.files.filter((file) => !parsedFiles.some((parsedFile) => parsedFile.id === file.id)),
        config: CONFIG
    });

    sortParsedFiles(parsedFiles);

    console.log({
        message: "All files parsed, filtered, and sorted successfully",
        files: parsedFiles,
    })

    parsedFiles.forEach((parsedFile) => {
        streams.push(createStream(parsedFile, token));
    });

    return streams;
}

async function fetchFiles(fetchUrl, token) {
    try {
        const response = await fetch(fetchUrl.toString(), {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            let err = await response.text();
            throw new Error(err);
        }
    
        const results = await response.json();
        return results;
    } catch (error) {
        console.error({ message: "Could not fetch files from Google Drive", error: error.toString() });
        return null;
    }
}

function parseAndFilterFiles(files) {
    return files
        .map((file) => parseFile(file))
        .filter(
            (parsedFile) =>
                CONFIG.resolutions.includes(parsedFile.resolution) &&
                CONFIG.qualities.includes(parsedFile.quality)
        );
}

function sortParsedFiles(parsedFiles) {
    parsedFiles.sort((a, b) => {
        const languageComparison = compareLanguages(a, b);
        if (languageComparison !== 0) return languageComparison;

        for (const sortByField of CONFIG.sortBy) {
            const fieldComparison = compareByField(a, b, sortByField);
            if (fieldComparison !== 0) return fieldComparison;
        }

        return 0;
    });
}

function compareLanguages(a, b) {
    if (CONFIG.prioritiseLanguage) {
        const aHasPrioritisedLanguage = a.languages.includes(
            CONFIG.prioritiseLanguage
        );
        const bHasPrioritisedLanguage = b.languages.includes(
            CONFIG.prioritiseLanguage
        );
        if (aHasPrioritisedLanguage && !bHasPrioritisedLanguage) return -1;
        if (!aHasPrioritisedLanguage && bHasPrioritisedLanguage) return 1;
    }
    return 0;
}

function compareByField(a, b, field) {
    if (field === "resolution") {
        return (
            CONFIG.resolutions.indexOf(a.resolution) -
            CONFIG.resolutions.indexOf(b.resolution)
        );
    } else if (field === "size") {
        return b.size - a.size;
    } else if (field === "quality") {
        return (
            CONFIG.qualities.indexOf(a.quality) -
            CONFIG.qualities.indexOf(b.quality)
        );
    } else if (field === "hdrdv") {
        const aHasHDRDV = a.visualTags.some((tag) =>
            ["HDR", "HDR10", "HDR10+", "DV"].includes(tag)
        );
        const bHasHDRDV = b.visualTags.some((tag) =>
            ["HDR", "HDR10", "HDR10+", "DV"].includes(tag)
        );
        if (aHasHDRDV && !bHasHDRDV) return -1;
        if (!aHasHDRDV && bHasHDRDV) return 1;

    }
    return 0;
}

function createStream(parsedFile, token) {
    let name = `${MANIFEST.name}\n${parsedFile.resolution}`;
    if (parsedFile.visualTags.length > 0) {
        name += `\n${parsedFile.visualTags.join(" | ")}`;
    }
    let description = `🎥 ${parsedFile.quality} ${parsedFile.encode}`;
  
    if (parsedFile.audioTags.length > 0) {
        description += ` 🎧 ${parsedFile.audioTags.join(" | ")}`;
    }

    description += `\n📦 ${parsedFile.formattedSize}`
    if (parsedFile.languages.length !== 0) {
        description += `\n🔊 ${parsedFile.languages.join(" | ")}`;
    }

    description += `\n📄 ${parsedFile.name}`

    return {
        name: name,
        description: description,
        url: API_ENDPOINTS.DRIVE_STREAM_FILE.replace("{fileId}", parsedFile.id),
        behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
                request: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                },
            },
        },
    };
}

function createErrorStream(description) {
    return {
        name: `[⚠️] ${MANIFEST.name}`,
        description: description,
        externalUrl: "https://guides.viren070.me/stremio/addons/stremio-gdrive",
    };
}

function parseFile(file) {
    let resolution =
        Object.entries(REGEX_PATTERNS.resolutions).find(([_, pattern]) =>
            pattern.test(file.name)
        )?.[0] || "Unknown";
    let quality =
        Object.entries(REGEX_PATTERNS.qualities).find(([_, pattern]) =>
            pattern.test(file.name)
        )?.[0] || "Unknown";
    let visualTags = Object.entries(REGEX_PATTERNS.visualTags)
        .filter(([_, pattern]) => pattern.test(file.name))
        .map(([tag]) => tag);
    let audioTags = Object.entries(REGEX_PATTERNS.audioTags)
        .filter(([_, pattern]) => pattern.test(file.name))
        .map(([tag]) => tag);
    let encode =
        Object.entries(REGEX_PATTERNS.encodes).find(([_, pattern]) =>
            pattern.test(file.name)
        )?.[0] || "";
    let languages = Object.entries(REGEX_PATTERNS.languages)
        .filter(([_, pattern]) => pattern.test(file.name))
        .map(([tag]) => tag);

    if (visualTags.includes("HDR10+")) {
        visualTags = visualTags.filter(
            (tag) => tag !== "HDR" && tag !== "HDR10"
        );
    } else if (visualTags.includes("HDR10")) {
        visualTags = visualTags.filter((tag) => tag !== "HDR");
    }

    return {
        id: file.id,
        name: file.name.trim(),
        size: file.size,
        formattedSize: formatSize(file.size),
        resolution: resolution,
        quality: quality,
        languages: languages,
        encode: encode,
        audioTags: audioTags,
        visualTags: visualTags,
    };
}

function formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1000;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function buildSearchQuery(streamRequest) {
    const { name, year } = streamRequest.metadata;

    let query =
        "trashed=false and mimeType contains 'video/' and not name contains 'trailer' and not name contains 'sample'";

    const nameQuery = name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(" ")
        .map((word) => `name contains '${word}'`)
        .join(" and ");
    const nameQueryWithApostrphes = name
        .replace(/[^a-zA-Z0-9\s']/g, "")
        .split(" ")
        .map((word) => `name contains '${word.replace(/'/g, "\\'")}'`)
        .join(" and ");
    const combinedNameQuery = name
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .split(" ")
        .join("");

    if (nameQuery === nameQueryWithApostrphes) {
        query += ` and ((${nameQuery} ) or (name contains '${combinedNameQuery}'))`;
    } else {
        query += ` and ((${nameQuery}) or (${nameQueryWithApostrphes}) or (name contains '${combinedNameQuery}'))`;
    }

    if (streamRequest.type === "movie") {
        return (
            query +
            ` and ${CONFIG.driveQueryTerms.movieYear} contains '${year}'`
        );
    }

    // handle query for shows
    const season = streamRequest.season;
    const episode = streamRequest.episode;
    if (!season || !episode) return query;

    const formats = [];
    let zeroPaddedSeason = season.toString().padStart(2, "0");
    let zeroPaddedEpisode = episode.toString().padStart(2, "0");

    const getFormats = (season, episode) => {
        return [
            [`s${season}e${episode}`],
            [`s${season}`, `e${episode}`],
            [`s${season}.e${episode}`],
            [`${season}x${episode}`],
            [`s${season}xe${episode}`],
            [`season ${season}`, `episode ${episode}`],
            [`s${season}`, `ep${episode}`],
        ];
    };

    formats.push(...getFormats(season, episode));

    if (zeroPaddedSeason !== season.toString()) {
        formats.push(...getFormats(zeroPaddedSeason, episode));
    }

    if (zeroPaddedEpisode !== episode.toString()) {
        formats.push(...getFormats(season, zeroPaddedEpisode));
    }

    if (
        zeroPaddedSeason !== season.toString() &&
        zeroPaddedEpisode !== episode.toString()
    ) {
        formats.push(...getFormats(zeroPaddedSeason, zeroPaddedEpisode));
    }

    query += ` and (${formats
        .map(
            (formatList) =>
                `(${formatList
                    .map(
                        (format) =>
                            `${CONFIG.driveQueryTerms.episodeFormat} contains '${format}'`
                    )
                    .join(" and ")})`
        )
        .join(" or ")})`;

    return query;
}
