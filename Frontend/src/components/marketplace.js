import { getInitials } from "./ui.js";
import { renderMatchStatusLabel, renderRatingStars } from "./matches.js";

function marketplaceMatchesCategory(request, selectedCategory) {
  if (selectedCategory === "All") return true;
  const offered = (request.habilidad?.nombre || "").toLowerCase();
  const requested = (request.habilidad_solicitada?.nombre || "").toLowerCase();
  return offered.includes(selectedCategory.toLowerCase())
    || requested.includes(selectedCategory.toLowerCase());
}

export function renderMarketplaceSection({
  requests,
  selectedCategory,
  searchQuery,
  marketplaceGrid,
  marketplaceTotalEl,
  matchesCountBadgeEl,
  requestMatchesMyLearning,
  onAcceptRequest,
  onOpenMatchedConversation,
  onShowRequestDetails,
}) {
  marketplaceGrid.innerHTML = "";
  const filtered = requests.filter((request) => {
    const matchState = request.viewer_match_state || "none";
    if (matchState === "matched") {
      return false;
    }
    if (!marketplaceMatchesCategory(request, selectedCategory)) {
      return false;
    }
    if (searchQuery) {
      return true;
    }
    return requestMatchesMyLearning(request);
  });

  marketplaceTotalEl.textContent = String(filtered.length);
  matchesCountBadgeEl.textContent = String(filtered.length);

  if (!filtered.length) {
    const card = document.createElement("div");
    card.className = "surface-card";
    card.innerHTML = searchQuery
      ? "<h3>No hay resultados para esa busqueda</h3><p>Prueba con otras palabras o cambia de categoria.</p>"
      : "<h3>No hay matches con lo que quieres aprender</h3><p>Puedes buscar manualmente en la barra para encontrar otras publicaciones.</p>";
    marketplaceGrid.appendChild(card);
    return;
  }

  filtered.forEach((request) => {
    const emisor = request.emisor || {};
    const author = `${emisor.nombre || ""} ${emisor.apellido || ""}`.trim() || "Usuario";
    const matchState = request.viewer_match_state || "none";
    const offeredSkill = request.habilidad?.nombre || "-";
    const requestedSkill = request.habilidad_solicitada?.nombre || "-";
    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-head">
        <div class="match-avatar">${getInitials(author)}</div>
        <div>
          <h3>${author}</h3>
          <div class="muted">Solicitud publica</div>
        </div>
      </div>
      <div>
        <div class="muted">Puedes aprender de ${author}:</div>
        <div class="strong-list">${offeredSkill}</div>
      </div>
      <div>
        <div class="muted">${author} quiere aprender:</div>
        <div class="strong-list">${requestedSkill}</div>
      </div>
      <div>
        <div class="muted">Mensaje</div>
        <div>${request.mensaje || "Sin descripcion"}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const acceptBtn = document.createElement("button");
    acceptBtn.className = matchState === "matched" ? "secondary-btn" : "primary-btn";
    acceptBtn.type = "button";

    if (matchState === "matched") {
      acceptBtn.textContent = "Abrir chat";
      acceptBtn.onclick = () => onOpenMatchedConversation(request.viewer_conversation_id);
    } else if (matchState === "received" || matchState === "mutual-pending") {
      acceptBtn.textContent = "Responder match";
      acceptBtn.onclick = () => onAcceptRequest(request.id);
    } else if (matchState === "sent") {
      acceptBtn.textContent = "Interes enviado";
      acceptBtn.disabled = true;
    } else {
      acceptBtn.textContent = "Match";
      acceptBtn.onclick = () => onAcceptRequest(request.id);
    }

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "ghost-btn";
    detailsBtn.type = "button";
    detailsBtn.textContent = "Go to profile";
    detailsBtn.onclick = () => onShowRequestDetails({ from_user_id: emisor.id || request.usuario_emisor_id }, "matchesView");

    actions.appendChild(acceptBtn);
    actions.appendChild(detailsBtn);
    card.appendChild(actions);
    marketplaceGrid.appendChild(card);
  });
}

export function renderIncomingMatchesSection({
  items,
  incomingMatchesGrid,
  incomingMatchesCountBadgeEl,
  onAcceptRequest,
  onShowRequestDetails,
}) {
  incomingMatchesGrid.innerHTML = "";
  incomingMatchesCountBadgeEl.textContent = String(items.length);
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "surface-card";
    empty.innerHTML = "<h3>Aun no recibes matches</h3><p>Cuando alguien te marque como interes, aparecera aqui para que respondas rapido.</p>";
    incomingMatchesGrid.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const emisor = item.emisor || {};
    const author = `${emisor.nombre || ""} ${emisor.apellido || ""}`.trim() || "Usuario";
    const offeredSkill = item.habilidad?.nombre || "-";
    const requestedSkill = item.habilidad_solicitada?.nombre || "-";
    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-head">
        <div class="match-avatar">${getInitials(author)}</div>
        <div>
          <h3>${author}</h3>
          <div class="muted">Quiere hacer match contigo</div>
        </div>
      </div>
      <div>
        <div class="muted">Te puede ensenar</div>
        <div class="strong-list">${requestedSkill}</div>
      </div>
      <div>
        <div class="muted">Quiere aprender</div>
        <div class="strong-list">${offeredSkill}</div>
      </div>
      <div>
        <div class="muted">Mensaje</div>
        <div>${item.mensaje || "Sin descripcion"}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const respondBtn = document.createElement("button");
    respondBtn.className = "primary-btn";
    respondBtn.type = "button";
    respondBtn.textContent = "Responder match";
    respondBtn.onclick = () => onAcceptRequest(item.id, emisor.id || item.usuario_emisor_id);

    const profileBtn = document.createElement("button");
    profileBtn.className = "ghost-btn";
    profileBtn.type = "button";
    profileBtn.textContent = "Go to profile";
    profileBtn.onclick = () => onShowRequestDetails({ from_user_id: emisor.id || item.usuario_emisor_id }, "incomingMatchesView");

    actions.appendChild(respondBtn);
    actions.appendChild(profileBtn);
    card.appendChild(actions);
    incomingMatchesGrid.appendChild(card);
  });
}

