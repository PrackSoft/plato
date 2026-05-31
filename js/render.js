// js/render.js (con agrupación para Collection)
import { toggleWatching } from './db.js';

function formatNumber(num) {
    if (num === undefined || num === null || num === 'N/A') return 'N/A';
    let n = parseInt(num, 10);
    if (isNaN(n)) return num;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function getLocalDateKey(utcDateString) {
    const date = new Date(utcDateString);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function renderMovies(container, movies, title, source = 'main', currentSort = 'date', onSortChange = null, groupBy = null) {
    if (!movies.length) {
        container.innerHTML = `<div class="stats">No movies ${source === 'trash' ? 'in trash' : 'saved yet'}.</div>`;
        return;
    }

    let sorted = [...movies];
    let isGrouped = false;
    let groups = null;

    // Si estamos en Collection con un grupo específico (no 'all')
    if (source === 'collections' && groupBy && groupBy !== 'all') {
        isGrouped = true;
        // Agrupar por el primer valor del campo correspondiente
        const groupMap = new Map();
        for (const movie of movies) {
            let groupValue = '';
            if (groupBy === 'directors') groupValue = movie.directors && movie.directors[0] ? movie.directors[0] : 'Unknown';
            else if (groupBy === 'actors') groupValue = movie.actors && movie.actors[0] ? movie.actors[0] : 'Unknown';
            else if (groupBy === 'genres') groupValue = movie.genres && movie.genres[0] ? movie.genres[0] : 'Unknown';
            else if (groupBy === 'years') groupValue = movie.years && movie.years[0] ? movie.years[0] : 'Unknown';
            else if (groupBy === 'countries') groupValue = movie.countries && movie.countries[0] ? movie.countries[0] : 'Unknown';
            else if (groupBy === 'languages') groupValue = movie.languages && movie.languages[0] ? movie.languages[0] : 'Unknown';
            
            if (!groupMap.has(groupValue)) groupMap.set(groupValue, []);
            groupMap.get(groupValue).push(movie);
        }
        // Ordenar grupos alfabéticamente
        groups = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        // Dentro de cada grupo, ordenar según currentSort
        for (const [key, movieList] of groups) {
            movieList.sort((a, b) => {
                switch (currentSort) {
                    case 'title': return a.title.localeCompare(b.title);
                    case 'channel': return a.channelTitle.localeCompare(b.channelTitle);
                    case 'mostLiked': return (parseInt(b.likeCount) || 0) - (parseInt(a.likeCount) || 0);
                    case 'mostCommented': return (parseInt(b.commentCount) || 0) - (parseInt(a.commentCount) || 0);
                    case 'watching': return (b.watching ? 1 : 0) - (a.watching ? 1 : 0);
                    case 'favorite': return (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
                    default: return new Date(b.dateSaved) - new Date(a.dateSaved);
                }
            });
        }
    } else {
        sorted = sortMovies(movies, currentSort);
    }

    const isDateSort = (currentSort === 'date' && !isGrouped);
    const isCollectionSort = (currentSort === 'collections');

    const sortOptions = [
        { value: 'date', label: 'Date' },
        { value: 'title', label: 'Title' },
        { value: 'channel', label: 'Channel' },
        { value: 'mostLiked', label: 'Most liked' },
        { value: 'mostCommented', label: 'Most commented' },
        { value: 'watching', label: 'Watching' },
        { value: 'favorite', label: 'Favorites' }
    ];
    const sortSelectHtml = `
        <div class="sort-control">
            <label>Sort by:</label>
            <select id="sortSelect">
                ${sortOptions.map(opt => `<option value="${opt.value}" ${currentSort === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
        </div>
    `;

    function generateCard(movie) {
        return `
            <div class="video-card" data-id="${String(movie.youtubeId)}">
                <img src="${movie.imageUrl}" alt="${movie.title}">
                <div class="info">
                    <h3>${escapeHtml(movie.title)}</h3>
                    <div class="channel">${escapeHtml(movie.channelTitle)}</div>
                    <div class="card-stats">
                        <span class="comments">
                            <span class="material-symbols-outlined stat-icon">forum</span>
                            ${formatNumber(movie.commentCount)}
                        </span>
                        <span class="likes">
                            <span class="material-symbols-outlined stat-icon">thumb_up</span>
                            ${formatNumber(movie.likeCount)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    let bodyHtml = '';
    if (isGrouped) {
        bodyHtml = groups.map(([groupName, movieList]) => `
            <div class="date-group">
                <div class="group-date">${escapeHtml(groupName)}</div>
                <div class="results-group">
                    ${movieList.map(m => generateCard(m)).join('')}
                </div>
            </div>
        `).join('');
    } else if (isDateSort && !isCollectionSort) {
        const todayKey = getLocalDateKey(new Date().toISOString());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = getLocalDateKey(yesterdayDate.toISOString());
        const groupsMap = new Map();
        sorted.forEach(movie => {
            const key = getLocalDateKey(movie.dateSaved);
            if (!groupsMap.has(key)) groupsMap.set(key, []);
            groupsMap.get(key).push(movie);
        });
        const sortedGroups = Array.from(groupsMap.entries()).sort((a, b) => new Date(b[0]) - new Date(a[0]));
        bodyHtml = sortedGroups.map(([dateKey, movieList]) => {
            let label;
            if (dateKey === todayKey) label = 'Today';
            else if (dateKey === yesterdayKey) label = 'Yesterday';
            else {
                const [year, month, day] = dateKey.split('-');
                const dateObj = new Date(year, month - 1, day);
                label = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            return `
                <div class="date-group">
                    <div class="group-date">${label}</div>
                    <div class="results-group">
                        ${movieList.map(m => generateCard(m)).join('')}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        bodyHtml = `<div class="movies-grid">${sorted.map(m => generateCard(m)).join('')}</div>`;
    }

    container.innerHTML = `
        <div class="history-header">
            <h2>${escapeHtml(title)}</h2>
            ${!isCollectionSort && !isGrouped ? sortSelectHtml : ''}
        </div>
        ${bodyHtml}
    `;

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect && onSortChange && !isCollectionSort && !isGrouped) {
        sortSelect.addEventListener('change', (e) => {
            onSortChange(e.target.value);
        });
    }

    document.querySelectorAll('.video-card').forEach(card => {
        const movieId = card.dataset.id;
        const movie = movies.find(m => String(m.youtubeId) === String(movieId));
        if (movie && window.openMovieModal) {
            card.onclick = () => {
                window.openMovieModal(movie, source);
            };
        }
    });
}

function sortMovies(movies, sortBy) {
    const sorted = [...movies];
    switch (sortBy) {
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'channel':
            sorted.sort((a, b) => a.channelTitle.localeCompare(b.channelTitle));
            break;
        case 'mostLiked':
            sorted.sort((a, b) => (parseInt(b.likeCount) || 0) - (parseInt(a.likeCount) || 0));
            break;
        case 'mostCommented':
            sorted.sort((a, b) => (parseInt(b.commentCount) || 0) - (parseInt(a.commentCount) || 0));
            break;
        case 'watching':
            sorted.sort((a, b) => (b.watching ? 1 : 0) - (a.watching ? 1 : 0));
            break;
        case 'favorite':
            sorted.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
            break;
        case 'collections':
            break;
        default:
            sorted.sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));
    }
    return sorted;
}