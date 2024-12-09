var credentials = {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "YOUR_REFRESH_TOKEN",
};

// ================== IMPORTANT ================== //
// REPLACE THE ABOVE WITH THE CODE YOU GOT FROM THE GOOGLE
// OAUTH TOOL AT VIREN070'S GUIDES OR THE GOOGLE COLAB NOTEBOOK
// ================== IMPORTANT ================== //

// ================== CONFIG ================== //
// You can change the order of and remove the resolution fields. 
// You can remove certain qualities if you don't want them.
// You can change the order of the sortBy fields.
// You can change the name of the addon that appears in Stremio.

const config = {
    resolutions: ["2160p", "1080p", "720p", "480p", "Unknown"],
    qualities: ["BluRay REMUX", "BDRip", "BluRay", "HDRip", "WEB-DL", "WEBRip", "WEB", "CAM/TS", "Unknown"], 
    sortBy: ["resolution", "size"], 
    name: "GDrive",
}

// ================== CONFIG ================== //


const manifest = {
    id: 'stremio.gdrive.worker',
    version: '1.0.0',
    name: config.name,     
    description: 'Stream your files from Google Drive within Stremio!',
    catalogs: [],
    resources: ['stream'],
    types: ['movie', 'series'],
};

const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
};

const fetchFilesUrl = "https://content.googleapis.com/drive/v3/files";
const fileUrl = "https://www.googleapis.com/drive/v3/files/{fileId}?alt=media";
const tokenUrl = "https://oauth2.googleapis.com/token";
const cinemetaUrl = "https://v3-cinemeta.strem.io/meta/{type}/{id}.json";
const liveCinemetaUrl = "https://cinemeta-live.strem.io/meta/{type}/{id}.json"
const imdbSuggestUrl = "https://v3.sg.media-imdb.com/suggestion/a/{id}.json";

