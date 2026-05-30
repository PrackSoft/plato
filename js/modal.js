// js/modal.js (con actualización dinámica de Search term al agregar datos de Collections)
import { getExtraInfo, toggleExact, addDirector, removeDirector, addActor, removeActor, addGenre, removeGenre, addYear, removeYear, addCountry, removeCountry, addLanguage, removeLanguage, openDB } from './db.js';
import { refreshAvailableTerms, loadAndDisplayAll, syncWindowTermFilter, getActiveTermFilter } from './app.js';


let currentMovie = null;
let currentOnUpdate = null;
let currentMovieSource = null;
let currentTrashFunctions = null;
let extraInfoVisible = false;

export function initModal(onUpdateCallback) {
    currentOnUpdate = onUpdateCallback;
    const modal = document.getElementById('movieModal');
    const closeBtn = document.querySelector('.close-modal');
    const watchBtn = document.getElementById('watchMovieBtn');

    if (closeBtn) closeBtn.onclick = () => closeModal();
    if (watchBtn) watchBtn.onclick = () => {
        if (currentMovie && currentMovie.url) window.open(currentMovie.url);
    };
    window.onclick = (e) => { if (e.target === modal) closeModal(); };
}

export async function openModal(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source = 'main') {
    currentMovie = movie;
    currentMovieSource = source;
    currentTrashFunctions = { moveToTrash, restoreFromTrash, permanentlyDelete };
    const modal = document.getElementById('movieModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = renderModalContent(movie, source);
    modal.style.display = 'flex';
    extraInfoVisible = false;

    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
}

function closeModal() {
    const modal = document.getElementById('movieModal');
    if (modal) modal.style.display = 'none';
    currentMovie = null;
    currentMovieSource = null;
    currentTrashFunctions = null;
    extraInfoVisible = false;
}

function renderModalContent(movie, source) {
    const isInTrash = (source === 'trash');
    const watchingIconName = movie.watching ? 'visibility' : 'visibility_off';
    const favoriteIconName = movie.favorite ? 'star_shine' : 'star';
    
    const showExactToggle = window.activeTermFilter && !isInTrash;
    const exactForCurrentTerm = showExactToggle && movie.searchTerms?.some(t => t.term === window.activeTermFilter && t.exact === true);
    const toggleIcon = exactForCurrentTerm ? 'graph_4' : 'subscriptions';
    const toggleLabel = exactForCurrentTerm ? 'Move to Related' : 'Move to Exact';
    
    const tagsHtml = movie.tags && Array.isArray(movie.tags) && movie.tags.length > 0
        ? `<p><strong>Tags:</strong> ${escapeHtml(movie.tags.join(', '))}</p>`
        : '';

    const directors = movie.directors || [];
    const actors = movie.actors || [];
    const genres = movie.genres || [];
    const years = movie.years || [];
    const countries = movie.countries || [];
    const languages = movie.languages || [];

    return `
        <div class="modal-header">
            <div class="modal-spacer"></div>
            <h2>${escapeHtml(movie.title)}</h2>
            <div class="modal-spacer"></div>
        </div>
        <img class="modal-image" src="${movie.imageUrl}" alt="${movie.title}">
        <p><strong>YouTube Premiere:</strong> ${movie.publishedAt ? new Date(movie.publishedAt).toLocaleDateString() : 'Unknown'}</p>
        <div class="modal-description">${escapeHtml(movie.description || 'No Description')}</div>
        ${tagsHtml}
        <p><strong>Duration:</strong> ${formatDuration(movie.duration)}</p>
        <p><strong>Saved on:</strong> ${new Date(movie.dateSaved).toLocaleString()}</p>
        ${isInTrash ? `<p><strong>Deleted on:</strong> ${movie.deletedAt ? new Date(movie.deletedAt).toLocaleString() : 'Unknown'}</p>` : ''}
        
        <div class="modal-section">
            <strong>Search term:</strong>
            <div id="termsList" class="terms-list">
                ${(movie.searchTerms || []).map(t => `
                    <span class="term-chip">
                        ${escapeHtml(t.term)}
                        ${!isInTrash ? `<span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newTermInput" class="modal-input" placeholder="Add new term">
                <span id="addTermBtn" class="modal-add-icon" title="Add term">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Directores -->
        <div class="modal-section">
            <strong>Director:</strong>
            <div id="directorsList" class="terms-list">
                ${directors.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-director" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newDirectorInput" class="modal-input" placeholder="Add director">
                <span id="addDirectorBtn" class="modal-add-icon" title="Add director">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Actores -->
        <div class="modal-section">
            <strong>Actor:</strong>
            <div id="actorsList" class="terms-list">
                ${actors.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newActorInput" class="modal-input" placeholder="Add actor">
                <span id="addActorBtn" class="modal-add-icon" title="Add actor">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Géneros -->
        <div class="modal-section">
            <strong>Genre:</strong>
            <div id="genresList" class="terms-list">
                ${genres.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newGenreInput" class="modal-input" placeholder="Add genre">
                <span id="addGenreBtn" class="modal-add-icon" title="Add genre">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Años -->
        <div class="modal-section">
            <strong>Year:</strong>
            <div id="yearsList" class="terms-list">
                ${years.map(year => `
                    <span class="term-chip">
                        ${escapeHtml(year)}
                        ${!isInTrash ? `<span class="remove-year" data-name="${escapeHtml(year)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newYearInput" class="modal-input" placeholder="Add year">
                <span id="addYearBtn" class="modal-add-icon" title="Add year">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Países -->
        <div class="modal-section">
            <strong>Country:</strong>
            <div id="countriesList" class="terms-list">
                ${countries.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-country" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newCountryInput" class="modal-input" placeholder="Add country">
                <span id="addCountryBtn" class="modal-add-icon" title="Add country">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <!-- Sección Idiomas -->
        <div class="modal-section">
            <strong>Language:</strong>
            <div id="languagesList" class="terms-list">
                ${languages.map(name => `
                    <span class="term-chip">
                        ${escapeHtml(name)}
                        ${!isInTrash ? `<span class="remove-language" data-name="${escapeHtml(name)}">✖</span>` : ''}
                    </span>
                `).join('')}
            </div>
            ${!isInTrash ? `
            <div class="add-term-row">
                <input type="text" id="newLanguageInput" class="modal-input" placeholder="Add language">
                <span id="addLanguageBtn" class="modal-add-icon" title="Add language">
                    <span class="material-symbols-outlined">add</span>
                </span>
            </div>
            ` : ''}
        </div>

        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="watchingToggleRow">
            <span>Watching:</span>
            <span class="material-symbols-outlined" id="modalWatchingIcon">${watchingIconName}</span>
        </div>

        <div class="modal-section toggle-row ${isInTrash ? 'disabled' : ''}" id="favoriteToggleRow">
            <span>Favorite:</span>
            <span class="material-symbols-outlined" id="modalFavoriteIcon">${favoriteIconName}</span>
        </div>

        ${!isInTrash ? `
        <div class="modal-section toggle-row" id="moveToTrashRow">
            <span>Move to Trash:</span>
            <span class="material-symbols-outlined">delete</span>
        </div>
        ` : `
        <div class="modal-section trash-actions">
            <div class="toggle-row" id="restoreRow">
                <span>Restore:</span>
                <span class="material-symbols-outlined">restore_from_trash</span>
            </div>
            <div class="toggle-row" id="permanentDeleteRow">
                <span>Delete Permanently:</span>
                <span class="material-symbols-outlined">delete_forever</span>
            </div>
        </div>
        `}

        ${showExactToggle ? `
        <div class="modal-section toggle-row" id="toggleExactRow">
            <span>${toggleLabel}:</span>
            <span class="material-symbols-outlined">${toggleIcon}</span>
        </div>
        ` : ''}

        <div class="modal-section">
            <button id="toggleExtraInfoBtn" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0;">
                <span class="material-symbols-outlined">info</span> Extra Info
            </button>
            <div id="extraInfoPanel" class="extra-info-panel hidden" style="margin-top: 12px;"></div>
        </div>
    `;
}

// Función auxiliar para actualizar la lista de términos en el modal
async function updateTermsListInModal(movie, source, attachModalEventsFn, {
    updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
}) {
    const termsContainer = document.getElementById('termsList');
    if (termsContainer) {
        termsContainer.innerHTML = (movie.searchTerms || []).map(t => `
            <span class="term-chip">
                ${escapeHtml(t.term)}
                <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
            </span>
        `).join('');
        // Reasignar eventos a los nuevos elementos .remove-term
        attachModalEventsFn(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
    }
}

async function attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source) {
    const isInTrash = (source === 'trash');

    const moveToTrashRow = document.getElementById('moveToTrashRow');
    if (moveToTrashRow && !isInTrash) {
        moveToTrashRow.onclick = async () => {
            if (confirm('Move this movie to trash?')) {
                await moveToTrash(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    const restoreRow = document.getElementById('restoreRow');
    if (restoreRow && isInTrash) {
        restoreRow.onclick = async () => {
            await restoreFromTrash(movie.youtubeId);
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const permanentDeleteRow = document.getElementById('permanentDeleteRow');
    if (permanentDeleteRow && isInTrash) {
        permanentDeleteRow.onclick = async () => {
            if (confirm('Permanently delete this movie? This action cannot be undone.')) {
                await permanentlyDelete(movie.youtubeId);
                closeModal();
                if (currentOnUpdate) await currentOnUpdate();
            }
        };
    }

    const watchingRow = document.getElementById('watchingToggleRow');
    if (watchingRow && !isInTrash) {
        const watchingIcon = document.getElementById('modalWatchingIcon');
        watchingRow.onclick = async () => {
            const newStatus = await toggleWatching(movie.youtubeId);
            movie.watching = newStatus;
            if (watchingIcon) watchingIcon.textContent = newStatus ? 'visibility' : 'visibility_off';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const favoriteRow = document.getElementById('favoriteToggleRow');
    if (favoriteRow && !isInTrash) {
        const favoriteIcon = document.getElementById('modalFavoriteIcon');
        favoriteRow.onclick = async () => {
            const newStatus = await toggleFavorite(movie.youtubeId);
            movie.favorite = newStatus;
            if (favoriteIcon) favoriteIcon.textContent = newStatus ? 'star_shine' : 'star';
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const toggleExactRow = document.getElementById('toggleExactRow');
    if (toggleExactRow && window.activeTermFilter && !isInTrash) {
        toggleExactRow.onclick = async () => {
            const term = window.activeTermFilter;
            await toggleExact(movie.youtubeId, term);
            
            await refreshAvailableTerms();
            await loadAndDisplayAll();
            
            const stillExists = window.availableTerms ? window.availableTerms.includes(term) : false;
            if (!stillExists && getActiveTermFilter() === term) {
                window.activeTermFilter = null;
                if (syncWindowTermFilter) syncWindowTermFilter();
                await loadAndDisplayAll();
            }
            
            closeModal();
            if (currentOnUpdate) await currentOnUpdate();
        };
    }

    const toggleExtraInfoBtn = document.getElementById('toggleExtraInfoBtn');
    const extraInfoPanel = document.getElementById('extraInfoPanel');
    if (toggleExtraInfoBtn && extraInfoPanel) {
        toggleExtraInfoBtn.onclick = async () => {
            if (extraInfoPanel.classList.contains('hidden')) {
                const extra = await getExtraInfo(movie.youtubeId);
                const fields = [
                    { label: 'channelId', value: movie.channelId || 'N/A' },
                    { label: 'channelTitle', value: movie.channelTitle || 'N/A' },
                    { label: 'tags', value: (movie.tags && movie.tags.length) ? movie.tags.join(', ') : 'N/A' },
                    { label: 'viewCount', value: movie.viewCount || 'N/A' },
                    { label: 'duration', value: movie.duration || 'N/A' },
                    { label: 'categoryId', value: extra?.categoryId || 'N/A' },
                    { label: 'defaultLanguage', value: extra?.defaultLanguage || 'N/A' },
                    { label: 'defaultAudioLanguage', value: extra?.defaultAudioLanguage || 'N/A' },
                    { label: 'dimension', value: extra?.dimension || 'N/A' },
                    { label: 'definition', value: extra?.definition || 'N/A' },
                    { label: 'caption', value: extra?.caption || 'N/A' },
                    { label: 'licensedContent', value: extra?.licensedContent !== undefined ? extra.licensedContent : 'N/A' },
                    { label: 'projection', value: extra?.projection || 'N/A' },
                    { label: 'publicStatsViewable', value: extra?.publicStatsViewable !== undefined ? extra.publicStatsViewable : 'N/A' },
                    { label: 'madeForKids', value: extra?.madeForKids !== undefined ? extra.madeForKids : 'N/A' },
                    { label: 'selfDeclaredMadeForKids', value: extra?.selfDeclaredMadeForKids !== undefined ? extra.selfDeclaredMadeForKids : 'N/A' }
                ];
                extraInfoPanel.innerHTML = fields.map(f => `
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-light);">
                        <strong>${escapeHtml(f.label)}</strong>
                        <span>${escapeHtml(String(f.value))}</span>
                    </div>
                `).join('');
                extraInfoPanel.classList.remove('hidden');
                toggleExtraInfoBtn.innerHTML = '<span class="material-symbols-outlined">info</span> Hide Extra Info';
            } else {
                extraInfoPanel.classList.add('hidden');
                toggleExtraInfoBtn.innerHTML = '<span class="material-symbols-outlined">info</span> Extra Info';
            }
        };
    }

    if (!isInTrash) {
        document.querySelectorAll('.remove-term').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();

                const term = el.dataset.term;
                const remainingTerms = (movie.searchTerms || [])
                    .filter(t => t.term !== term);

                if (remainingTerms.length === 0) {
                    if (confirm('Removing the last term will move this movie to Trash. Continue?')) {
                        await moveToTrash(movie.youtubeId);
                        closeModal();
                        if (currentOnUpdate) await currentOnUpdate();
                    }
                    return;
                }

                const newTerms = remainingTerms.map(t => t.term);

                await updateMovieTerms(movie.youtubeId, newTerms);

                movie.searchTerms = remainingTerms;

                const termsContainer = document.getElementById('termsList');

                if (termsContainer) {
                    termsContainer.innerHTML = movie.searchTerms.map(t => `
                        <span class="term-chip">
                            ${escapeHtml(t.term)}
                            <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
                        </span>
                    `).join('');

                    attachModalEvents(
                        movie,
                        {
                            updateMovieTerms,
                            toggleWatching,
                            toggleFavorite,
                            moveToTrash,
                            restoreFromTrash,
                            permanentlyDelete
                        },
                        source
                    );
                }

                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    if (!isInTrash) {
        const addTermBtn = document.getElementById('addTermBtn');
        const newTermInput = document.getElementById('newTermInput');
        if (addTermBtn && newTermInput) {
            addTermBtn.onclick = async () => {
                const newTerm = newTermInput.value.trim();
                if (newTerm && !(movie.searchTerms || []).some(t => t.term === newTerm)) {
                    const newTerms = [...(movie.searchTerms || []).map(t => t.term), newTerm];
                    await updateMovieTerms(movie.youtubeId, newTerms);
                    movie.searchTerms.push({ term: newTerm, exact: true });
                    newTermInput.value = '';
                    const termsContainer = document.getElementById('termsList');
                    if (termsContainer) {
                        termsContainer.innerHTML = (movie.searchTerms || []).map(t => `
                            <span class="term-chip">
                                ${escapeHtml(t.term)}
                                <span class="remove-term" data-term="${escapeHtml(t.term)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newTermInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addTermBtn.click();
            });
        }
    }

    // ========== DIRECTORES ==========
    if (!isInTrash) {
        const addDirectorBtn = document.getElementById('addDirectorBtn');
        const newDirectorInput = document.getElementById('newDirectorInput');
        if (addDirectorBtn && newDirectorInput) {
            addDirectorBtn.onclick = async () => {
                const newDirector = newDirectorInput.value.trim();
                if (newDirector) {
                    await addDirector(movie.youtubeId, newDirector);
                    movie.directors = [...(movie.directors || []), newDirector];
                    // Actualizar searchTerms localmente después de addDirector (que ya actualizó la DB)
                    // Necesitamos recargar la película desde DB para obtener los searchTerms actualizados
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newDirectorInput.value = '';
                    const directorsContainer = document.getElementById('directorsList');
                    if (directorsContainer) {
                        directorsContainer.innerHTML = movie.directors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-director" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    // Actualizar la lista de términos en el modal
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newDirectorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addDirectorBtn.click();
            });
        }

        document.querySelectorAll('.remove-director').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeDirector(movie.youtubeId, name);
                movie.directors = (movie.directors || []).filter(d => d !== name);
                const directorsContainer = document.getElementById('directorsList');
                if (directorsContainer) {
                    directorsContainer.innerHTML = movie.directors.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-director" data-name="${escapeHtml(name)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== ACTORES ==========
    if (!isInTrash) {
        const addActorBtn = document.getElementById('addActorBtn');
        const newActorInput = document.getElementById('newActorInput');
        if (addActorBtn && newActorInput) {
            addActorBtn.onclick = async () => {
                const newActor = newActorInput.value.trim();
                if (newActor) {
                    await addActor(movie.youtubeId, newActor);
                    movie.actors = [...(movie.actors || []), newActor];
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newActorInput.value = '';
                    const actorsContainer = document.getElementById('actorsList');
                    if (actorsContainer) {
                        actorsContainer.innerHTML = movie.actors.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newActorInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addActorBtn.click();
            });
        }

        document.querySelectorAll('.remove-actor').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeActor(movie.youtubeId, name);
                movie.actors = (movie.actors || []).filter(a => a !== name);
                const actorsContainer = document.getElementById('actorsList');
                if (actorsContainer) {
                    actorsContainer.innerHTML = movie.actors.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-actor" data-name="${escapeHtml(name)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== GÉNEROS ==========
    if (!isInTrash) {
        const addGenreBtn = document.getElementById('addGenreBtn');
        const newGenreInput = document.getElementById('newGenreInput');
        if (addGenreBtn && newGenreInput) {
            addGenreBtn.onclick = async () => {
                const newGenre = newGenreInput.value.trim();
                if (newGenre) {
                    await addGenre(movie.youtubeId, newGenre);
                    movie.genres = [...(movie.genres || []), newGenre];
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newGenreInput.value = '';
                    const genresContainer = document.getElementById('genresList');
                    if (genresContainer) {
                        genresContainer.innerHTML = movie.genres.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newGenreInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addGenreBtn.click();
            });
        }

        document.querySelectorAll('.remove-genre').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeGenre(movie.youtubeId, name);
                movie.genres = (movie.genres || []).filter(g => g !== name);
                const genresContainer = document.getElementById('genresList');
                if (genresContainer) {
                    genresContainer.innerHTML = movie.genres.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-genre" data-name="${escapeHtml(name)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== AÑOS ==========
    if (!isInTrash) {
        const addYearBtn = document.getElementById('addYearBtn');
        const newYearInput = document.getElementById('newYearInput');
        if (addYearBtn && newYearInput) {
            addYearBtn.onclick = async () => {
                const newYear = newYearInput.value.trim();
                if (newYear) {
                    await addYear(movie.youtubeId, newYear);
                    movie.years = [...(movie.years || []), newYear];
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newYearInput.value = '';
                    const yearsContainer = document.getElementById('yearsList');
                    if (yearsContainer) {
                        yearsContainer.innerHTML = movie.years.map(year => `
                            <span class="term-chip">
                                ${escapeHtml(year)}
                                <span class="remove-year" data-name="${escapeHtml(year)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newYearInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addYearBtn.click();
            });
        }

        document.querySelectorAll('.remove-year').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const year = el.dataset.name;
                await removeYear(movie.youtubeId, year);
                movie.years = (movie.years || []).filter(y => y !== year);
                const yearsContainer = document.getElementById('yearsList');
                if (yearsContainer) {
                    yearsContainer.innerHTML = movie.years.map(year => `
                        <span class="term-chip">
                            ${escapeHtml(year)}
                            <span class="remove-year" data-name="${escapeHtml(year)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== PAÍSES ==========
    if (!isInTrash) {
        const addCountryBtn = document.getElementById('addCountryBtn');
        const newCountryInput = document.getElementById('newCountryInput');
        if (addCountryBtn && newCountryInput) {
            addCountryBtn.onclick = async () => {
                const newCountry = newCountryInput.value.trim();
                if (newCountry) {
                    await addCountry(movie.youtubeId, newCountry);
                    movie.countries = [...(movie.countries || []), newCountry];
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newCountryInput.value = '';
                    const countriesContainer = document.getElementById('countriesList');
                    if (countriesContainer) {
                        countriesContainer.innerHTML = movie.countries.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-country" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newCountryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addCountryBtn.click();
            });
        }

        document.querySelectorAll('.remove-country').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeCountry(movie.youtubeId, name);
                movie.countries = (movie.countries || []).filter(c => c !== name);
                const countriesContainer = document.getElementById('countriesList');
                if (countriesContainer) {
                    countriesContainer.innerHTML = movie.countries.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-country" data-name="${escapeHtml(name)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }

    // ========== IDIOMAS ==========
    if (!isInTrash) {
        const addLanguageBtn = document.getElementById('addLanguageBtn');
        const newLanguageInput = document.getElementById('newLanguageInput');
        if (addLanguageBtn && newLanguageInput) {
            addLanguageBtn.onclick = async () => {
                const newLanguage = newLanguageInput.value.trim();
                if (newLanguage) {
                    await addLanguage(movie.youtubeId, newLanguage);
                    movie.languages = [...(movie.languages || []), newLanguage];
                    const updatedMovie = await getMovieFromDB(movie.youtubeId);
                    if (updatedMovie && updatedMovie.searchTerms) {
                        movie.searchTerms = updatedMovie.searchTerms;
                    }
                    newLanguageInput.value = '';
                    const languagesContainer = document.getElementById('languagesList');
                    if (languagesContainer) {
                        languagesContainer.innerHTML = movie.languages.map(name => `
                            <span class="term-chip">
                                ${escapeHtml(name)}
                                <span class="remove-language" data-name="${escapeHtml(name)}">✖</span>
                            </span>
                        `).join('');
                        attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                    }
                    await updateTermsListInModal(movie, source, attachModalEvents, {
                        updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete
                    });
                    if (currentOnUpdate) await currentOnUpdate();
                }
            };
            newLanguageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addLanguageBtn.click();
            });
        }

        document.querySelectorAll('.remove-language').forEach(el => {
            el.onclick = async (e) => {
                e.stopPropagation();
                const name = el.dataset.name;
                await removeLanguage(movie.youtubeId, name);
                movie.languages = (movie.languages || []).filter(l => l !== name);
                const languagesContainer = document.getElementById('languagesList');
                if (languagesContainer) {
                    languagesContainer.innerHTML = movie.languages.map(name => `
                        <span class="term-chip">
                            ${escapeHtml(name)}
                            <span class="remove-language" data-name="${escapeHtml(name)}">✖</span>
                        </span>
                    `).join('');
                    attachModalEvents(movie, { updateMovieTerms, toggleWatching, toggleFavorite, moveToTrash, restoreFromTrash, permanentlyDelete }, source);
                }
                if (currentOnUpdate) await currentOnUpdate();
            };
        });
    }
}

// Función auxiliar para obtener una película actualizada desde la DB
async function getMovieFromDB(youtubeId) {
    const db = await openDB();
    const transaction = db.transaction(['movies'], 'readonly');
    const store = transaction.objectStore('movies');
    return new Promise((resolve, reject) => {
        const req = store.get(youtubeId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;');
}

function formatDuration(duration) {
    if (!duration || duration === 'N/A') return 'Unknown';
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] ? match[1].slice(0,-1) : 0);
    const minutes = (match[2] ? match[2].slice(0,-1) : 0);
    const seconds = (match[3] ? match[3].slice(0,-1) : 0);
    return `${hours ? hours+':' : ''}${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}