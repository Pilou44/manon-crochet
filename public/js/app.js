// Infos du site
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("siteNom").textContent = siteConfig.nom;
  const emailLink = document.getElementById("emailContact");
  emailLink.textContent = siteConfig.email;
  emailLink.href = `mailto:${siteConfig.email}`;
});

// Transformation Cloudinary à la livraison
function cloudinaryUrl(url, options = "") {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/${options}/`);
}

// Chargement des créations depuis Firestore
async function chargerCreations(categorie = "all") {
  const galerie = document.getElementById("galerie");
  galerie.innerHTML = "<p class='text-muted'>Chargement...</p>";

  try {
    let query = db.collection("creations").where("visible", "==", true);
    
    if (categorie !== "all") {
      query = query.where("categorie", "==", categorie);
    }

    const snapshot = await query.get();
    galerie.innerHTML = "";

    if (snapshot.empty) {
      galerie.innerHTML = "<p class='text-muted'>Aucune création pour le moment.</p>";
      return;
    }

    snapshot.forEach(doc => {
      const c = doc.data();
      const indexPrincipal = c.photoPrincipale ?? 0;
      const photoHtml = c.photos?.[indexPrincipal]
        ? `<img src="${cloudinaryUrl(c.photos[indexPrincipal], "w_400,h_300,c_fill,q_auto,f_auto")}" class="card-img-top" alt="${c.nom}" style="height:200px; object-fit:cover;">`
        : `<div class="d-flex align-items-center justify-content-center bg-light text-muted" style="height:200px;">Pas de photo</div>`;
      galerie.innerHTML += `
        <div class="col">
          <a href="creation.html?id=${doc.id}" class="text-decoration-none text-dark">
            <div class="card h-100 shadow-sm">
              ${photoHtml}
              <div class="card-body">
                <h5 class="card-title">${c.nom}</h5>
                <p class="card-text text-muted">${c.description ?? ""}</p>
                <p class="card-text fw-bold">${c.prix ? c.prix + " €" : ""}</p>
              </div>
            </div>
          </a>
        </div>
      `;
    });

  } catch (err) {
    galerie.innerHTML = "<p class='text-danger'>Erreur de chargement.</p>";
    console.error(err);
  }
}

// Chargement des catégories
async function chargerCategories() {
  const filtres = document.getElementById("filtres");

  try {
    const snapshot = await db.collection("categories").get();
    snapshot.forEach(doc => {
      const c = doc.data();
      filtres.innerHTML += `
        <button class="btn btn-outline-secondary btn-sm" data-categorie="${c.slug}">${c.nom}</button>
      `;
    });
  } catch (err) {
    console.error(err);
  }

  // Gestion des clics sur les filtres
  filtres.addEventListener("click", e => {
    if (e.target.tagName === "BUTTON") {
      document.querySelectorAll("#filtres button").forEach(b => b.classList.remove("actif"));
      e.target.classList.add("actif");
      chargerCreations(e.target.dataset.categorie);
    }
  });
}

// Lancement
chargerCategories();
chargerCreations();
