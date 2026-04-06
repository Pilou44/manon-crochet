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

  const snapshot = await db.collection("creations").orderBy("dateAjout", "desc").get();
  
  if (snapshot.empty) {
    liste.innerHTML = "<p class='text-muted'>Aucune création pour le moment.</p>";
    return;
  }

  liste.innerHTML = "";
  snapshot.forEach(doc => {
    const c = doc.data();
    const photo = c.photos?.[0] ?? "";
    liste.innerHTML += `
      <div class="card mb-3 shadow-sm">
        <div class="row g-0 align-items-center">
          <div class="col-md-2 text-center p-2">
            ${photo ? `<img src="${photo}" class="img-fluid rounded" style="max-height:80px; object-fit:cover;">` : "<span class='text-muted'>Pas de photo</span>"}
          </div>
          <div class="col-md-8">
            <div class="card-body py-2">
              <h6 class="card-title mb-1">${c.nom}</h6>
              <small class="text-muted">${c.categorie} — ${c.prix ? c.prix + " €" : "Prix non renseigné"}</small>
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
      const fichiers = document.getElementById("photos").files;

      // Upload des photos
      const urls = [];
      for (const fichier of fichiers) {
        const url = await uploadPhoto(fichier);
        urls.push(url);
      }

      const creation = {
        nom: document.getElementById("nom").value,
        description: document.getElementById("description").value,
        prix: parseFloat(document.getElementById("prix").value) || 0,
        categorie: document.getElementById("categorie").value,
        visible: document.getElementById("visible").checked,
        dateAjout: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (urls.length > 0) {
        creation.photos = urls;
      }

      if (id) {
        await db.collection("creations").doc(id).update(creation);
      } else {
        creation.photos = urls;
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
    document.querySelector("#modalCreation .modal-title").textContent = "Nouvelle création";
  }
});
