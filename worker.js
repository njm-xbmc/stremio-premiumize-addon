var credentials = {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "YOUR_REFRESH_TOKEN",
};

const CREDENTIALS = {
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
    refreshToken: credentials.refresh_token,
};

const CONFIG = {
    resolutions: ["2160p", "1080p", "720p", "480p", "Unknown"],
    qualities: ["BluRay REMUX", "BDRip", "BluRay", "HDRip", "WEB-DL", "WEBRip", "WEB", "CAM/TS", "Unknown"], 
    sortBy: ["resolution", "size"], 
    name: "GDrive",
    prioritiseLanguage: null,     // set to null to disable, otherwise valid values can be found in the languageTagsPatterns object in the parseFile function
}

const MANIFEST = {
    id: 'stremio.gdrive.worker',
    version: '1.0.0',
    name: CONFIG.name,     
    description: 'Stream your files from Google Drive within Stremio!',
    catalogs: [],
    resources: ['stream'],
    types: ['movie', 'series'],
};

const HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
};

const API_ENDPOINTS = {
    "driveFetchFiles": "https://content.googleapis.com/drive/v3/files",
    "driveStreamFile": "https://www.googleapis.com/drive/v3/files/{fileId}?alt=media",
    "driveToken": "https://oauth2.googleapis.com/token",
    "cinemeta": "https://v3-cinemeta.strem.io/meta/{type}/{id}.json",
    "imdbSuggest": "https://v3.sg.media-imdb.com/suggestion/a/{id}.json",

}

const REGEX_PATTERNS = {
    validRequest: /\/stream\/(movie|series)\/([a-zA-Z0-9%:]+)\.json/,
    resolutions: {
        "2160p": /(?:\[)?\b(_?4k|_?2160p|_?uhd_?)\b(?:\])?/i,
        "1080p": /(?:\[)?\b(_?1080p|_?fhd_?)\b(?:\])?/i,
        "720p": /(?:\[)?\b(_?720p|_?hd_?)\b(?:\])?/i,
        "480p": /(?:\[)?\b(_?480p|_?sd_?)\b(?:\])?/i,
    },
    qualities: {
        "BluRay REMUX": /(?:\[)?\b(_?bluray[\.\-_]?remux|_?bd[\.\-_]?remux_?)\b(?:\])?/i,
        "BDRip": /(?:\[)?\b(_?bd[\.\-_]?rip|_?bluray[\.\-_]?rip|_?br[\.\-_]?rip_?)\b(?:\])?/i,
        "BluRay": /(?:\[)?\b(_?bluray|_?bd_?)\b(?:\])?/i,
        "HDRip": /(?:\[)?\b(_?hd[\.\-_]?rip|_?hdrip_?)\b(?:\])?/i,
        "WEB-DL": /(?:\[)?\b(_?web[\.\-_]?dl|_?web[\.\-_]?dl_?)\b(?:\])?/i,
        "WEBRip": /(?:\[)?\b(_?web[\.\-_]?rip|_?web[\.\-_]?rip_?)\b(?:\])?/i,
        "WEB": /(?:\[)?\b(_?web_?)\b(?:\])?/i,
        "CAM/TS": /(?:\[)?\b(_?cam|_?ts|_?telesync|_?hdts|_?hdtc|_?telecine_?)\b(?:\])?/i,
    },
    visualTags: {
        "HDR10+": /(?:\[)?\b(_?hdr10[\.\-_]?[\+]?|_?hdr10plus_?)\b(?:\])?/i,
        "HDR10": /(?:\[)?\b(_?hdr10_?)\b(?:\])?/i,
        "HDR": /(?:\[)?\b(_?hdr_?)\b(?:\])?/i,
        "DV": /(?:\[)?\b(_?dolby[\.\-_]?vision|_?dolby[\.\-_]?vision[\.\-_]?atmos|_?dv_?)\b(?:\])?/i,
        "IMAX": /(?:\[)?\b(_?imax_?)\b(?:\])?/i,
    },
    audioTags: {
        "Atmos": /(?:\[)?\b(_?atmos_?)\b(?:\])?/i,
        "DDP5.1": /(?:\[)?\b(_?ddp5\.1|_?dolby[\.\-_]?digital[\.\-_]?plus[\.\-_]?5\.1_?)\b(?:\])?/i,
        "DDP": /(?:\[)?\b(_?ddp|_?dolby[\.\-_]?digital[\.\-_]?plus_?)\b(?:\])?/i,
        "DD": /(?:\[)?\b(_?dd|_?dolby[\.\-_]?digital_?)\b(?:\])?/i,
        "DTS-HD": /(?:\[)?\b(_?dts[\.\-_]?hd[\.\-_]?ma_?)\b(?:\])?/i,
        "DTS": /(?:\[)?\b(_?dts_?)\b(?:\])?/i,
        "TrueHD": /(?:\[)?\b(_?truehd_?)\b(?:\])?/i,
        "5.1": /(?:\[)?\b(_?5\.1_?)\b(?:\])?/i,
        "7.1": /(?:\[)?\b(_?7\.1_?)\b(?:\])?/i,
    },
    encodes: {
        "x265": /(?:\[)?\b(_?x265|_?h265|_?hevc|_?h\.265_?)\b(?:\])?/i,
        "x264": /(?:\[)?\b(_?x264|_?h264|_?avc|_?h\.264_?)\b(?:\])?/i,
    },
    languages: {
        "English": /(?:\[)?\b(_?english|_?eng_?)\b(?:\])?/i,
        "Hindi": /(?:\[)?\b(_?hindi|_?hin_?)\b(?:\])?/i,
        "Tamil": /(?:\[)?\b(_?tamil|_?tam_?)\b(?:\])?/i,
        "Telugu": /(?:\[)?\b(_?telugu_?)\b(?:\])?/i,
        "Malayalam": /(?:\[)?\b(_?malayalam_?)\b(?:\])?/i,
        "Kannada": /(?:\[)?\b(_?kannada_?)\b(?:\])?/i,
        "Bengali": /(?:\[)?\b(_?bengali_?)\b(?:\])?/i,
        "Punjabi": /(?:\[)?\b(_?punjabi_?)\b(?:\])?/i,
        "Marathi": /(?:\[)?\b(_?marathi_?)\b(?:\])?/i,
        "French": /(?:\[)?\b(_?french|_?fra_?)\b(?:\])?/i,
        "Spanish": /(?:\[)?\b(_?spanish|_?spa_?)\b(?:\])?/i,
        "German": /(?:\[)?\b(_?german|_?deu_?)\b(?:\])?/i,
        "Italian": /(?:\[)?\b(_?italian|_?ita_?)\b(?:\])?/i,
        "Japanese": /(?:\[)?\b(_?japanese|_?jpn_?)\b(?:\])?/i,
        "Korean": /(?:\[)?\b(_?korean|_?kor_?)\b(?:\])?/i,
        "Chinese": /(?:\[)?\b(_?chinese|_?chn_?)\b(?:\])?/i,
    }
}


