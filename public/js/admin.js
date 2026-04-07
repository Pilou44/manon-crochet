let nouvellesFichiers = [];

// Sécurité : remplace les `<` par `&lt;`, etc
function sanitize(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Set page title
if (window.location.pathname.includes("dashboard")) {
  document.title = `Dashboard - ${siteConfig.nom}`;
} else {
  document.title = `Admin - ${siteConfig.nom}`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("siteNom")) {
    document.getElementById("siteNom").textContent = siteConfig.nom;
  }
});

// Transformation Cloudinary à la livraison
function cloudinaryUrl(url, options = "") {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/${options}/`);
}

const auth = firebase.auth();

// Redirection selon état de connexion
auth.onAuthStateChanged(user => {
  if (user && window.location.pathname.includes("admin/index")) {
    window.location.href = "dashboard.html";
  }
  if (!user && window.location.pathname.includes("dashboard")) {
    window.location.href = "index.html";
  }
  if (user && window.location.pathname.includes("dashboard")) {
    chargerCategories();
    chargerCreations();
    chargerListeCategories();
  }
});

// Déconnexion
const btnDeconnexion = document.getElementById("btnDeconnexion");
if (btnDeconnexion) {
  btnDeconnexion.addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "index.html";
  });
}

// Charger les catégories dans le select
async function chargerCategories() {
  const select = document.getElementById("categorie");
  if (!select) return;

  // Vider sauf l'option par défaut
  select.innerHTML = '<option value="">-- Choisir --</option>';

  const snapshot = await db.collection("categories").get();
  snapshot.forEach(doc => {
    const option = document.createElement("option");
    option.value = doc.data().slug;
    option.textContent = doc.data().nom;
    select.appendChild(option);
  });
}

// Charger la liste des créations
async function chargerCreations() {
  const liste = document.getElementById("listeCreations");
  if (!liste) return;

  // Charger les catégories pour faire la correspondance slug → nom
  const categoriesSnapshot = await db.collection("categories").get();
  const categories = {};
  categoriesSnapshot.forEach(doc => {
    categories[doc.data().slug] = doc.data().nom;
  });

  const snapshot = await db.collection("creations").orderBy("dateAjout", "desc").get();
  
  if (snapshot.empty) {
    liste.innerHTML = "<p class='text-muted'>Aucune création pour le moment.</p>";
    return;
  }

  liste.innerHTML = "";
  snapshot.forEach(doc => {
    const c = doc.data();
    const nomCategorie = categories[c.categorie] ?? c.categorie; // fallback sur le slug si introuvable
    const indexPrincipal = c.photoPrincipale ?? 0;
    const photo = c.photos?.[indexPrincipal] ?? "";
    liste.innerHTML += `
      <div class="card mb-3 shadow-sm">
        <div class="row g-0 align-items-center">
          <div class="col-md-2 text-center p-2">
            ${photo ? `<img src="${cloudinaryUrl(photo, "w_80,h_80,c_fill,q_auto,f_auto")}" class="img-fluid rounded" style="max-height:80px; object-fit:cover;">` : "<span class='text-muted'>Pas de photo</span>"}
          </div>
          <div class="col-md-8">
            <div class="card-body py-2">
              <h6 class="card-title mb-1">${sanitize(c.nom)}</h6>
              <small class="text-muted">${sanitize(nomCategorie)} — ${c.prix ? c.prix + " €" : "Prix non renseigné"}</small>
              <br>
              <small class="${c.visible ? "text-success" : "text-danger"}">${c.visible ? "Visible" : "Masqué"}</small>
            </div>
          </div>
          <div class="col-md-2 text-center">
            <button class="btn btn-sm btn-outline-dark me-1" onclick="editer('${doc.id}')">Modifier</button>
            <button class="btn btn-sm btn-outline-danger" onclick="supprimer('${doc.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    `;
  });
}