export function renderMyMatchesSection({
  items,
  myMatchesGrid,
  myMatchesCountBadgeEl,
  onOpenMatchedConversation,
  onShowRequestDetails,
  onFinalizeMatch,
  onRateMatch,
}) {
  myMatchesGrid.innerHTML = "";
  myMatchesCountBadgeEl.textContent = String(items.length);

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "surface-card";
    empty.innerHTML = "<h3>Aun no tienes matches mutuos</h3><p>Cuando ambos usuarios se den match, aparecera aqui con su estado.</p>";
    myMatchesGrid.appendChild(empty);
    return;
  }

  items.forEach((match) => {
    const author = match.other_user_name || String(match.other_user_id);
    const offeredSkill = match.habilidad?.nombre || "-";
    const requestedSkill = match.habilidad_solicitada?.nombre || "-";
    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-head">
        <div class="match-avatar">${getInitials(author)}</div>
        <div>
          <h3>${author}</h3>
          <div class="muted">${renderMatchStatusLabel(match)}</div>
        </div>
      </div>
      <div>
        <div class="muted">Intercambio</div>
        <div class="strong-list">${offeredSkill} ↔ ${requestedSkill}</div>
      </div>
      <div>
        <div class="muted">Calificacion</div>
        <div>${renderRatingStars(match)}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    if (match.conversation_id) {
      const chatBtn = document.createElement("button");
      chatBtn.className = "secondary-btn";
      chatBtn.type = "button";
      chatBtn.textContent = "Abrir chat";
      chatBtn.onclick = () => onOpenMatchedConversation(match.conversation_id);
      actions.appendChild(chatBtn);
    }

    const profileBtn = document.createElement("button");
    profileBtn.className = "ghost-btn";
    profileBtn.type = "button";
    profileBtn.textContent = "Go to profile";
    profileBtn.onclick = () => onShowRequestDetails({ from_user_id: match.other_user_id }, "myMatchesView");
    actions.appendChild(profileBtn);

    if (match.estado === "aceptado") {
      const finalizeBtn = document.createElement("button");
      finalizeBtn.type = "button";
      if (match.can_finalize) {
        finalizeBtn.className = "primary-btn";
        finalizeBtn.textContent = "Finalizar match";
        finalizeBtn.onclick = () => onFinalizeMatch(match.id);
      } else {
        finalizeBtn.className = "secondary-btn";
        finalizeBtn.textContent = "Esperando al otro";
        finalizeBtn.disabled = true;
      }
      actions.appendChild(finalizeBtn);
    }

    if (match.estado === "completado" && match.can_rate) {
      const ratingInput = document.createElement("div");
      ratingInput.className = "rating-input";

      let selectedRating = null;

      const ratingTag = document.createElement("span");
      ratingTag.className = "rating-value-tag";
      ratingTag.textContent = "Selecciona: 0";
      ratingInput.appendChild(ratingTag);

      const pickerButtons = [];
      for (let rating = 1; rating <= 5; rating += 1) {
        const starBtn = document.createElement("button");
        starBtn.className = "star-picker-btn";
        starBtn.type = "button";
        starBtn.textContent = "★";
        starBtn.title = `${rating} estrella${rating === 1 ? "" : "s"}`;
        starBtn.onclick = () => {
          selectedRating = rating;
          ratingTag.textContent = `Selecciona: ${selectedRating}`;
          pickerButtons.forEach((btn, index) => {
            btn.classList.toggle("active", index < selectedRating);
          });
          submitRatingBtn.disabled = false;
        };
        pickerButtons.push(starBtn);
        ratingInput.appendChild(starBtn);
      }

      const zeroBtn = document.createElement("button");
      zeroBtn.className = "star-rate-btn";
      zeroBtn.type = "button";
      zeroBtn.textContent = "0";
      zeroBtn.title = "0 estrellas";
      zeroBtn.onclick = () => {
        selectedRating = 0;
        ratingTag.textContent = "Selecciona: 0";
        pickerButtons.forEach((btn) => btn.classList.remove("active"));
        submitRatingBtn.disabled = false;
      };
      ratingInput.appendChild(zeroBtn);

      const submitRatingBtn = document.createElement("button");
      submitRatingBtn.className = "primary-btn";
      submitRatingBtn.type = "button";
      submitRatingBtn.textContent = "Calificar";
      submitRatingBtn.disabled = true;
      submitRatingBtn.onclick = () => onRateMatch(match.id, selectedRating ?? 0);
      ratingInput.appendChild(submitRatingBtn);

      actions.appendChild(ratingInput);
    }

    card.appendChild(actions);
    myMatchesGrid.appendChild(card);
  });
}
