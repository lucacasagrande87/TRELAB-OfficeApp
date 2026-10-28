// Collegamento a Firebase: espone gli stessi oggetti che la pagina usava dentro Claude
// (db, user, downloads), ma con archivio Firestore e accesso Email/Password di Firebase.
// La pagina principale aspetta window.claude.use('db'): finché nessuno ha fatto l'accesso
// mostra la schermata di login.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence }
  from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
const fs = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* ---------- accesso ---------- */
const $ = id => document.getElementById(id);
let resolveUser;
const userReady = new Promise(r => { resolveUser = r; });
let firstState = true;
onAuthStateChanged(auth, u => {
  if (u) { $('fb-login').hidden = true; resolveUser(u); }
  else if (firstState || !document.body.classList.contains('fb-in')) { $('fb-login').hidden = false; setTimeout(() => $('fb-email').focus(), 50); }
  else location.reload(); // uscita o sessione scaduta: si riparte dalla schermata di accesso
  firstState = false;
});
const errMsg = e => {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Email o password non corretti.';
  if (/too-many-requests/.test(c)) return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (/network/.test(c)) return 'Connessione assente. Controlla internet e riprova.';
  if (/user-disabled/.test(c)) return 'Questo utente è stato disattivato.';
  return 'Accesso non riuscito (' + (c || 'errore') + ').';
};
$('fb-form').addEventListener('submit', async e => {
  e.preventDefault();
  const b = $('fb-go'), err = $('fb-err'); b.disabled = true; err.hidden = true;
  try { await signInWithEmailAndPassword(auth, $('fb-email').value.trim(), $('fb-pw').value); }
  catch (x) { err.textContent = errMsg(x); err.hidden = false; }
  b.disabled = false;
});
$('fb-forgot').addEventListener('click', async () => {
  const em = $('fb-email').value.trim(), err = $('fb-err');
  if (!em) { err.textContent = 'Scrivi prima la tua email, poi premi di nuovo "Password dimenticata".'; err.hidden = false; return; }
  try { await sendPasswordResetEmail(auth, em); err.textContent = 'Se l\'indirizzo è registrato, riceverai un\'email per scegliere una nuova password.'; err.hidden = false; }
  catch (x) { err.textContent = errMsg(x); err.hidden = false; }
});
window.fbLogout = () => signOut(auth);

/* ---------- archivio ---------- */
const snap = qs => ({ docs: qs.docs.map(d => ({ id: d.id, data: () => d.data() })) });
const clean = o => { const r = {}; Object.keys(o || {}).forEach(k => { if (k !== 'id' && o[k] !== undefined) r[k] = o[k]; }); return r; };
const wrapErr = e => { const c = String((e && e.code) || ''); throw Object.assign(new Error(c || 'errore'), { code: /permission/.test(c) ? 'revoked' : /resource-exhausted/.test(c) ? 'quota_exceeded' : c }); };
function collectionApi(name) {
  return {
    onSnapshot(ok, err) { return onSnapshot(collection(fs, name), qs => ok(snap(qs)), e => err && err(e)); },
    doc(id) {
      const ref = id ? doc(fs, name, id) : doc(collection(fs, name));
      return {
        set: data => setDoc(ref, clean(data)).catch(wrapErr),
        update: data => updateDoc(ref, clean(data)).catch(wrapErr),
        delete: () => deleteDoc(ref).catch(wrapErr)
      };
    }
  };
}

/* ---------- utente: nome mostrato = parte dell'email prima della @ ---------- */
const nameOf = u => (u.displayName || (u.email || '').split('@')[0] || 'Utente');
const userApi = {
  async id() { return (await userReady).uid; },
  async me() { const u = await userReady; return { id: u.uid, name: nameOf(u), email: u.email }; },
  async can() { return true; },
  async profiles(ids) { // i colleghi sono nell'elenco "utenti", aggiornato a ogni accesso
    const o = {}; (window.__fbUsers || []).forEach(x => { if (ids.includes(x.id)) o[x.id] = { name: x.nome }; }); return o;
  }
};
userReady.then(u => {
  document.body.classList.add('fb-in');
  setDoc(doc(fs, 'utenti', u.uid), { nome: nameOf(u), email: u.email || '', ultimoAccesso: new Date().toISOString() }, { merge: true }).catch(() => {});
  onSnapshot(collection(fs, 'utenti'), qs => { window.__fbUsers = qs.docs.map(d => Object.assign({ id: d.id }, d.data())); }, () => {});
});

const downloads = {
  async save({ filename, data, mimeType }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: (mimeType || 'text/csv') + ';charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { status: 'saved' };
  }
};

window.claude = {
  async use(cap) {
    await userReady;
    if (cap === 'db') return { collection: collectionApi };
    if (cap === 'user') return userApi;
    if (cap === 'downloads') return downloads;
    return null;
  }
};
window.dispatchEvent(new Event('fb-ready'));
