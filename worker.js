var credentials = {
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "refresh_token": "YOUR_REFRESH_TOKEN",
};

// ================== IMPORTANT ================== //
// REPLACE THE ABOVE WITH THE CODE YOU GOT FROM THE GOOGLE
// OAUTH TOOL AT VIREN070'S GUIDES OR THE GOOGLE COLAB NOTEBOOK
// ================== IMPORTANT ================== //


const manifest = {
    id: 'stremio.gdrive.worker',
    version: '1.0.0',
    name: 'GDrive',     
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
const metadataUrl = "https://v3-cinemeta.strem.io/meta/{type}/{id}.json";

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
    const response = await fetch(metadataUrl.replace('{type}', type).replace('{id}', id));
    if (!response.ok) {
        return undefined;
    }
    const data = await response.json();
    if (!data || !data.meta) {
        return undefined;
    }
    return {
        name: data.meta.name,
        year: data.meta.year,
    }
}

async function getStreams(streamRequest) {
    const streams = [];
    const query = await buildSearchQuery(streamRequest);
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

    if (!results.files || results.files.length === 0) {
        return streams;
    }

    results.files.sort((a, b) => b.size - a.size);

    results.files.forEach((file) => {
        const parsedFile = parseFile(file);
        const name = `${manifest.name} ${parsedFile.resolution}`;
        let description = `${parsedFile.name}\nQuality: ${parsedFile.quality} ${parsedFile.encode}\nSize: ${parsedFile.size}`;
            
        if (parsedFile.visualTags.length > 0 || parsedFile.audio) {
            const tags = [...parsedFile.visualTags, parsedFile.audio];
            description += `\n${tags.join('|')}`;
        }
        streams.push({
            name: name,
            description: description,
            url: fileUrl.replace('{fileId}', file.id),
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
        "2160p": /4k|2160p|uhd/i,
        "1080p": /1080p|fhd/i,
        "720p": /720p|hd/i,
        "480p": /480p|sd/i,
    };

    const qualityPatterns = {
        "BluRay REMUX": /bluray[\.\-_]?remux|bd[\.\-_]?remux/i,
        "BDRip": /bd[\.\-_]?rip|bluray[\.\-_]?rip|br[\.\-_]?rip/i,
        "BluRay": /bluray|bd/i,
        "WEB-DL": /web[\.\-_]?dl|web[\.\-_]?dl/i,
        "WEBRip": /web[\.\-_]?rip|web[\.\-_]?rip/i,
        "WEB": /web/i,
        "CAM/TS": /cam|ts|telesync/i,
    };

    const visualTagsPatterns = {
        "HDR10+": /hdr10[\.\-_]?[\+]?|hdr10plus/i,
        "HDR10": /hdr10/i,
        "HDR": /hdr/i,
        "DV": /dolby[\.\-_]?vision|dolby[\.\-_]?vision[\.\-_]?atmos|dv/i,
        "IMAX": /imax/i,
    };

    const audioTagsPatterns = {
        "Atmos": /atmos/i,
        "DDP": /ddp|dolby[\.\-_]?digital[\.\-_]?plus/i,
        "DD": /dd|dolby[\.\-_]?digital/i,
        "DTS-HD": /dts[\.\-_]?hd[\.\-_]?ma/i,
        "DTS": /dts/i,
        "TrueHD": /truehd/i,
    };

    const encodeTagsPatterns = {
        "x265": /x265|h265|hevc/i,
        "x264": /x264|h264|avc/i,
    };

    let resolution = Object.entries(resolutionPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let quality = Object.entries(qualityPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "Unknown";
    let visualTags = Object.entries(visualTagsPatterns).filter(([_, pattern]) => pattern.test(file.name)).map(([tag]) => tag);
    let audio = Object.entries(audioTagsPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "";
    let encode = Object.entries(encodeTagsPatterns).find(([_, pattern]) => pattern.test(file.name))?.[0] || "";

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
        size: formattedSize,
        resolution: resolution,
        quality: quality,
        audio: audio,
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
    name.split(" ").forEach(word => {
        query += ` and name contains '${word.replace("'", "\\'")}'`;
    });

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