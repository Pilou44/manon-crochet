// Infos du site
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("siteNom").textContent = siteConfig.nom;
  const emailLink = document.getElementById("emailContact");
  emailLink.textContent = siteConfig.email;
  emailLink.href = `mailto:${siteConfig.email}`;
});

function cloudinaryUrl(url, options = "") {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/${options}/`);
}

// Récupérer l'id dans l'URL
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if (!id) {
  window.location.href = "index.html";
}

async function chargerCreation() {
  const contenu = document.getElementById("contenu");

  try {
    const doc = await db.collection("creations").doc(id).get();

    if (!doc.exists) {
      contenu.innerHTML = "<p class='text-danger'>Création introuvable.</p>";
      return;
    }

    const c = doc.data();

    // Récupérer le nom de la catégorie
    let nomCategorie = c.categorie ?? "";
    if (c.categorie) {
      const catSnapshot = await db.collection("categories")
        .where("slug", "==", c.categorie)
        .get();
      if (!catSnapshot.empty) {
        nomCategorie = catSnapshot.docs[0].data().nom;
      }
    }

    const photos = c.photos ?? [];
    const indexPrincipal = c.photoPrincipale ?? 0;
    // Mettre la photo principale en premier dans le carousel
    if (photos.length > 1 && indexPrincipal > 0) {
      const principale = photos.splice(indexPrincipal, 1)[0];
      photos.unshift(principale);
    }

    contenu.innerHTML = `
      <div class="row">
        <div class="col-md-7">
          <!-- Photos -->
          ${photos.length > 1 ? `
            <div id="carousel" class="carousel slide mb-3" data-bs-ride="carousel">
              <div class="carousel-inner">
                ${photos.map((p, i) => `
                  <div class="carousel-item ${i === 0 ? "active" : ""}">
                    <img src="${cloudinaryUrl(p, "w_800,h_600,c_fit,q_auto,f_auto")}" class="d-block w-100 rounded" style="max-height:450px; object-fit:contain;">
                  </div>
                `).join("")}
              </div>
              <button class="carousel-control-prev" type="button" data-bs-target="#carousel" data-bs-slide="prev">
                <span class="carousel-control-prev-icon"></span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#carousel" data-bs-slide="next">
                <span class="carousel-control-next-icon"></span>
              </button>
            </div>
          ` : photos.length === 1 ? `
            <img src="${cloudinaryUrl(photos[0], "w_800,h_600,c_fit,q_auto,f_auto")}" class="img-fluid rounded mb-3" style="max-height:450px; object-fit:contain;">
          ` : `
            <p class="text-muted">Pas de photo disponible.</p>
          `}
        </div>
        <div class="col-md-5">
          <h2>${c.nom}</h2>
          <p class="text-muted">${nomCategorie}</p>
          <p>${c.description ?? ""}</p>
          <p class="fs-4 fw-bold">${c.prix ? c.prix + " €" : ""}</p>
          <a href="mailto:${siteConfig.email}" class="btn btn-dark">Contacter Manon</a>
        </div>
      </div>
    `;

    // Titre de la page
    document.title = `${c.nom} — Manon Crochet`;

  } catch (err) {
    console.error(err);
    document.getElementById("contenu").innerHTML = "<p class='text-danger'>Erreur de chargement.</p>";
  }
}

chargerCreation();
