# TRELAB OfficeApp — Rapportini

App web per registrare i rapportini dei servizi ai clienti e preparare la fatturazione.

- Questo repository contiene **solo il codice della pagina**. Nessun dato.
- I dati (clienti, servizi, rapportini, fatture) sono nel database **Firebase Firestore** del progetto
  `trelab-officeapp` e sono leggibili solo dagli utenti creati dall'amministratore (accesso con email e password).
- La configurazione Firebase in `config.js` è pubblica per natura: la protezione è data dalle regole di Firestore
  e dalla registrazione autonoma disattivata.

Pagina pubblicata con GitHub Pages.
