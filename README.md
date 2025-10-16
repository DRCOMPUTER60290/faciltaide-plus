faciltaides_plus

## Dépannage

Si l'application mobile affiche le message « Impossible de contacter le serveur » :

1. Vérifiez que votre téléphone dispose d'une connexion Internet fonctionnelle.
2. Ouvrez l'URL du backend Render dans un navigateur : https://facilaide-plus-backend.onrender.com.
   * Si la page met du temps à répondre ou affiche une erreur, le service est probablement en veille : ouvrez-la une première fois depuis un navigateur pour « réveiller » l'instance Render, puis relancez la simulation dans l'app.
3. En cas de modification récente du code backend, assurez-vous que le déploiement Render est terminé et qu'aucune erreur ne s'est produite dans les logs.

### Erreur `InternalBytecode.js` sous Windows

Sur certaines installations Windows (en particulier lorsque le projet est synchronisé avec OneDrive), Metro peut afficher `ENOENT: no such file or directory, open '...InternalBytecode.js'`. Ce fichier est un utilitaire interne qu'Expo ne publie pas toujours en version précompilée.

* Après avoir tiré le dépôt, exécutez `npm install` (ou `npm install --force` si vous aviez déjà les dépendances). Le script post-installation `postinstall` crée automatiquement un fichier factice `node_modules/@expo/metro-runtime/build/bundle/InternalBytecode.js`.
* Si l'erreur persiste après une installation, lancez manuellement `npm run fix:metro-bytecode` pour régénérer le stub, puis relancez `npm run dev`.

Ces commandes évitent l'erreur `ENOENT` et permettent à Metro d'ignorer correctement les trames « InternalBytecode » dans la pile d'exécution.