// Upload photo vers Cloudinary
async function uploadPhoto(fichier) {
  const formData = new FormData();
  formData.append("file", fichier);
  formData.append("upload_preset", cloudinaryConfig.uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const data = await response.json();
  return data.secure_url;
}

// Sauvegarder une création
const btnSauvegarder = document.getElementById("btnSauvegarder");
if (btnSauvegarder) {
  btnSauvegarder.addEventListener("click", async () => {
    btnSauvegarder.disabled = true;
    btnSauvegarder.textContent = "Enregistrement...";

    try {
      const id = document.getElementById("creationId").value;
      // Photos existantes (après suppressions éventuelles)
      const photosExistantes = JSON.parse(document.getElementById("photosData").value || "[]");

      // Upload des nouvelles photos
      const nouvellesUrls = [];
      for (const fichier of nouvellesFichiers) {
        const url = await uploadPhoto(fichier);
        nouvellesUrls.push(url);
      }

      // Fusion photos existantes + nouvelles
      const toutesPhotos = [...photosExistantes, ...nouvellesUrls];
      const photoPrincipale = parseInt(document.getElementById("photoPrincipale").value || "0");

      const creation = {
        nom: document.getElementById("nom").value,
        description: document.getElementById("description").value,
        prix: parseFloat(document.getElementById("prix").value) || 0,
        categorie: document.getElementById("categorie").value,
        visible: document.getElementById("visible").checked,
        photos: toutesPhotos,
        photoPrincipale: photoPrincipale,
      };

      if (id) {
        await db.collection("creations").doc(id).update(creation);
      } else {
        creation.dateAjout = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection("creations").add(creation);
      }

      bootstrap.Modal.getInstance(document.getElementById("modalCreation")).hide();
      chargerCreations();

    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    }

    btnSauvegarder.disabled = false;
    btnSauvegarder.textContent = "Sauvegarder";
  });
}

// Supprimer une création
async function supprimer(id) {
  if (!confirm("Supprimer cette création ?")) return;
  await db.collection("creations").doc(id).delete();
  chargerCreations();
}

// Editer une création
async function editer(id) {
  const doc = await db.collection("creations").doc(id).get();
  const c = doc.data();

  document.getElementById("creationId").value = id;
  document.getElementById("nom").value = c.nom;
  document.getElementById("description").value = c.description ?? "";
  document.getElementById("prix").value = c.prix ?? "";
  document.getElementById("categorie").value = c.categorie ?? "";
  document.getElementById("visible").checked = c.visible;
  document.getElementById("photos").value = "";
  document.getElementById("nouvellesMiniatures").innerHTML = ""; 
  nouvellesFichiers = [];

  // Photos existantes
  const photos = c.photos ?? [];
  const photoPrincipale = c.photoPrincipale ?? 0;
  document.getElementById("photosData").value = JSON.stringify(photos);
  document.getElementById("photoPrincipale").value = photoPrincipale;
  afficherMiniatures(photos, photoPrincipale);

  document.querySelector("#modalCreation .modal-title").textContent = "Modifier la création";
  new bootstrap.Modal(document.getElementById("modalCreation")).show();
}

// Login
const btnLogin = document.getElementById("btnLogin");
if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const motdepasse = document.getElementById("motdepasse").value;
    const erreur = document.getElementById("erreur");

    try {
      await auth.signInWithEmailAndPassword(email, motdepasse);
      window.location.href = "dashboard.html";
    } catch (err) {
      erreur.classList.remove("d-none");
      erreur.textContent = "Email ou mot de passe incorrect.";
    }
  });
}

// Réinitialisation du formulaire à l'ouverture
document.getElementById("modalCreation").addEventListener("show.bs.modal", e => {
  if (e.relatedTarget) {
    // Ouvert via le bouton Ajouter
    document.getElementById("creationId").value = "";
    document.getElementById("nom").value = "";
    document.getElementById("description").value = "";
    document.getElementById("prix").value = "";
    document.getElementById("categorie").value = "";
    document.getElementById("photos").value = "";
    document.getElementById("visible").checked = true;
    document.getElementById("photosData").value = "[]";
    document.getElementById("photoPrincipale").value = "0";
    afficherMiniatures([], 0);
    document.getElementById("nouvellesMiniatures").innerHTML = "";
    nouvellesFichiers = [];
    document.querySelector("#modalCreation .modal-title").textContent = "Nouvelle création";
  }
});

// Charger la liste des catégories dans le dashboard
async function chargerListeCategories() {
  const liste = document.getElementById("listeCategories");
  if (!liste) return;

  const snapshot = await db.collection("categories").orderBy("nom").get();

  if (snapshot.empty) {
    liste.innerHTML = "<p class='text-muted'>Aucune catégorie pour le moment.</p>";
    return;
  }

  liste.innerHTML = "";
  snapshot.forEach(doc => {
    const c = doc.data();
    liste.innerHTML += `
      <div class="card mb-2 shadow-sm">
        <div class="row g-0 align-items-center">
          <div class="col-md-10">
            <div class="card-body py-2">
              <span class="fw-bold">${sanitize(c.nom)}</span>
              <small class="text-muted ms-2">${sanitize(c.slug)}</small>
            </div>
          </div>
          <div class="col-md-2 text-center">
            <button class="btn btn-sm btn-outline-danger" onclick="supprimerCategorie('${doc.id}')">Supprimer</button>
          </div>
        </div>
      </div>
    `;
  });
}

// Sauvegarder une catégorie
const btnSauvegarderCategorie = document.getElementById("btnSauvegarderCategorie");
if (btnSauvegarderCategorie) {
  btnSauvegarderCategorie.addEventListener("click", async () => {
    const nom = document.getElementById("categorieNom").value.trim();
    const slug = document.getElementById("categorieSlug").value.trim();

    if (!nom || !slug) {
      alert("Merci de remplir le nom et le slug.");
      return;
    }

    try {
      const existant = await db.collection("categories").where("slug", "==", slug).get();
      if (!existant.empty) {
        alert("Une catégorie avec ce nom existe déjà.");
        return;
      }
      await db.collection("categories").add({ nom, slug });
      bootstrap.Modal.getInstance(document.getElementById("modalCategorie")).hide();
      document.getElementById("categorieNom").value = "";
      document.getElementById("categorieSlug").value = "";
      chargerListeCategories();
      chargerCategories();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    }
  });
}