export default {
    async fetch(request) {
        return handleRequest(request);
    }
}
async function handleRequest(request) {
    try {
        const url = new URL(decodeURIComponent(request.url).replace('%3A', ':'));

        if (url.pathname === '/manifest.json') {
            return getJSONResponse(manifest);
        }

        if (url.pathname === '/') {
            return Response.redirect(url.origin + '/manifest.json', 301);
        }
        
        const streamRegex = /\/stream\/(movie|series)\/([a-zA-Z0-9%:]+)\.json/;
        const streamMatch = url.pathname.match(streamRegex);

        if (!streamMatch) {
            return new Response('Bad Request', { status: 400 });
        }

        const type = streamMatch[1];
        const [imdbId, season, episode] = streamMatch[2].split(':');
        
        const metadata = await getMetadata(type, imdbId);

        if (!metadata) {
            console.error("Failed to get metadata for", type, imdbId);
            return getJSONResponse({ streams: [] });
        }

        const parsedStreamRequest = {
            type: type,
            id: imdbId,
            season: parseInt(season) || undefined,
            episode: parseInt(episode) || undefined,
            metadata: metadata,
        };

        const streams = await getStreams(parsedStreamRequest);
        return getJSONResponse({ streams: streams });
    } catch (error) {
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

function getJSONResponse(data) {
    return new Response(JSON.stringify(data, null, 4), { headers: headers });
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
    return Promise.reject('Failed to get metadata');
}

async function getCinemetaMeta(type, id) {
    const response = await fetch(cinemetaUrl.replace('{type}', type).replace('{id}', id));
    if (!response.ok) {
        let err = await response.text();
        return Promise.reject('Failed to get metadata, ' + err);
    }
    const data = await response.json();
    if (!data || !data.meta) {
        return Promise.reject('Failed to get metadata, the response was empty');
    }
    if (!data.meta.name || !data.meta.year) {
        return Promise.reject('Failed to get metadata, could not find name or year');
    }
    return {
        name: data.meta.name,
        year: data.meta.year,
    }
}

async function getImdbSuggestionMeta(type, id) {
    const response = await fetch(imdbSuggestUrl.replace('{id}', id));
    if (!response.ok) {
        let err = await response.text();
        return Promise.reject('Failed to get metadata, ' + err);
    }
    const data = await response.json();
    if (!data || !data.d) {
        return Promise.reject('Failed to get metadata, the response was empty');
    }

    if (data.q !== id) {
        return Promise.reject('Failed to get metadata, the response was not for the correct id');
    }

    if (!data.d[0].l || !data.d[0].y) {
        return Promise.reject('Failed to get metadata, could not find name or year');
    }

    return {
        name: data.d[0].l,
        year: data.d[0].y,
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

    const fetchUrl = new URL(fetchFilesUrl);
    fetchUrl.search = new URLSearchParams(queryParams).toString();

    const token = await refreshToken(credentials);

    if (!token) {
        return [{
            name: manifest.name,
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

    const resolutionOrder = config.resolutions;
    const qualityOrder = config.qualities;

    const parsedFiles = results.files.map(file => {
        const parsedFile = parseFile(file);
        return { ...parsedFile, file };
    }).filter(parsedFile => 
        resolutionOrder.includes(parsedFile.resolution) && 
        qualityOrder.includes(parsedFile.quality)
    );

    // Sort based on the sortBy fields in the order given
    parsedFiles.sort((a, b) => {
        for (const sortByField of config.sortBy) {
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
        let name = `${manifest.name}\n${parsedFile.resolution}`;
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
            url: fileUrl.replace('{fileId}', parsedFile.id),
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
    const resolutionPatterns = {
        "2160p": /(?:\[)?\b(4k|2160p|uhd)\b(?:\])?/i,
        "1080p": /(?:\[)?\b(1080p|fhd)\b(?:\])?/i,
        "720p": /(?:\[)?\b(720p|hd)\b(?:\])?/i,
        "480p": /(?:\[)?\b(480p|sd)\b(?:\])?/i,
    };

    const qualityPatterns = {
        "BluRay REMUX": /(?:\[)?\b(bluray[\.\-_]?remux|bd[\.\-_]?remux)\b(?:\])?/i,
        "BDRip": /(?:\[)?\b(bd[\.\-_]?rip|bluray[\.\-_]?rip|br[\.\-_]?rip)\b(?:\])?/i,
        "BluRay": /(?:\[)?\b(bluray|bd)\b(?:\])?/i,
        "HDRip": /(?:\[)?\b(hd[\.\-_]?rip|hdrip)\b(?:\])?/i,
        "WEB-DL": /(?:\[)?\b(web[\.\-_]?dl|web[\.\-_]?dl)\b(?:\])?/i,
        "WEBRip": /(?:\[)?\b(web[\.\-_]?rip|web[\.\-_]?rip)\b(?:\])?/i,
        "WEB": /(?:\[)?\b(web)\b(?:\])?/i,
        "CAM/TS": /(?:\[)?\b(cam|ts|telesync|hdts|hdtc|telecine)\b(?:\])?/i,
    };

    const visualTagsPatterns = {
        "HDR10+": /(?:\[)?\b(hdr10[\.\-_]?[\+]?|hdr10plus)\b(?:\])?/i,
        "HDR10": /(?:\[)?\b(hdr10)\b(?:\])?/i,
        "HDR": /(?:\[)?\b(hdr)\b(?:\])?/i,
        "DV": /(?:\[)?\b(dolby[\.\-_]?vision|dolby[\.\-_]?vision[\.\-_]?atmos|dv)\b(?:\])?/i,
        "IMAX": /(?:\[)?\b(imax)\b(?:\])?/i,
    };

    const audioTagsPatterns = {
        "Atmos": /(?:\[)?\b(atmos)\b(?:\])?/i,
        "DDP5.1": /(?:\[)?\b(ddp5\.1|dolby[\.\-_]?digital[\.\-_]?plus[\.\-_]?5\.1)\b(?:\])?/i,
        "DDP": /(?:\[)?\b(ddp|dolby[\.\-_]?digital[\.\-_]?plus)\b(?:\])?/i,
        "DD": /(?:\[)?\b(dd|dolby[\.\-_]?digital)\b(?:\])?/i,
        "DTS-HD": /(?:\[)?\b(dts[\.\-_]?hd[\.\-_]?ma)\b(?:\])?/i,
        "DTS": /(?:\[)?\b(dts)\b(?:\])?/i,
        "TrueHD": /(?:\[)?\b(truehd)\b(?:\])?/i,
        "5.1": /(?:\[)?\b(5\.1)\b(?:\])?/i,
        "7.1": /(?:\[)?\b(7\.1)\b(?:\])?/i,
    };

    const languageTagsPatterns = {
        "English": /(?:\[)?\b(english|eng)\b(?:\])?/i,
        "Hindi": /(?:\[)?\b(hindi|hin)\b(?:\])?/i,
        "Tamil": /(?:\[)?\b(tamil|tam)\b(?:\])?/i,
        "Telugu": /(?:\[)?\b(telugu)\b(?:\])?/i,
        "Malayalam": /(?:\[)?\b(malayalam)\b(?:\])?/i,
        "Kannada": /(?:\[)?\b(kannada)\b(?:\])?/i,
        "Bengali": /(?:\[)?\b(bengali)\b(?:\])?/i,
        "Punjabi": /(?:\[)?\b(punjabi)\b(?:\])?/i,
        "Marathi": /(?:\[)?\b(marathi)\b(?:\])?/i,
        "French": /(?:\[)?\b(french|fra)\b(?:\])?/i,
        "Spanish": /(?:\[)?\b(spanish|spa)\b(?:\])?/i,
        "German": /(?:\[)?\b(german|deu)\b(?:\])?/i,
        "Italian": /(?:\[)?\b(italian|ita)\b(?:\])?/i,
        "Japanese": /(?:\[)?\b(japanese|jpn)\b(?:\])?/i,
        "Korean": /(?:\[)?\b(korean|kor)\b(?:\])?/i,
        "Chinese": /(?:\[)?\b(chinese|chn)\b(?:\])?/i,
    };

    const encodeTagsPatterns = {
        "x265": /(?:\[)?\b(x265|h265|hevc|h\.265)\b(?:\])?/i,
        "x264": /(?:\[)?\b(x264|h264|avc|h\.265)\b(?:\])?/i,
    };

    let resolution = Object.entries(resolutionPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let quality = Object.entries(qualityPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let visualTags = Object.entries(visualTagsPatterns).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);
    let audioTags = Object.entries(audioTagsPatterns).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);
    let encode = Object.entries(encodeTagsPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "";
    let languageTags = Object.entries(languageTagsPatterns).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);

    if (visualTags.includes("HDR10+")) {
        visualTags = visualTags.filter(tag => tag !== "HDR" && tag !== "HDR10");
    } else if (visualTags.includes("HDR10")) {
        visualTags = visualTags.filter(tag => tag !== "HDR");
    }

    const formattedSize = file.size > 1024 * 1024 * 1024 
        ? `${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB` 
        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

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

async function refreshToken(credentials) {
    const params = new URLSearchParams({
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        refresh_token: credentials.refresh_token,
        grant_type: "refresh_token",
    });

    const response = await fetch(tokenUrl, {
        method: "POST",
        body: params,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) {
        return undefined;
    }

    const data = await response.json();
    return data.access_token;
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

    query += ` and (${formats.map(formatList => `(${formatList.map(format => `name contains '${format}'`).join(" and ")})`).join(" or ")})`;
    
    return query;
}