const createJsonResponse = (data, status=200) => new Response(JSON.stringify(data, null, 4), { headers: HEADERS, status: status });

const validateConfig = () => {
    const requiredFields = [
        { value: CREDENTIALS.clientId, error: "Missing client_id" },
        { value: CREDENTIALS.clientSecret, error: "Missing client_secret" },
        { value: CREDENTIALS.refreshToken, error: "Missing refresh_token" },
        { value: CONFIG.name, error: "Missing addon name" },
    ];

    for (const { value, error } of requiredFields) {
        if (!value) {
            console.error(error);
            return false;
        }
    }

    const validValues = {
        resolutions: [...Object.keys(REGEX_PATTERNS.resolutions), "Unknown"],
        qualities: [...Object.keys(REGEX_PATTERNS.qualities), "Unknown"],
        sortBy: ["resolution", "size"],
        languages: [...Object.keys(REGEX_PATTERNS.languages), "Unknown"],
    };

    for (const key of ["resolutions", "qualities", "sortBy"]) {
        for (const value of CONFIG[key]) {
            if (!validValues[key].includes(value)) {
                console.error(`Invalid ${key.slice(0, -1)}: ${value}`);
                return false;
            }
        }
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
        const response = await fetch(API_ENDPOINTS.driveToken, {
            method: "POST",
            body: params,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        if (!response.ok) {
            let err = await response.text();
            throw new Error('Failed to refresh token, ' + err);
        }

        const { access_token } = await response.json();
        return access_token;
    } catch (error) {
        console.error("Error refreshing token:", error);
        return undefined;
    }
};

export default {
    async fetch(request) {
        return handleRequest(request);
    }
}
async function handleRequest(request) {
    try {
        const url = new URL(decodeURIComponent(request.url).replace('%3A', ':'));

        if (url.pathname === '/manifest.json') return createJsonResponse(MANIFEST);

        if (url.pathname === '/') return Response.redirect(url.origin + '/manifest.json', 301);
        
        const streamMatch = url.pathname.match(REGEX_PATTERNS.validRequest);

        if (!streamMatch) return new Response('Bad Request', { status: 400 });
        
        if (validateConfig() === false) {
            return createJsonResponse({ 
                streams: [{
                    name: MANIFEST.name,
                    description: 'Invalid configuration, please enable and check the logs for more information',
                    externalUrl: '/'
                }],
            });
        }

        const type = streamMatch[1];
        const [imdbId, season, episode] = streamMatch[2].split(':');
        
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
        return createJsonResponse({ streams: streams });
    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function getMetadata(type, id) {
    let meta;

    try {
        meta = await getCinemetaMeta(type, id);
        if (meta) {
            console.log('Successfully retrieved metadata from Cinemeta:', meta.name, meta.year);    
            return meta;
        }
    } catch (error) {
        console.error('Error fetching metadata from Cinemeta:', error);
    }

    try {
        meta = await getImdbSuggestionMeta(type, id);
        if (meta) {
            console.log('Successfully retrieved metadata from IMDb Suggestions:', meta.name, meta.year);
            return meta;
        }
    } catch (error) {
        console.error('Error fetching metadata from IMDb Suggestions:', error);
    }

    console.error('Failed to get metadata');
    return null;
}

async function getCinemetaMeta(type, id) {
    const response = await fetch(API_ENDPOINTS.cinemeta.replace('{type}', type).replace('{id}', id));
    if (!response.ok) {
        let err = await response.text();
        throw new Error('Failed to get metadata, ' + err);
    }
    const data = await response.json();
    if (!data || !data.meta) {
        throw new Error('Failed to get metadata, the response was empty');
    }
    if (!data.meta.name || !data.meta.year) {
        throw new Error('Failed to get metadata, could not find name or year');
    }
    return {
        name: data.meta.name,
        year: data.meta.year,
    }
}

async function getImdbSuggestionMeta(type, id) {
    const response = await fetch(API_ENDPOINTS.imdbSuggest.replace('{id}', id));
    if (!response.ok) {
        let err = await response.text();
        throw new Error('Failed to get metadata, ' + err);
    }
    const data = await response.json();
    if (!data || !data.d) {
        throw new Error('Failed to get metadata, the response was empty');
    }
    
    const item = data.d.find(item => item.id === id);

    if (!item || !item.l || !item.q) {
        throw new Error('Failed to get metadata, could not find name or year');
    }
    
    return {
        name: item.l,
        year: item.q,
    }
}


async function getStreams(streamRequest) {
    const streams = [];
    const query = await buildSearchQuery(streamRequest);
    console.log("Final Query:", query);
    const queryParams = {
        q: query,
        corpora: 'allDrives',
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true',
        pageSize: '1000',
        fields: 'files(id,name,size)',
    };

    const fetchUrl = new URL(API_ENDPOINTS.driveFetchFiles);
    fetchUrl.search = new URLSearchParams(queryParams).toString();

    const token = await refreshToken();

    if (!token) {
        return [{
            name: MANIFEST.name,
            description: 'Failed to get access token',
            externalUrl: '/'
        }];
    }

    const response = await fetch(fetchUrl.toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });

    const results = await response.json();

    console.log("Results:", results);

    if (!results.files || results.files.length === 0) {
        return streams;
    }

    const resolutionOrder = CONFIG.resolutions;
    const qualityOrder = CONFIG.qualities;

    const parsedFiles = results.files.map(file => {
        const parsedFile = parseFile(file);
        return { ...parsedFile, file };
    }).filter(parsedFile => 
        resolutionOrder.includes(parsedFile.resolution) && 
        qualityOrder.includes(parsedFile.quality)
    );

    // Sort based on the sortBy fields in the order given
    // move any files with the prioritised language to the front
    parsedFiles.sort((a, b) => {

        if (CONFIG.prioritiseLanguage) {
            const aHasPrioritisedLanguage = a.languageTags.includes(CONFIG.prioritiseLanguage);
            const bHasPrioritisedLanguage = b.languageTags.includes(CONFIG.prioritiseLanguage);
            if (aHasPrioritisedLanguage && !bHasPrioritisedLanguage) return -1;
            if (!aHasPrioritisedLanguage && bHasPrioritisedLanguage) return 1;
        }
        for (const sortByField of CONFIG.sortBy) {
            if (sortByField === "resolution") {
                const resolutionComparison = resolutionOrder.indexOf(a.resolution) - resolutionOrder.indexOf(b.resolution);
                if (resolutionComparison !== 0) {
                    return resolutionComparison;
                }
            } else if (sortByField === "size") {
                const sizeComparison = b.size - a.size;
                if (sizeComparison !== 0) {
                    return sizeComparison;
                }
            }
        }
        return 0;
    });


    parsedFiles.forEach(parsedFile => {
        let name = `${MANIFEST.name}\n${parsedFile.resolution}`;
        if (parsedFile.visualTags.length > 0) {
            name += `\n${parsedFile.visualTags.join(' | ')}`;
        }
        let description = `Quality: ${parsedFile.quality} ${parsedFile.encode}\nSize: ${parsedFile.formattedSize}${parsedFile.languageTags.length > 0 ? `\nLanguages: ${parsedFile.languageTags.join(', ')}` : ''}\nName: ${parsedFile.name}`;
        
        if (parsedFile.audioTags.length > 0) {
            description += `\n${parsedFile.audioTags.join(' | ')}`;
        }
        streams.push({
            name: name,
            description: description,
            url: API_ENDPOINTS.driveStreamFile.replace('{fileId}', parsedFile.id),
            behaviorHints: {
                notWebReady: true,
                proxyHeaders: {
                    request: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                },
            },
        });
    });

    return streams;
}

function parseFile(file) {


    let resolution = Object.entries(REGEX_PATTERNS.resolutions).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let quality = Object.entries(REGEX_PATTERNS.qualities).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let visualTags = Object.entries(REGEX_PATTERNS.visualTags).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);
    let audioTags = Object.entries(REGEX_PATTERNS.audioTags).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);
    let encode = Object.entries(REGEX_PATTERNS.encodes).find(([_, pattern]) => pattern.test(file.name))?.[0] || "";
    let languageTags = Object.entries(REGEX_PATTERNS.languages).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);

    if (visualTags.includes("HDR10+")) {
        visualTags = visualTags.filter(tag => tag !== "HDR" && tag !== "HDR10");
    } else if (visualTags.includes("HDR10")) {
        visualTags = visualTags.filter(tag => tag !== "HDR");
    }

    if (languageTags.length === 0) {
        languageTags.push("Unknown");
    }

    const formattedSize = file.size > 1000 * 1000 * 1000 
        ? `${(file.size / (1000 * 1000 * 1000)).toFixed(2)} GB` 
        : `${(file.size / (1000 * 1000)).toFixed(2)} MB`;

    return {
        id: file.id,
        name: file.name.trim(),
        formattedSize: formattedSize,
        size: file.size,
        resolution: resolution,
        quality: quality,
        audioTags: audioTags,
        languageTags: languageTags,
        encode: encode,
        visualTags: visualTags,
    };
}



