# Script Chatbot – Sections 1 & 2

## Section 1 – Composition du foyer

**Introduction**

> Chatbot : Bien, commençons par comprendre votre foyer. Cela permet de déterminer les aides accessibles selon votre situation familiale.

### Question 1 – Identité principale

> Chatbot : 🧑 Quel est votre prénom ?
> *(Exemple : Marie, Ahmed, Léa…)*
>
> **Stockage →** `individus.individu_1.prenom`

### Question 2 – Date de naissance

> Chatbot : 🎂 Pouvez-vous indiquer votre date de naissance ?
> 📝 Format : JJ/MM/AAAA
>
> **Stockage →** `individus.individu_1.date_naissance` *(calcul automatique de l’âge)*

### Question 3 – Sexe

> Chatbot : ⚥ Quel est votre sexe ?
>
> 👨 Masculin  
> 👩 Féminin
>
> **Stockage →** `individus.individu_1.sexe`

### Question 4 – Situation de couple

> Chatbot : ❤️ Vivez-vous actuellement :
>
> 🧍 Seul(e)  
> 👥 En couple
>
> **Stockage →** détermine `familles.parents` et `menages.conjoint`

#### Si l’utilisateur choisit « En couple »

> Chatbot : 🧑‍🤝‍🧑 Très bien. J’ai besoin des informations de votre conjoint pour être précis.

1. **Prénom du conjoint**  
   > Chatbot : 🧑 Quel est le prénom de votre conjoint(e) ?  
   > **Stockage →** `individus.individu_2.prenom`
2. **Date de naissance du conjoint**  
   > Chatbot : 🎂 Quelle est sa date de naissance ?  
   > 📝 Format : JJ/MM/AAAA  
   > **Stockage →** `individus.individu_2.date_naissance`
3. **Sexe du conjoint**  
   > Chatbot : ⚥ Quel est son sexe ?  
   > 👨 Masculin  
   > 👩 Féminin  
   > **Stockage →** `individus.individu_2.sexe`
4. **Statut conjugal**  
   > Chatbot : 📄 Quel est votre statut matrimonial ?  
   > • Marié(e)  
   > • Pacsé(e)  
   > • Union libre (concubinage)  
   > **Stockage →** `familles.statut_marital`

### Question 5 – Enfants et personnes à charge

> Chatbot : 👶 Avez-vous des enfants ou personnes à charge vivant dans votre foyer ?
>
> Oui / Non
>
> **Stockage →** `familles.enfants`

#### Si « Oui » → boucle enfant

> Chatbot : 🧒 Très bien, indiquons les informations du premier enfant.

Pour chaque enfant :

1. **Prénom**  
   > Chatbot : 👶 Quel est son prénom ?  
   > **Stockage →** `individus.enfant_X.prenom`
2. **Date de naissance**  
   > Chatbot : 🎂 Quelle est sa date de naissance ?  
   > 📝 Format : JJ/MM/AAAA  
   > **Stockage →** `individus.enfant_X.date_naissance`
3. **Sexe**
   > Chatbot : ⚥ Quel est son sexe ?
   > Masculin / Féminin
   > **Stockage →** `individus.enfant_X.sexe`
4. **Scolarité**
   > Chatbot : 🎓 Quelle est sa situation scolaire actuelle ?
   > • Non scolarisé
   > • Maternelle
   > • Élémentaire / Primaire
   > • Collège
   > • Lycée
   > • Études supérieures
   > • Apprentissage / Alternance
   > • Enseignement spécialisé
   > • Autre (préciser)
   > **Stockage →** `individus.enfant_X.scolarite`
5. **Garde alternée**
   > Chatbot : ⚖️ Cet enfant est-il en garde alternée ?
   > Oui / Non
   > **Stockage →** `familles.enfants.en_garde_alternee`

Boucle de fin :

> Chatbot : ➕ Souhaitez-vous ajouter un autre enfant ou personne à charge ?
>
> Oui / Non
>
> • Oui → répéter les questions 5.1 à 5.5
> • Non → passer à la confirmation

