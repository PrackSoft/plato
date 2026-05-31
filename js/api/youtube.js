import { API_KEY } from '../config.js';

const MAX_RESULTS_PER_PAGE = 50;

export async function searchYouTube(query, channelId = null, order = 'relevance', duration = 'long', categoryFilter = 'movies') {
    if (!query || query.trim() === "") {
        throw new Error("Search query cannot be empty");
    }
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${MAX_RESULTS_PER_PAGE}&q=${encodeURIComponent(query)}&key=${API_KEY}`;
    
    if (channelId) {
        url += `&channelId=${channelId}`;
    }
    
    if (order && order !== 'relevance') {
        url += `&order=${order}`;
    }
    
    // Corrección: paréntesis alrededor de toda la condición
    if (duration === 'long' || duration === 'medium' || duration === 'short') {
        url += `&videoDuration=${duration}`;
    }
    // Si duration es 'any', no se añade parámetro
    
    // Filtrar solo películas (categoryId 30) si está activado
    if (categoryFilter === 'movies') {
        url += `&videoCategoryId=30`;
    }
    
    const searchResponse = await fetch(url);
    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) return [];

    const videoIds = searchData.items.map(item => item.id.videoId).filter(id => id);
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=${videoIds.join(',')}&key=${API_KEY}`;
    const videosResponse = await fetch(videosUrl);
    const videosData = await videosResponse.json();

    const detailsMap = new Map();
    if (videosData.items) {
        videosData.items.forEach(video => {
            detailsMap.set(video.id, {
                fullDescription: video.snippet.description,
                tags: video.snippet.tags || [],
                viewCount: video.statistics?.viewCount || 'Unknown',
                likeCount: video.statistics?.likeCount || 'Unknown',
                commentCount: video.statistics?.commentCount || 'Unknown',
                duration: video.contentDetails?.duration || 'Unknown',
                channelId: video.snippet.channelId,
                channelTitle: video.snippet.channelTitle,
                title: video.snippet.title,
                publishedAt: video.snippet.publishedAt,
                thumbnails: video.snippet.thumbnails,
                categoryId: video.snippet.categoryId || 'Unknown',
                defaultLanguage: video.snippet.defaultLanguage || 'Unknown',
                defaultAudioLanguage: video.snippet.defaultAudioLanguage || 'Unknown',
                dimension: video.contentDetails.dimension || 'Unknown',
                definition: video.contentDetails.definition || 'Unknown',
                caption: video.contentDetails.caption || 'Unknown',
                licensedContent: video.contentDetails.licensedContent !== undefined ? video.contentDetails.licensedContent : 'Unknown',
                projection: video.contentDetails.projection || 'Unknown',
                publicStatsViewable: video.status.publicStatsViewable !== undefined ? video.status.publicStatsViewable : 'Unknown',
                madeForKids: video.status.madeForKids !== undefined ? video.status.madeForKids : 'Unknown',
                selfDeclaredMadeForKids: video.status.selfDeclaredMadeForKids !== undefined ? video.status.selfDeclaredMadeForKids : 'Unknown'
            });
        });
    }

    const enrichedItems = searchData.items.map(item => {
        const videoId = item.id.videoId;
        const extra = detailsMap.get(videoId) || {};
        return {
            youtubeId: videoId,
            title: extra.title || item.snippet.title,
            channelId: extra.channelId || item.snippet.channelId,
            channelTitle: extra.channelTitle || item.snippet.channelTitle,
            imageUrl: extra.thumbnails?.medium?.url || item.snippet.thumbnails.medium.url,
            url: `https://youtube.com/watch?v=${videoId}`,
            description: extra.fullDescription || item.snippet.description,
            publishedAt: extra.publishedAt || item.snippet.publishedAt,
            duration: extra.duration,
            viewCount: extra.viewCount,
            likeCount: extra.likeCount,
            commentCount: extra.commentCount,
            tags: extra.tags,
            categoryId: extra.categoryId,
            defaultLanguage: extra.defaultLanguage,
            defaultAudioLanguage: extra.defaultAudioLanguage,
            dimension: extra.dimension,
            definition: extra.definition,
            caption: extra.caption,
            licensedContent: extra.licensedContent,
            projection: extra.projection,
            publicStatsViewable: extra.publicStatsViewable,
            madeForKids: extra.madeForKids,
            selfDeclaredMadeForKids: extra.selfDeclaredMadeForKids
        };
    });
    return enrichedItems;
}