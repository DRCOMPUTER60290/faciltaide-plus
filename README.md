faciltaides_plus

## Dépannage

Si l'application mobile affiche le message « Impossible de contacter le serveur » :

1. Vérifiez que votre téléphone dispose d'une connexion Internet fonctionnelle.
2. Ouvrez l'URL du backend Render dans un navigateur : https://facilaide-plus-backend.onrender.com.
   * Si la page met du temps à répondre ou affiche une erreur, le service est probablement en veille : ouvrez-la une première fois depuis un navigateur pour « réveiller » l'instance Render, puis relancez la simulation dans l'app.
3. Assurez-vous que les points de terminaison `/api/generate-json/` et `/api/simulate/` sont bien accessibles **avec la barre oblique finale** ; certains backends (comme Django REST) redirigent les requêtes sans `/`, ce qui provoque une erreur réseau dans Expo.
4. En cas de modification récente du code backend, assurez-vous que le déploiement Render est terminé et qu'aucune erreur ne s'est produite dans les logs.

> 💡 Vous pouvez personnaliser l'URL du backend en définissant la variable `EXPO_PUBLIC_API_BASE_URL` avant `npm run dev` (ou en modifiant `extra.apiBaseUrl` dans `app.json`). L'application supprimera automatiquement les `/` superflus et utilisera les routes avec la barre oblique finale attendue par l'API.

### Erreur `InternalBytecode.js` sous Windows

Sur certaines installations Windows (en particulier lorsque le projet est synchronisé avec OneDrive), Metro peut afficher `ENOENT: no such file or directory, open '...InternalBytecode.js'`. Ce fichier est un utilitaire interne qu'Expo ne publie pas toujours en version précompilée.

* Après avoir tiré le dépôt, exécutez `npm install` (ou `npm install --force` si vous aviez déjà les dépendances). Le script post-installation `postinstall` crée automatiquement un fichier factice `node_modules/@expo/metro-runtime/build/bundle/InternalBytecode.js` **et** un duplicata à la racine du projet (`InternalBytecode.js`) pour les environnements Windows qui y font référence directement.
* Si l'erreur persiste après une installation, lancez manuellement `npm run fix:metro-bytecode` pour régénérer les stubs, puis relancez `npm run dev`.

Ces commandes évitent l'erreur `ENOENT` et permettent à Metro d'ignorer correctement les trames « InternalBytecode » dans la pile d'exécution.
