// Fréquence de vérification (en minutes)
const CHECK_INTERVAL = 30; 
const SITEMAP_URL = "https://mangas-origines.fr/wp-manga-chapters-sitemap.xml";

// 1. Initialisation de l'alarme
chrome.runtime.onInstalled.addListener(() => {
  console.log("Scan Tracker : Service Worker installé.");
  chrome.alarms.create("checkNewChapters", { periodInMinutes: CHECK_INTERVAL });
  // On lance une vérification immédiate pour tester
  checkUpdates();
});

// 2. Écoute de l'alarme
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkNewChapters") {
    checkUpdates();
  }
});

// 3. Fonction principale de vérification
async function checkUpdates() {
  console.log("Scan Tracker : Vérification des mises à jour...");

  try {
    // A. Récupérer la bibliothèque locale
    const data = await chrome.storage.sync.get(['mangaLibrary']);
    const library = data.mangaLibrary || {};
    const mangaNames = Object.keys(library);

    if (mangaNames.length === 0) return;

    // B. Récupérer le XML
    // Note : On utilise fetch. Si Cloudflare bloque, ça ira dans le 'catch'.
    const response = await fetch(SITEMAP_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    
    const xmlText = await response.text();

    // C. Analyse du XML (Parsing simple via Regex pour éviter DOMParser lourd)
    let updatesFound = false;

    for (const name of mangaNames) {
      const mangaData = library[name];
      
      // On cherche le dernier chapitre lu (le plus grand nombre enregistré)
      const lastReadChap = getLastReadChapter(mangaData.links);
      if (!lastReadChap) continue;

      // On construit une Regex pour trouver ce manga dans le XML
      // Ex: on cherche une ligne qui contient "demonic-emperor" et "chapitre-783"
      // On normalise le nom pour le slug (ex: "Demonic Emperor" -> "demonic-emperor")
      const slug = name.toLowerCase().replace(/ /g, '-').replace(/'/g, '');
      
      // Cette regex cherche les URLs dans le sitemap qui contiennent le slug du manga
      // et capture le numéro du chapitre.
      // Format XML type : <loc>.../manga/demonic-emperor/chapitre-783/</loc>
      const regex = new RegExp(`${slug}.*?chapitre-(\\d+(?:\\.\\d+)?)`, 'gi');
      
      let match;
      let maxChapterInXml = 0;

      // On parcourt toutes les correspondances dans le fichier XML
      while ((match = regex.exec(xmlText)) !== null) {
        const chapNum = parseFloat(match[1]);
        if (chapNum > maxChapterInXml) {
          maxChapterInXml = chapNum;
        }
      }

      // D. Comparaison : Est-ce qu'on a trouvé un chapitre plus grand ?
      // La condition "Suite logique" : On vérifie juste si c'est strictement supérieur.
      if (maxChapterInXml > lastReadChap) {
        console.log(`NOUVEAU ! ${name} : Lu ${lastReadChap} -> Sorti ${maxChapterInXml}`);
        
        // On met à jour l'objet avec une info "newChapterAvailable"
        library[name].hasNewChapter = true;
        library[name].latestChapter = maxChapterInXml;
        updatesFound = true;
      } else {
        // Si on est à jour, on enlève la pastille (au cas où on l'ait lu)
        if (library[name].hasNewChapter) {
            library[name].hasNewChapter = false;
            updatesFound = true;
        }
      }
    }

    // E. Sauvegarde si changements
    if (updatesFound) {
      await chrome.storage.sync.set({ mangaLibrary: library });
      console.log("Scan Tracker : Bibliothèque mise à jour avec les notifications.");
    } else {
      console.log("Scan Tracker : Rien de nouveau.");
    }

  } catch (error) {
    console.error("Scan Tracker Erreur Update :", error);
    // Si c'est Cloudflare, on aura souvent une erreur ici.
  }
}

// Utilitaire : Trouver le plus grand numéro de chapitre dans la liste sauvegardée
function getLastReadChapter(links) {
  if (!links || links.length === 0) return 0;
  
  let max = 0;
  links.forEach(link => {
    const num = parseChapterNumber(link.url);
    if (num && parseFloat(num) > max) max = parseFloat(num);
  });
  return max;
}

// (Copié de popup.js pour être autonome)
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