// Supprimer une catégorie
async function supprimerCategorie(id) {
  if (!confirm("Supprimer cette catégorie ?")) return;
  await db.collection("categories").doc(id).delete();
  chargerListeCategories();
  chargerCategories();
}

// Génération automatique du slug depuis le nom
const categorieNomInput = document.getElementById("categorieNom");
if (categorieNomInput) {
  categorieNomInput.addEventListener("input", e => {
    const slug = e.target.value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    document.getElementById("categorieSlug").value = slug;
  });
}

// Affichage des miniatures
function afficherMiniatures(photos, photoPrincipale = 0) {
  const conteneur = document.getElementById("photosExistantes");
  const miniatures = document.getElementById("miniatures");
  if (!conteneur || !miniatures) return;

  if (!photos || photos.length === 0) {
    conteneur.style.display = "none";
    return;
  }

  conteneur.style.display = "block";
  miniatures.innerHTML = "";

  photos.forEach((url, index) => {
    const div = document.createElement("div");
    div.style.position = "relative";
    div.innerHTML = `
      <img
        src="${cloudinaryUrl(url, "w_80,h_80,c_fill,q_auto,f_auto")}"
        data-index="${index}"
        style="width:80px; height:80px; object-fit:cover; border-radius:4px; cursor:pointer; border: 3px solid ${index === photoPrincipale ? "#198754" : "#dee2e6"};"
        onclick="definirPrincipale(${index})"
      >
      <button
        onclick="retirerPhoto(${index})"
        style="position:absolute; top:-6px; right:-6px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; line-height:1;">✕</button>
    `;
    miniatures.appendChild(div);
  });
}

function definirPrincipale(index) {
  document.querySelectorAll("#miniatures img, #nouvellesMiniatures img").forEach((img, i) => {
    img.style.border = `3px solid ${parseInt(img.dataset.index) === index ? "#198754" : "#dee2e6"}`;
  });
  document.getElementById("photoPrincipale").value = index;
}

function retirerPhoto(index) {
  // Récupérer les photos actuelles
  const photosActuelles = JSON.parse(document.getElementById("photosData").value || "[]");
  photosActuelles.splice(index, 1);
  document.getElementById("photosData").value = JSON.stringify(photosActuelles);

  // Recalculer la photo principale
  const principale = parseInt(document.getElementById("photoPrincipale").value || "0");
  const nouvellePrincipale = principale >= photosActuelles.length ? 0 : principale;
  document.getElementById("photoPrincipale").value = nouvellePrincipale;

  afficherMiniatures(photosActuelles, nouvellePrincipale);
}

// Prévisualisation des nouvelles photos avant upload
document.getElementById("photos")?.addEventListener("change", async e => {
  nouvellesFichiers = [...nouvellesFichiers, ...Array.from(e.target.files)];
  await afficherNouvellesMiniatures();
});

async function afficherNouvellesMiniatures() {
  const photosExistantes = JSON.parse(document.getElementById("photosData").value || "[]");
  const offset = photosExistantes.length;

  const conteneur = document.getElementById("nouvellesMiniatures");
  if (!conteneur) return;
  conteneur.innerHTML = "";

  const principale = parseInt(document.getElementById("photoPrincipale").value || "0");

  for (let i = 0; i < nouvellesFichiers.length; i++) {
    const url = await lireFichier(nouvellesFichiers[i]);
    const indexGlobal = offset + i;
    const div = document.createElement("div");
    div.style.position = "relative";
    div.innerHTML = `
      <img
        src="${url}"
        data-index="${indexGlobal}"
        style="width:80px; height:80px; object-fit:cover; border-radius:4px; cursor:pointer;
               border: 3px solid ${indexGlobal === principale ? "#198754" : "#dee2e6"};"
        onclick="definirPrincipale(${indexGlobal})"
      >
      <button
        onclick="retirerNouvellePhoto(${i})"
        style="position:absolute; top:-6px; right:-6px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:12px; cursor:pointer; line-height:1;">✕</button>
    `;
    conteneur.appendChild(div);
  }
}

async function retirerNouvellePhoto(index) {
  nouvellesFichiers.splice(index, 1);

  // Recalculer la photo principale
  const photosExistantes = JSON.parse(document.getElementById("photosData").value || "[]");
  const principale = parseInt(document.getElementById("photoPrincipale").value || "0");
  const nouvellePrincipale = principale >= photosExistantes.length + nouvellesFichiers.length ? 0 : principale;
  document.getElementById("photoPrincipale").value = nouvellePrincipale;

  await afficherNouvellesMiniatures();
}

function lireFichier(fichier) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(fichier);
  });
}
