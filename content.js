// Variable pour éviter de créer le popup plusieurs fois
let toastElement = null;
let isPopupVisible = false;

// On lance la détection au chargement
checkIfMangaPage();

function checkIfMangaPage() {
  // On vérifie tout de suite si l'URL ressemble à un manga
  // Si ce n'est pas le cas, on arrête tout pour ne pas gêner sur Google/Youtube etc.
  const mangaName = parseMangaName(window.location.href);
  if (!mangaName) return;

  // Si c'est un manga, on écoute le scroll
  window.addEventListener('scroll', handleScroll);
}

function handleScroll() {
  // Calcul pour savoir si on est en bas de page (avec une marge de 100px)
  const isBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 1500);

  if (isBottom && !isPopupVisible) {
    showToast();
  } else if (!isBottom && isPopupVisible) {
    // Si l'utilisateur remonte, on cache le popup
    hideToast();
  }
}

function createToast() {
  // Création du HTML du popup
  const div = document.createElement('div');
  div.id = 'scan-tracker-toast';
  
  const mangaName = parseMangaName(window.location.href);
  const chapter = parseChapterNumber(window.location.href);
  const chapText = chapter ? `Chapitre ${chapter}` : 'ce scan';

  div.innerHTML = `
    <button id="st-close-btn">&times;</button>
    <h4>Scan Tracker</h4>
    <p>Vous avez terminé <strong>${chapText}</strong> de ${mangaName}.</p>
    <div class="st-buttons">
      <button id="st-save-btn">Enregistrer</button>
    </div>
  `;

  document.body.appendChild(div);

  // Ajouter les événements
  div.querySelector('#st-save-btn').addEventListener('click', () => {
    saveCurrentPage();
  });
  
  div.querySelector('#st-close-btn').addEventListener('click', () => {
    hideToast();
    // Si on ferme manuellement, on arrête d'écouter le scroll pour cette page
    window.removeEventListener('scroll', handleScroll);
  });

  return div;
}

function showToast() {
  if (!toastElement) {
    toastElement = createToast();
  }
  // Petit délai pour permettre au DOM de s'afficher avant la transition CSS
  setTimeout(() => {
    toastElement.classList.add('visible');
  }, 10);
  isPopupVisible = true;
}

function hideToast() {
  if (toastElement) {
    toastElement.classList.remove('visible');
  }
  isPopupVisible = false;
}

// --- LOGIQUE DE SAUVEGARDE (Copiée et adaptée pour le Content Script) ---

function saveCurrentPage() {
    const url = window.location.href;
    const title = document.title;
    const mangaName = parseMangaName(url);
    const newEntry = { url, title, savedAt: new Date().toISOString() };
    const btn = document.querySelector('#st-save-btn');

    // Petit effet visuel
    btn.textContent = "Sauvegarde...";

    chrome.storage.sync.get(['mangaLibrary'], (result) => {
      const library = result.mangaLibrary || {};
      
      if (!library[mangaName]) {
        library[mangaName] = { lastUpdated: new Date().toISOString(), links: [] };
      } else {
        library[mangaName].lastUpdated = new Date().toISOString();
      }
  
      const work = library[mangaName];
      const hostname = new URL(url).hostname;
      
      const existingIndex = work.links.findIndex(l => {
          try { return new URL(l.url).hostname === hostname; } catch(e) { return false; }
      });
  
      if (existingIndex !== -1) {
        work.links[existingIndex] = newEntry;
      } else {
        work.links.push(newEntry);
      }
      
      work.links.sort((a, b) => {
          try { return new URL(a.url).hostname.localeCompare(new URL(b.url).hostname); } catch(e) { return 0; }
      });

      // --- NOUVEAU : GESTION DE LA PASTILLE VERTE ---
      if (work.hasNewChapter && work.latestChapter) {
          const currentChapNum = parseFloat(parseChapterNumber(url));
          if (currentChapNum && currentChapNum >= work.latestChapter) {
              work.hasNewChapter = false;
          }
      }
      // ----------------------------------------------
  
      chrome.storage.sync.set({ mangaLibrary: library }, () => {
        btn.textContent = "Sauvegardé !";
        btn.style.backgroundColor = "#2ecc71";
        setTimeout(() => {
          hideToast();
        }, 2000);
      });
    });
  }

// --- UTILITAIRES (Copiés de popup.js) ---
// Note: Dans un vrai projet pro, on utiliserait des modules pour ne pas dupliquer ce code.
// Mais pour une extension simple, copier-coller est plus sûr pour éviter les erreurs de configuration.

function parseMangaName(url) {
  try {
    const pathSegments = new URL(url).pathname.split('/').filter(Boolean);
    const keywords = ['chapter', 'chapitre', 'scan', 'episode', 'read', 'manga', 'webtoon', 'ch', 'oeuvre'];
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i].toLowerCase();
      if (segment === 'oeuvre' && i + 1 < pathSegments.length) return normalizeName(pathSegments[i+1]);
      const isKeyword = keywords.some(kw => segment.includes(kw));
      const isNumeric = /^\d+$/.test(segment);
      if ((isKeyword || isNumeric) && i > 0) {
        return normalizeName(pathSegments[i - 1]);
      }
    }
    // Fallback
    if (pathSegments.length > 0) {
         const last = pathSegments[pathSegments.length - 1].toLowerCase();
         if (!keywords.some(kw => last.includes(kw))) return normalizeName(last);
    }
    return null;
  } catch (e) { return null; }
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

function normalizeName(name) {
  if (!name) return '';
  return name.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}