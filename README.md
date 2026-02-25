# 🔥 Scan Tracker

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-orange.svg)

**Scan Tracker** est une extension Chrome moderne conçue pour les lecteurs de Webtoons et de Mangas. Elle détecte automatiquement le chapitre que vous lisez et vous propose de sauvegarder votre progression sans interrompre votre lecture.

> *"Ne perdez plus jamais le fil de votre lecture, même après avoir fermé l'onglet."*

---

## ✨ Fonctionnalités Actuelles

* **⚡ Suivi des Sorties (Bêta) :** Pour les lecteurs sur **mangas-origines.fr**, l'extension détecte automatiquement si de nouveaux chapitres sont sortis pour vos œuvres enregistrées.
* **🕵️‍♂️ Détection Intelligente :** Analyse l'URL pour trouver automatiquement le nom de l'œuvre et le numéro du chapitre sur la majorité des sites.
* **🔔 Popup de Fin de Chapitre :** Une notification discrète apparaît en bas de page lorsque vous avez fini de scroller.
* **📚 Double Bibliothèque :**
    * **Historique :** Suivez votre progression chapitre par chapitre.
    * **À Lire :** Gardez une liste d'envies pour plus tard.
* **🎨 UI Immersive :** Interface sombre avec effets de particules (style "Blue Aura") pour une expérience visuelle agréable.
* **💾 Sauvegarde Locale & Export :** Vos données sont stockées localement. Vous pouvez exporter/importer votre bibliothèque en JSON pour ne jamais rien perdre.

---

## 🔮 Roadmap & Futur

Nous avons de grands projets pour Scan Tracker. Voici ce qui arrive prochainement :

- [ ] **🌐 Détection Universelle :** Étendre la détection automatique des nouveaux chapitres à **n'importe quel site** de scan/webtoon. <br> <sub>*Et essayer de ne pas se faire taper dessus par CloudFlare pour le "scraping"...* 🫣</sub>
- [ ] **🔗 Partage Social :** Possibilité de partager sa bibliothèque ou sa liste "À lire" via un lien unique ou un code ami. <br> <sub>*Même si mon meilleur ami est une Pastabox au saumon.*</sub>
- [ ] **📧 Notifications Email :** Recevez un récapitulatif hebdomadaire ou instantané des nouvelles sorties. <br> <sub>*Histoire de remplir vos boîtes mails encore plus vite.*</sub>
- [ ] **📱 Application Mobile Compagnon :** Une app (iOS/Android) pour recevoir les notifications push directement sur téléphone. <br> <sub>*Génération Ultra-Connectée.*</sub>
- [ ] **☁️ Synchronisation Cross-Device :** Commencez votre lecture sur PC, finissez-la sur mobile. Tout est synchronisé. <br> <sub>*Metro ➔ Manga ➔ Boulot ➔ Manga ➔ Dodo ➔ Manga.*</sub>
- [ ] **🌍 Traduction Internationale :** L'extension doit pouvoir être multi-langues. <br> <sub>*Toujours penser aux autres.*</sub>
- [ ] **🐼 Créer un logo...** <br> ~~*J'abuse de pas l'avoir fait...*~~
- [ ] **Et encore d'autres choses si j'y pense** 😝 <br> <sub>*Je pense, donc je suis.*</sub>

---

## 📸 Aperçu

| Bibliothèque | Popup de Lecture |
|:---:|:---:|
| <img width="330" height="602" alt="Bibliothèque Scan Tracker" src="https://github.com/user-attachments/assets/cd9d96c0-2dcc-408a-9725-861ea5743b96" />| <img width="308" height="116" alt="Popup Notification" src="https://github.com/user-attachments/assets/9635e960-214f-435f-98cc-b17a8a8c4bca" /> |

---

## 🚀 Installation (Mode Développeur)

Voici comment l'installer manuellement :

1.  **Cloner le projet :**
    ```bash
    git clone https://github.com/VOTRE-PSEUDO/scan-tracker.git
    ```
2.  Ouvrez Google Chrome et allez sur `chrome://extensions`.
3.  Activez le **Mode développeur** (bouton en haut à droite).
4.  Cliquez sur **Charger l'extension non empaquetée** (Load unpacked).
5.  Sélectionnez le dossier du projet `scan-tracker`.

---

## 📖 Utilisation

### Sauvegarde Automatique
1.  Lisez votre chapitre tranquillement.
2.  Arrivé en bas de la page, un petit popup noir apparaît.
3.  Cliquez sur **"Enregistrer"**. C'est fait !

### Gestion Manuelle
1.  Cliquez sur l'icône de l'extension dans la barre du navigateur.
2.  Onglet **"Enregistrer"** : Voyez votre historique, modifiez les titres ou supprimez des chapitres.
3.  Onglet **"À Lire"** : Ajoutez la page courante à votre liste de lecture future.

### Paramètres
Allez dans l'onglet **Paramètres** pour :
* Activer ou désactiver le popup automatique.
* Gérer la liste noire des sites.
* Importer/Exporter le JSON de vos œuvres enregistrées.

---

## 🛠️ Stack Technique

* **HTML5 / CSS3** (Flexbox, CSS Animations pour les particules).
* **JavaScript (ES6+)** (Vanilla JS, pas de framework lourd).
* **Manifest V3** (Conforme aux dernières normes de sécurité Google).

---

## 🤝 Contribuer

Les contributions sont les bienvenues !