### Fin de section 1

> Chatbot : 🎉 Merci ! J’ai bien noté la composition de votre foyer. Nous allons maintenant passer à votre situation professionnelle et personnelle, car elle influence vos droits aux aides sociales.
>
> Souhaitez-vous continuer ? (Oui / Non)

---

## Section 2 – Situation professionnelle (multi-adultes)

**Introduction**

> Chatbot : Bien, nous allons maintenant examiner la situation professionnelle et personnelle de chaque adulte du foyer.

### Adulte 1 (Utilisateur)

> Chatbot : 🧍 Pour l’adulte 1 (Vous)

#### Question 6 – Activité principale

> Chatbot : 💼 Quelle est votre situation actuelle ? Veuillez choisir l’option qui décrit le mieux votre situation principale :
>
> • 👨‍💼 Salarié(e)  
> • 🧾 Travailleur indépendant / Auto-entrepreneur  
> • 🧑‍🎓 Étudiant(e)  
> • 📉 Demandeur d’emploi indemnisé  
> • 📄 Demandeur d’emploi non indemnisé  
> • 👩‍🦽 En situation de handicap  
> • 🏠 Sans activité / au foyer  
> • 👴 Retraité(e)

Chaque réponse déclenche un sous-dialogue :

1. **Salarié(e)**  
   • Quel est votre type de contrat ? (CDI, CDD, Intérim, Contrat aidé, Autre)  
   • Travaillez-vous à temps plein ou temps partiel ?  
   • Depuis quand occupez-vous cet emploi ? (mois/année)

2. **Travailleur indépendant / Auto-entrepreneur**  
   • Êtes-vous auto-entrepreneur, indépendant classique ou micro-BIC/BNC ?  
   • Quelle est votre activité principale ?  
   • Quel est votre revenu net mensuel moyen sur les 3 derniers mois ?

3. **Demandeur d’emploi indemnisé**  
   • Depuis quand êtes-vous inscrit à Pôle Emploi ? (mois/année)  
   • Percevez-vous une allocation chômage (ARE) ? (Oui/Non)  
   • Si Oui : montant mensuel net de l’allocation ?

4. **Demandeur d’emploi non indemnisé**  
   • Depuis quand êtes-vous sans emploi ? (mois/année)  
   • Avez-vous épuisé vos droits au chômage ? (Oui / Non / Je n’y ai jamais eu droit)

5. **Étudiant(e)**  
   • Êtes-vous étudiant à temps plein, en alternance ou en apprentissage ?  
   • Percevez-vous une bourse étudiante ? (Oui/Non)

6. **En situation de handicap**  
   • Avez-vous une reconnaissance de handicap (RQTH) ? (Oui/Non)  
   • Quel est votre taux d’incapacité ? (<50 %, 50-79 %, ≥80 %)  
   • Percevez-vous l’AAH ? (Oui / Non / En cours de demande)

7. **Sans activité / au foyer**  
   • Percevez-vous actuellement une aide sociale ? (RSA, Prime d’activité, Allocation parent isolé, Aucune)

8. **Retraité(e)**  
   • Pas de sous-questions supplémentaires.

#### Conditionnel – Grossesse

> Chatbot : 👶 Êtes-vous actuellement enceinte ? (Question affichée si sexe = femme et âge entre 15 et 50 ans)
>
> Réponses : Oui / Non / Je ne souhaite pas répondre  
> • Si Oui → À quel mois de grossesse êtes-vous ? (Moins de 3 mois, 3 à 6 mois, Plus de 6 mois)

### Adulte 2 (Conjoint, si applicable)

> Chatbot : 🧑‍🤝‍🧑 Merci. Passons maintenant à la situation de votre conjoint(e).  
> 💡 Les réponses peuvent être différentes des vôtres.

Les mêmes questions et sous-dialogues que pour l’adulte 1 sont posés.

### Clôture de la section 2

> Chatbot : 🎉 Merci ! Toutes les informations professionnelles ont été enregistrées. Consultez le résumé généré puis poursuivez la simulation.