async function buildSearchQuery(streamRequest) {
    const { name, year } = streamRequest.metadata;

    let query = "trashed=false and mimeType contains 'video/' and not name contains 'trailer' and not name contains 'sample'";

    const nameQuery = name.replace(/[^a-zA-Z0-9\s]/g, '').split(' ').map(word => `name contains '${word}'`).join(" and ");
    const nameQueryWithApostrphes = name.replace(/[^a-zA-Z0-9\s']/g, '').split(' ').map(word => `name contains '${word.replace(/'/g, "\\'")}'`).join(" and ");
    const combinedNameQuery = name.replace(/[^a-zA-Z0-9\s]/g, '').split(' ').join("")

    if (nameQuery === nameQueryWithApostrphes) {
        query += ` and ((${nameQuery} ) or (name contains '${combinedNameQuery}'))`;
    } else {
        query += ` and ((${nameQuery}) or (${nameQueryWithApostrphes}) or (name contains '${combinedNameQuery}'))`;
    }

    if (streamRequest.type === "movie") {
        return query + ` and fullText contains '${year}'`;
    } 

    // handle query for shows
    const season = streamRequest.season;
    const episode = streamRequest.episode;
    if (!season || !episode) return query;

    const formats = [];
    let zeroPaddedSeason = season.toString().padStart(2, '0');
    let zeroPaddedEpisode = episode.toString().padStart(2, '0');
    
    const getFormats = (season, episode) => {
        return [
            [`s${season}e${episode}`], [`s${season}`, `e${episode}`], [`s${season}.e${episode}`], [`${season}x${episode}`], [`s${season}xe${episode}`]
        ];
    }

    formats.push(...getFormats(season, episode));
    
    if (zeroPaddedSeason !== season.toString()) {
        formats.push(...getFormats(zeroPaddedSeason, episode));
    }
    
    if (zeroPaddedEpisode !== episode.toString()) {
        formats.push(...getFormats(season, zeroPaddedEpisode));
    }
    
    if (zeroPaddedSeason !== season.toString() || zeroPaddedEpisode !== episode.toString()) {
        formats.push(...getFormats(zeroPaddedSeason, zeroPaddedEpisode));
    }

    query += ` and (${formats.map(formatList => `(${formatList.map(format => `fullText contains '${format}'`).join(" and ")})`).join(" or ")})`;
    
    return query;
}