document.addEventListener('DOMContentLoaded', () => {
  // --- Constantes des éléments UI ---
  const saveButton = document.getElementById('save-btn');
  const libraryContainer = document.getElementById('library-container');
  const manualAddSection = document.getElementById('manual-add-section');
  const manualNameInput = document.getElementById('manual-name');
  const manualSaveButton = document.getElementById('manual-save-btn');
  const exportButton = document.getElementById('export-btn');
  const importButton = document.getElementById('import-file-input');
  const importBtnTrigger = document.getElementById('import-btn');
  const searchBar = document.getElementById('search-bar');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  
  // Onglets
  const tabHistory = document.getElementById('tab-history');
  const tabToRead = document.getElementById('tab-toread');

  let pendingEntry = null; 
  let currentTab = 'history'; 
  
  const storage = chrome.storage.sync;

  // --- Initialisation ---
  
  // On récupère le dernier onglet actif
  storage.get(['lastActiveTab'], (result) => {
    if (result.lastActiveTab) {
      currentTab = result.lastActiveTab;
    }
    updateTabUI();
    displayLibrary();
  });

  // --- Listeners ---
  
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
    storage.set({ lastActiveTab: tabName }); // Sauvegarde l'onglet
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
        if (currentTab === 'history') saveEntryHistory(mangaName, newEntry);
        else saveEntryToRead(mangaName, newEntry);
      }
    });
  }

  function onManualSaveClick() {
    const manualName = manualNameInput.value.trim();
    if (manualName && pendingEntry) {
      const normalizedName = normalizeName(manualName);
      if (currentTab === 'history') saveEntryHistory(normalizedName, pendingEntry);
      else saveEntryToRead(normalizedName, pendingEntry);
      
      pendingEntry = null;
      manualAddSection.style.display = 'none';
    } else {
      alert("Veuillez entrer un nom pour l'œuvre.");
    }
  }

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

      if (existingEntryIndex !== -1) work.links[existingEntryIndex] = newEntry;
      else work.links.push(newEntry);
      
      work.links.sort((a, b) => {
        try { return new URL(a.url).hostname.localeCompare(new URL(b.url).hostname); } catch (e) { return 0; }
      });

      // --- NOUVEAU : GESTION DE LA PASTILLE VERTE ---
      // Si une pastille est active, on regarde si on vient de lire le dernier chapitre (ou plus récent)
      if (work.hasNewChapter && work.latestChapter) {
          const currentChapNum = parseFloat(parseChapterNumber(newEntry.url));
          // Si le chapitre qu'on save est >= au chapitre détecté par le background
          if (currentChapNum && currentChapNum >= work.latestChapter) {
              work.hasNewChapter = false; // On retire la pastille
              console.log(`Mise à jour : ${mangaName} est à jour (Chap ${currentChapNum})`);
          }
      }
      // ----------------------------------------------

      storage.set({ mangaLibrary: library }, () => {
        console.log("Sauvegardé dans Historique");
        displayLibrary(searchBar.value.trim());
      });
    });
  }

  function saveEntryToRead(mangaName, newEntry) {
    storage.get(['toReadLibrary'], (result) => {
      const library = result.toReadLibrary || {};
      library[mangaName] = {
        url: newEntry.url,
        title: newEntry.title,
        addedAt: new Date().toISOString()
      };
      storage.set({ toReadLibrary: library }, () => {
        console.log("Sauvegardé dans À Lire");
        displayLibrary(searchBar.value.trim());
      });
    });
  }

  // --- AFFICHAHGE PRINCIPAL ---
  
  function displayLibrary(searchFilter = '') {
    manualAddSection.style.display = 'none';
    updateStats(); // Mise à jour des stats

    if (currentTab === 'history') {
      displayHistory(searchFilter);
    } else {
      displayToRead(searchFilter);
    }
  }

  // 1. Affichage Historique
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
        libraryContainer.innerHTML = searchFilter ? '<p>Aucun résultat.</p>' : '<p>Votre historique est vide.</p>';
        return;
      }

      // C'EST ICI QU'ON UTILISE renderHistoryItem
      filteredNames.forEach(mangaName => {
        renderHistoryItem(mangaName, library[mangaName], collapsedStates[mangaName]);
      });
    });
  }

  // 2. Affichage À Lire
  function displayToRead(searchFilter) {
    storage.get(['toReadLibrary'], (result) => {
      libraryContainer.innerHTML = '';
      const library = result.toReadLibrary || {};
      
      const mangaNames = Object.keys(library).sort((a, b) => {
        const dateA = new Date(library[a].addedAt);
        const dateB = new Date(library[b].addedAt);
        return dateB - dateA;
      });

      const normalizedFilter = searchFilter.toLowerCase().trim();
      const filteredNames = normalizedFilter
        ? mangaNames.filter(name => name.toLowerCase().includes(normalizedFilter))
        : mangaNames;

      if (filteredNames.length === 0) {
        libraryContainer.innerHTML = searchFilter ? '<p>Aucun résultat.</p>' : '<p>Liste "À Lire" vide.</p>';
        return;
      }

      // C'EST ICI QU'ON UTILISE renderToReadItem
      filteredNames.forEach(mangaName => {
        renderToReadItem(mangaName, library[mangaName]);
      });
    });
  }

  // --- FONCTIONS DE RENDU (Modularisées) ---

  // Rendu d'une ligne "Historique" (Dossier accordéon)
  function renderHistoryItem(name, data, isCollapsed) {
    const folder = document.createElement('div');
    folder.className = 'manga-folder history-item';
    if (isCollapsed) folder.classList.add('collapsed');

    // Titre + Boutons
    const header = document.createElement('h3');
    
    // Partie Gauche (Flèche + Nom)
    const leftDiv = document.createElement('div');
    leftDiv.innerHTML = `<span class="toggle-icon">&#9660;</span> ${name}`;
    
    // Ajout de la pastille verte (si dispo dans les données)
    if (data.hasNewChapter) {
        const lastNum = data.latestChapter ? ` (Ch. ${data.latestChapter})` : '';
        const badge = document.createElement('span');
        badge.className = 'new-chapter-badge';
        badge.title = "Nouveau chapitre disponible" + lastNum;
        // Note: Le style .new-chapter-badge doit être dans le CSS
        leftDiv.appendChild(badge);
    }

    // Partie Droite (Croix)
    const rightDiv = document.createElement('div');
    rightDiv.className = 'title-icons';
    
    const delBtn = document.createElement('span');
    delBtn.className = 'icon-btn delete-manga-btn';
    delBtn.innerHTML = '&times;';
    delBtn.title = "Supprimer l'œuvre";
    
    // Events
    header.addEventListener('click', (e) => {
        if(!e.target.closest('.icon-btn')) {
            const collapsed = folder.classList.toggle('collapsed');
            saveCollapsedState(name, collapsed);
        }
    });
    
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm(`Supprimer "${name}" ?`)) deleteMangaHistory(name);
    });

    rightDiv.appendChild(delBtn);
    header.appendChild(leftDiv);
    header.appendChild(rightDiv);
    folder.appendChild(header);

    // Liste des liens
    const list = document.createElement('ul');
    data.links.forEach(entry => {
        const li = document.createElement('li');
        const a = createLinkElement(entry.url, entry.title, true);
        
        const linkDelBtn = document.createElement('span');
        linkDelBtn.className = 'delete-link-btn';
        linkDelBtn.innerHTML = '&times;';
        linkDelBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            if(confirm("Supprimer ce lien ?")) deleteLinkHistory(name, entry.url);
        });

        li.appendChild(a);
        li.appendChild(linkDelBtn);
        list.appendChild(li);
    });

    folder.appendChild(list);
    libraryContainer.appendChild(folder);
  }

  // Rendu d'une ligne "À Lire" (Simple lien)
  function renderToReadItem(name, data) {
    const folder = document.createElement('div');
    folder.className = 'manga-folder toread-item';

    const header = document.createElement('h3');
    
    // Lien direct
    const link = createLinkElement(data.url, data.title, false);
    link.style.padding = '0';
    
    // Nom forcé
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.style.fontWeight = 'bold';
    nameSpan.style.marginLeft = '0';
    
    // Reconstruction du lien propre
    const cleanLink = document.createElement('a');
    cleanLink.href = data.url;
    cleanLink.target = '_blank';
    cleanLink.className = 'toread-link';
    try {
        const origin = new URL(data.url).origin;
        const fav = document.createElement('img');
        fav.className = 'favicon';
        fav.src = `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${origin}&size=16`;
        cleanLink.appendChild(fav);
    } catch(e){}
    cleanLink.appendChild(nameSpan);

    const leftDiv = document.createElement('div');
    leftDiv.style.display = 'flex'; leftDiv.style.flexGrow = '1';
    leftDiv.appendChild(cleanLink);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'title-icons';
    
    const delBtn = document.createElement('span');
    delBtn.className = 'icon-btn delete-manga-btn';
    delBtn.innerHTML = '&times;';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if(confirm(`Retirer "${name}" ?`)) deleteMangaToRead(name);
    });

    rightDiv.appendChild(delBtn);
    header.appendChild(leftDiv);
    header.appendChild(rightDiv);
    folder.appendChild(header);
    
    libraryContainer.appendChild(folder);
  }

  // --- SUPPRESSIONS ---

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

  // --- IMPORT / EXPORT ---

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
              let history = data.history || data.mangaLibrary || data; // Compatibilité
              let toRead = data.toRead || data.toReadLibrary || {};
              
              if (confirm("Cela va REMPLACER votre bibliothèque actuelle. Continuer ?")) {
                  storage.set({ 
                      mangaLibrary: history, 
                      toReadLibrary: toRead, 
                      collapsedStates: {} 
                  }, () => {
                      alert("Import réussi !");
                      location.reload();
                  });
              }
          } catch(err) {
              alert("Erreur fichier invalide.");
          }
          event.target.value = "";
      };
      reader.readAsText(file);
  }

  // --- HELPERS (Stats, Parsing...) ---

  function updateStats() {
    storage.get(['mangaLibrary', 'toReadLibrary'], (result) => {
      const history = result.mangaLibrary || {};
      const toRead = result.toReadLibrary || {};

      // 1. Compter les mangas
      const mangaCount = Object.keys(history).length;

      // 2. Compter les chapitres (liens) ET les nouvelles sorties
      let chapterCount = 0;
      let newReleaseCount = 0; // Compteur pour les pastilles vertes

      Object.values(history).forEach(manga => {
        // Compte les liens enregistrés
        if (manga.links) {
          chapterCount += manga.links.length;
        }
        // Compte si une nouvelle sortie est détectée
        if (manga.hasNewChapter) {
          newReleaseCount++;
        }
      });

      // 3. Compter la liste "À Lire"
      const toReadCount = Object.keys(toRead).length;

      // 4. Affichage
      animateValue("stat-mangas", mangaCount);
      animateValue("stat-chapters", chapterCount);
      animateValue("stat-toread", toReadCount);
      animateValue("stat-new", newReleaseCount); // Mise à jour du nouveau compteur
    });
  }
  
  function animateValue(id, end) {
    const obj = document.getElementById(id);
    if (!obj) return;
    obj.textContent = end;
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
        if (segment === 'oeuvre' && i + 1 < pathSegments.length) return normalizeName(pathSegments[i+1]);
        const isKeyword = keywords.some(kw => segment.includes(kw));
        const isNumeric = /^\d+$/.test(segment);
        if ((isKeyword || isNumeric) && i > 0) return normalizeName(pathSegments[i - 1]);
      }
      if (pathSegments.length > 0) {
           const lastSegment = pathSegments[pathSegments.length - 1].toLowerCase();
           const isLastSegmentKeyword = keywords.some(kw => lastSegment.includes(kw));
           if (!isLastSegmentKeyword) return normalizeName(pathSegments[pathSegments.length - 1]);
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
  const SITEMAP_URL = "https://mangas-origines.fr/wp-manga-chapters-sitemap.xml";
  const refreshBtn = document.getElementById('refresh-updates-btn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', checkUpdatesManual);
  }

  async function checkUpdatesManual() {
    // 1. Animation visuelle (ça tourne)
    refreshBtn.classList.add('spinning');
    
    try {
      // 2. Récupérer la bibliothèque
      const data = await new Promise(resolve => storage.get(['mangaLibrary'], resolve));
      const library = data.mangaLibrary || {};
      const mangaNames = Object.keys(library);

      if (mangaNames.length === 0) {
        alert("Ajoutez d'abord des mangas à votre historique !");
        return;
      }

      // 3. Récupérer le XML
      const response = await fetch(SITEMAP_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Erreur accès site (Cloudflare ?)");
      
      const xmlText = await response.text();
      let updatesFound = 0;

      // 4. Analyse (même logique qu'avant)
      for (const name of mangaNames) {
        const mangaData = library[name];
        
        // Trouver le dernier lu
        let lastReadChap = 0;
        if (mangaData.links) {
            mangaData.links.forEach(l => {
                const n = parseFloat(parseChapterNumber(l.url));
                if (n > lastReadChap) lastReadChap = n;
            });
        }
        if (!lastReadChap) continue;

        // Regex pour trouver dans le XML
        const slug = name.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
        const regex = new RegExp(`${slug}.*?chapitre-(\\d+(?:\\.\\d+)?)`, 'gi');
        
        let match;
        let maxChapterInXml = 0;

        while ((match = regex.exec(xmlText)) !== null) {
          const chapNum = parseFloat(match[1]);
          if (chapNum > maxChapterInXml) maxChapterInXml = chapNum;
        }

        // Comparaison
        if (maxChapterInXml > lastReadChap) {
          library[name].hasNewChapter = true;
          library[name].latestChapter = maxChapterInXml;
          updatesFound++;
        } else {
           // Si on est à jour, on nettoie (au cas où)
           if (library[name].hasNewChapter) {
               library[name].hasNewChapter = false;
           }
        }
      }

      // 5. Sauvegarde et Rafraîchissement
      storage.set({ mangaLibrary: library }, () => {
        updateStats();      // Met à jour les chiffres en haut
        displayLibrary(searchBar.value); // Met à jour la liste (pastilles vertes)
        
        // Feedback utilisateur
        if (updatesFound > 0) {
            // Optionnel : petit flash ou couleur
            document.getElementById('stat-new').style.textShadow = "0 0 10px #2ecc71";
            setTimeout(() => document.getElementById('stat-new').style.textShadow = "none", 2000);
        }
      });

    } catch (error) {
      console.error(error);
      alert("Impossible de vérifier les sorties.\nLe site est peut-être protégé (Cloudflare) ou inaccessible.");
    } finally {
      // Arrêter l'animation
      refreshBtn.classList.remove('spinning');
    }
  }
});