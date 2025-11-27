document.addEventListener('DOMContentLoaded', () => {
  // --- Constantes des éléments UI ---
  const saveButton = document.getElementById('save-btn');
  const libraryContainer = document.getElementById('library-container');
  const manualAddSection = document.getElementById('manual-add-section');
  const manualNameInput = document.getElementById('manual-name');
  const manualSaveButton = document.getElementById('manual-save-btn');
  const exportButton = document.getElementById('export-btn');
  const importButton = document.getElementById('import-file-input'); // Correction selecteur
  const importBtnTrigger = document.getElementById('import-btn'); // Bouton visible
  const searchBar = document.getElementById('search-bar');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  
  // NOUVEAU: Onglets
  const tabHistory = document.getElementById('tab-history');
  const tabToRead = document.getElementById('tab-toread');

  let pendingEntry = null; 
  let currentTab = 'history'; // 'history' ou 'toread'
  
  const storage = chrome.storage.sync;

  // --- Initialisation ---
  updateTabUI();
  displayLibrary();

  // --- Listeners ---
  
  // Changement d'onglets
  tabHistory.addEventListener('click', () => switchTab('history'));
  tabToRead.addEventListener('click', () => switchTab('toread'));

  saveButton.addEventListener('click', onSaveClick);
  manualSaveButton.addEventListener('click', onManualSaveClick);
  exportButton.addEventListener('click', exportLibrary);
  importBtnTrigger.addEventListener('click', () => importButton.click());
  importButton.addEventListener('change', importLibrary);
  searchBar.addEventListener('input', onSearchInput);
  clearSearchBtn.addEventListener('click', onClearSearch);

  // --- Gestion des Onglets ---
  
  function switchTab(tabName) {
    currentTab = tabName;
    // Réinitialiser la recherche
    searchBar.value = '';
    clearSearchBtn.style.display = 'none';
    updateTabUI();
    displayLibrary();
  }

  function updateTabUI() {
    if (currentTab === 'history') {
      tabHistory.classList.add('active');
      tabToRead.classList.remove('active');
      saveButton.textContent = "Enregistrer un chapitre";
      saveButton.classList.remove('toread-mode');
    } else {
      tabHistory.classList.remove('active');
      tabToRead.classList.add('active');
      saveButton.textContent = "Enregistrer cette oeuvre";
      saveButton.classList.add('toread-mode');
    }
    manualAddSection.style.display = 'none';
  }

  // --- Recherche ---
  function onSearchInput(e) {
    const query = e.target.value.trim();
    displayLibrary(query);
    clearSearchBtn.style.display = query ? 'block' : 'none';
  }

  function onClearSearch() {
    searchBar.value = '';
    displayLibrary();
    clearSearchBtn.style.display = 'none';
    searchBar.focus();
  }

  // --- Logique de Sauvegarde ---
  
  function onSaveClick() {
    manualAddSection.style.display = 'none';
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      const tab = tabs[0];
      const newEntry = { url: tab.url, title: tab.title, savedAt: new Date().toISOString() };
      const mangaName = parseMangaName(tab.url);

      if (!mangaName) {
        pendingEntry = newEntry;
        manualNameInput.value = '';
        manualAddSection.style.display = 'block';
        manualNameInput.focus();
      } else {
        if (currentTab === 'history') {
          saveEntryHistory(mangaName, newEntry);
        } else {
          saveEntryToRead(mangaName, newEntry);
        }
      }
    });
  }

  function onManualSaveClick() {
    const manualName = manualNameInput.value.trim();
    if (manualName && pendingEntry) {
      const normalizedName = normalizeName(manualName);
      if (currentTab === 'history') {
        saveEntryHistory(normalizedName, pendingEntry);
      } else {
        saveEntryToRead(normalizedName, pendingEntry);
      }
      pendingEntry = null;
      manualAddSection.style.display = 'none';
    } else {
      alert("Veuillez entrer un nom pour l'œuvre.");
    }
  }

  // Sauvegarde pour l'Historique (Code existant optimisé)
  function saveEntryHistory(mangaName, newEntry) {
    storage.get(['mangaLibrary'], (result) => {
      const library = result.mangaLibrary || {};
      
      let newHostname;
      try { newHostname = new URL(newEntry.url).hostname; } catch (e) { return; }

      if (!library[mangaName]) {
        library[mangaName] = { lastUpdated: new Date().toISOString(), links: [] };
      } else {
        library[mangaName].lastUpdated = new Date().toISOString();
      }
      
      const work = library[mangaName];
      const existingEntryIndex = work.links.findIndex(entry => {
        try { return new URL(entry.url).hostname === newHostname; } catch (e) { return false; }
      });

      if (existingEntryIndex !== -1) {
        work.links[existingEntryIndex] = newEntry;
      } else {
        work.links.push(newEntry);
      }
      // Tri par hostname
      work.links.sort((a, b) => {
        try { return new URL(a.url).hostname.localeCompare(new URL(b.url).hostname); } catch (e) { return 0; }
      });

      storage.set({ mangaLibrary: library }, () => {
        console.log("Sauvegardé dans Historique");
        displayLibrary(searchBar.value.trim());
      });
    });
  }

  // NOUVEAU: Sauvegarde pour "À Lire"
  function saveEntryToRead(mangaName, newEntry) {
    storage.get(['toReadLibrary'], (result) => {
      const library = result.toReadLibrary || {};
      
      // Structure plus simple pour "À Lire": juste un lien par manga
      library[mangaName] = {
        url: newEntry.url,
        title: newEntry.title, // On garde le titre de la page (ex: "Astral Pet Store - Mangas Origines")
        addedAt: new Date().toISOString()
      };

      storage.set({ toReadLibrary: library }, () => {
        console.log("Sauvegardé dans À Lire");
        displayLibrary(searchBar.value.trim());
      });
    });
  }

  // --- Affichage ---
  
  function displayLibrary(searchFilter = '') {
    manualAddSection.style.display = 'none';
    
    if (currentTab === 'history') {
      displayHistory(searchFilter);
    } else {
      displayToRead(searchFilter);
    }
    updateStats();
  }

  // Affichage Historique (Ton ancien displayLibrary adapté)
  function displayHistory(searchFilter) {
    storage.get(['mangaLibrary', 'collapsedStates'], (result) => {
      libraryContainer.innerHTML = '';
      const library = result.mangaLibrary || {};
      const collapsedStates = result.collapsedStates || {};
      
      const mangaNames = Object.keys(library).sort((a, b) => {
        const dateA = new Date(library[a].lastUpdated);
        const dateB = new Date(library[b].lastUpdated);
        return dateB - dateA;
      });
      
      const normalizedFilter = searchFilter.toLowerCase().trim();
      const filteredNames = normalizedFilter
        ? mangaNames.filter(name => name.toLowerCase().includes(normalizedFilter))
        : mangaNames;

      if (filteredNames.length === 0) {
        libraryContainer.innerHTML = searchFilter 
          ? '<p>Aucun résultat.</p>' 
          : '<p>Votre historique est vide.</p>';
        return;
      }

      filteredNames.forEach(mangaName => {
        const workData = library[mangaName];
        const folder = document.createElement('div');
        folder.className = 'manga-folder history-item'; // Classe spécifique
        if (collapsedStates[mangaName]) folder.classList.add('collapsed');

        // Header
        const header = createHeader(mangaName, true, () => {
            const isCollapsed = folder.classList.toggle('collapsed');
            saveCollapsedState(mangaName, isCollapsed);
        }, () => {
             if (confirm(`Supprimer "${mangaName}" de l'historique ?`)) deleteMangaHistory(mangaName);
        });
        folder.appendChild(header);

        // Liste des chapitres
        const list = document.createElement('ul');
        workData.links.forEach(entry => {
          const li = document.createElement('li');
          const a = createLinkElement(entry.url, entry.title, true); // true = avec parsing chapitre
          
          const delBtn = document.createElement('span');
          delBtn.className = 'delete-link-btn';
          delBtn.innerHTML = '&times;';
          delBtn.title = "Supprimer ce lien";
          delBtn.addEventListener('click', (e) => {
             e.preventDefault(); e.stopPropagation();
             if(confirm("Supprimer ce lien ?")) deleteLinkHistory(mangaName, entry.url);
          });
          
          li.appendChild(a);
          li.appendChild(delBtn);
          list.appendChild(li);
        });

        folder.appendChild(list);
        libraryContainer.appendChild(folder);
      });
    });
  }

  // NOUVEAU: Affichage À Lire
  function displayToRead(searchFilter) {
    storage.get(['toReadLibrary'], (result) => {
      libraryContainer.innerHTML = '';
      const library = result.toReadLibrary || {};
      
      const mangaNames = Object.keys(library).sort((a, b) => {
        const dateA = new Date(library[a].addedAt);
        const dateB = new Date(library[b].addedAt);
        return dateB - dateA; // Plus récent en premier
      });

      const normalizedFilter = searchFilter.toLowerCase().trim();
      const filteredNames = normalizedFilter
        ? mangaNames.filter(name => name.toLowerCase().includes(normalizedFilter))
        : mangaNames;

      if (filteredNames.length === 0) {
        libraryContainer.innerHTML = searchFilter 
          ? '<p>Aucun résultat.</p>' 
          : '<p>Liste "À Lire" vide. Ajoutez des œuvres !</p>';
        return;
      }

      filteredNames.forEach(mangaName => {
        const entry = library[mangaName];
        const folder = document.createElement('div');
        folder.className = 'manga-folder toread-item'; // Style simple

        // Header simplifié (pas de toggle)
        const header = document.createElement('h3');
        
        // Lien direct dans le titre ou juste le titre ?
        // Faisons un lien cliquable direct
        const link = createLinkElement(entry.url, entry.title, false); // false = pas de parsing chapitre
        link.style.padding = '0'; // Reset padding du lien
        
        // Nom de l'oeuvre + Favicon (géré par createLinkElement)
        // On doit forcer le nom de l'oeuvre à la place du hostname
        const nameSpan = document.createElement('span');
        nameSpan.textContent = mangaName;
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.marginLeft = '0';

        // On recrée le lien manuellement pour avoir le contrôle total
        const cleanLink = document.createElement('a');
        cleanLink.href = entry.url;
        cleanLink.target = '_blank';
        cleanLink.className = 'toread-link';
        
        try {
             const origin = new URL(entry.url).origin;
             const fav = document.createElement('img');
             fav.className = 'favicon';
             fav.src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${origin}&size=16`;
             cleanLink.appendChild(fav);
        } catch(e){}
        
        cleanLink.appendChild(nameSpan);
        
        // Conteneur gauche
        const leftDiv = document.createElement('div');
        leftDiv.style.display = 'flex'; 
        leftDiv.style.flexGrow = '1';
        leftDiv.appendChild(cleanLink);

        // Actions à droite (Edit / Delete)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'title-icons';

        const editBtn = document.createElement('span');
        editBtn.className = 'icon-btn edit-manga-btn';
        editBtn.innerHTML = '&#9998;';
        editBtn.addEventListener('click', (e) => {
             e.stopPropagation();
             toggleEditMode(header, leftDiv, actionsDiv, mangaName, true); // true = mode toread
        });

        const delBtn = document.createElement('span');
        delBtn.className = 'icon-btn delete-manga-btn';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', (e) => {
             e.stopPropagation();
             if(confirm(`Retirer "${mangaName}" de la liste ?`)) deleteMangaToRead(mangaName);
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);
        
        header.appendChild(leftDiv);
        header.appendChild(actionsDiv);
        folder.appendChild(header);
        
        libraryContainer.appendChild(folder);
      });
    });
  }

  // --- Helpers UI ---
  
  function createHeader(title, isFoldable, onClick, onDelete) {
    const h3 = document.createElement('h3');
    
    const leftGroup = document.createElement('div');
    leftGroup.style.display = 'flex';
    leftGroup.style.alignItems = 'center';
    leftGroup.style.flexGrow = '1';
    leftGroup.style.overflow = 'hidden';

    if (isFoldable) {
        const icon = document.createElement('span');
        icon.className = 'toggle-icon';
        icon.innerHTML = '&#9660;';
        leftGroup.appendChild(icon);
    }

    const span = document.createElement('span');
    span.textContent = title;
    leftGroup.appendChild(span);

    const icons = document.createElement('div');
    icons.className = 'title-icons';
    
    const editBtn = document.createElement('span');
    editBtn.className = 'icon-btn edit-manga-btn';
    editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEditMode(h3, leftGroup, icons, title, false); // false = history mode
    });

    const delBtn = document.createElement('span');
    delBtn.className = 'icon-btn delete-manga-btn';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onDelete();
    });

    icons.appendChild(editBtn);
    icons.appendChild(delBtn);

    h3.appendChild(leftGroup);
    h3.appendChild(icons);
    
    if (isFoldable) {
        h3.addEventListener('click', (e) => {
            if (!e.target.closest('.icon-btn')) onClick();
        });
    }

    return h3;
  }

  function createLinkElement(url, title, parseChapter) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.title = title;
    
    try {
        const urlObj = new URL(url);
        const origin = urlObj.origin;
        const hostname = urlObj.hostname;
        
        const fav = document.createElement('img');
        fav.className = 'favicon';
        fav.src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${origin}&size=16`;
        fav.onerror = () => fav.style.display = 'none';
        a.appendChild(fav);

        const txt = document.createElement('span');
        txt.className = 'domain-name';
        
        if (parseChapter) {
            const ch = parseChapterNumber(url);
            txt.textContent = ch ? `${hostname} | chap. ${ch}` : hostname;
        } else {
            txt.textContent = hostname;
        }
        a.appendChild(txt);
    } catch(e) {
        a.textContent = url;
    }
    return a;
  }

  // --- Édition ---

  function toggleEditMode(container, groupToHide, iconsToHide, oldName, isToRead) {
    groupToHide.style.display = 'none';
    iconsToHide.style.display = 'none';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'title-edit-input';
    input.value = oldName;
    
    const saveBtn = document.createElement('span');
    saveBtn.className = 'icon-btn';
    saveBtn.innerHTML = '&#10003;';
    saveBtn.style.color = 'var(--success-color)';

    const save = () => {
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
             renameMangaGeneric(oldName, newName, isToRead);
        } else {
             cancel();
        }
    };
    
    const cancel = () => {
        groupToHide.style.display = 'flex';
        iconsToHide.style.display = 'flex';
        input.remove();
        saveBtn.remove();
    };

    saveBtn.addEventListener('click', (e) => { e.stopPropagation(); save(); });
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') { e.stopPropagation(); save(); }
        if(e.key === 'Escape') { e.stopPropagation(); cancel(); }
    });
    input.addEventListener('click', e => e.stopPropagation()); // Empêcher le pliage

    container.insertBefore(saveBtn, iconsToHide);
    container.insertBefore(input, saveBtn);
    input.focus();
  }

  function renameMangaGeneric(oldName, newName, isToRead) {
    const dbKey = isToRead ? 'toReadLibrary' : 'mangaLibrary';
    
    storage.get([dbKey, 'collapsedStates'], (result) => {
        const lib = result[dbKey] || {};
        
        if (lib[newName]) {
            alert("Ce nom existe déjà.");
            displayLibrary(searchBar.value.trim());
            return;
        }
        
        lib[newName] = lib[oldName];
        delete lib[oldName];
        
        // Si historique, gérer le pliage
        if (!isToRead) {
            const states = result.collapsedStates || {};
            if (states[oldName]) {
                states[newName] = true;
                delete states[oldName];
            }
            storage.set({ [dbKey]: lib, collapsedStates: states }, () => displayLibrary(searchBar.value.trim()));
        } else {
            storage.set({ [dbKey]: lib }, () => displayLibrary(searchBar.value.trim()));
        }
    });
  }

  // --- Suppressions ---

  function deleteMangaHistory(name) {
     storage.get(['mangaLibrary', 'collapsedStates'], (r) => {
         const lib = r.mangaLibrary || {};
         const states = r.collapsedStates || {};
         delete lib[name];
         delete states[name];
         storage.set({ mangaLibrary: lib, collapsedStates: states }, () => displayLibrary(searchBar.value.trim()));
     });
  }
  
  function deleteLinkHistory(name, url) {
      storage.get(['mangaLibrary'], (r) => {
          const lib = r.mangaLibrary || {};
          if (lib[name]) {
              lib[name].links = lib[name].links.filter(l => l.url !== url);
              lib[name].lastUpdated = new Date().toISOString();
              storage.set({ mangaLibrary: lib }, () => displayLibrary(searchBar.value.trim()));
          }
      });
  }

  function deleteMangaToRead(name) {
      storage.get(['toReadLibrary'], (r) => {
          const lib = r.toReadLibrary || {};
          delete lib[name];
          storage.set({ toReadLibrary: lib }, () => displayLibrary(searchBar.value.trim()));
      });
  }

  // --- Import / Export ---

  function exportLibrary() {
    storage.get(['mangaLibrary', 'toReadLibrary'], (result) => {
        const exportData = {
            history: result.mangaLibrary || {},
            toRead: result.toReadLibrary || {},
            version: 2
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const node = document.createElement('a');
        node.setAttribute("href", dataStr);
        node.setAttribute("download", "scan_tracker_backup_v2.json");
        document.body.appendChild(node);
        node.click();
        node.remove();
    });
  }

  function importLibrary(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const data = JSON.parse(e.target.result);
              
              // Support rétro-compatible (si ancien format V1)
              let history = {};
              let toRead = {};
              
              if (data.history || data.toRead) {
                  history = data.history || {};
                  toRead = data.toRead || {};
              } else {
                  // C'est probablement un fichier V1 (juste l'historique)
                  history = data;
              }
              
              if (confirm("Cela va REMPLACER votre bibliothèque actuelle. Continuer ?")) {
                  storage.set({ 
                      mangaLibrary: history, 
                      toReadLibrary: toRead, 
                      collapsedStates: {} 
                  }, () => {
                      alert("Import réussi !");
                      location.reload(); // Recharger pour reset l'état
                  });
              }
          } catch(err) {
              alert("Erreur fichier invalide.");
          }
          event.target.value = "";
      };
      reader.readAsText(file);
  }

  // --- Utils (Parsers) ---
  
  function parseChapterNumber(url) {
    try {
      let match = url.match(/(?:chapitre|chapter|chap|ch|scan|episode|ep)[-/](\d+(?:\.\d+)?)/i);
      if (match && match[1]) return match[1];
      const path = new URL(url).pathname;
      match = path.match(/\/(\d+(?:\.\d+)?)(?:\/)?$/);
      if (match && match[1] && match[1].length < 6) return match[1];
      return null;
    } catch (e) { return null; }
  }

  function parseMangaName(url) {
    try {
      const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
      const keywords = ['chapter', 'chapitre', 'scan', 'episode', 'read', 'manga', 'webtoon', 'ch', 'oeuvre'];
      for (let i = pathSegments.length - 1; i >= 0; i--) {
        const segment = pathSegments[i].toLowerCase();
        // Cas spécifique mangas-origines (/oeuvre/nom)
        if (segment === 'oeuvre' && i + 1 < pathSegments.length) return normalizeName(pathSegments[i+1]);
        
        const isKeyword = keywords.some(kw => segment.includes(kw));
        const isNumeric = /^\d+$/.test(segment);
        if ((isKeyword || isNumeric) && i > 0) {
          return normalizeName(pathSegments[i - 1]);
        }
      }
      if (pathSegments.length > 0) {
           const lastSegment = pathSegments[pathSegments.length - 1].toLowerCase();
           // Éviter de prendre "chapitre-xxx" comme nom
           const isLastSegmentKeyword = keywords.some(kw => lastSegment.includes(kw));
           if (!isLastSegmentKeyword) {
                return normalizeName(pathSegments[pathSegments.length - 1]);
           }
      }
      return null;
    } catch (e) { return null; }
  }

  function normalizeName(name) {
    if (!name) return '';
    return name.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }
  
  function saveCollapsedState(mangaName, isCollapsed) {
    storage.get(['collapsedStates'], (result) => {
        const collapsedStates = result.collapsedStates || {};
        if (isCollapsed) collapsedStates[mangaName] = true;
        else delete collapsedStates[mangaName];
        storage.set({ collapsedStates: collapsedStates });
    });
  }


  function updateStats() {
    storage.get(['mangaLibrary', 'toReadLibrary'], (result) => {
      const history = result.mangaLibrary || {};
      const toRead = result.toReadLibrary || {};

      // 1. Compter les mangas (Historique)
      const mangaCount = Object.keys(history).length;

      // 2. Compter les chapitres (Total des liens)
      let chapterCount = 0;
      Object.values(history).forEach(manga => {
        if (manga.links) {
          chapterCount += manga.links.length;
        }
      });

      // 3. Compter la liste "À Lire"
      const toReadCount = Object.keys(toRead).length;

      // 4. Affichage avec petite animation (optionnel, mais sympa)
      animateValue("stat-mangas", mangaCount);
      animateValue("stat-chapters", chapterCount);
      animateValue("stat-toread", toReadCount);
    });
  }

  // Petite fonction pour animer les chiffres qui montent
  function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    // Mise à jour directe pour l'instant (plus simple et performant)
    obj.textContent = end;
  }
});