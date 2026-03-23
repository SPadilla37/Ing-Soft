import { getInitials } from "./ui.js";
import { renderMatchStatusLabel, renderRatingStars } from "./matches.js";

function userMatchesCategory(user, selectedCategory) {
  if (selectedCategory === "Todos") return true;
  const categoryLower = selectedCategory.toLowerCase();
  const offered = user.habilidades_ofertadas || [];
  const searched = user.habilidades_busçadas || [];
  return offered.some((h) => (h.nombre || "").toLowerCase().includes(categoryLower))
    || searched.some((h) => (h.nombre || "").toLowerCase().includes(categoryLower));
}

export function renderMarketplaceSection({
  users,
  selectedCategory,
  searchQuery,
  marketplaceGrid,
  marketplaceTotalEl,
  matchesCountBadgeEl,
  onAcceptRequest,
  onOpenMatchedConversation,
  onShowRequestDetails,
}) {
  marketplaceGrid.innerHTML = "";
  const filtered = users.filter((user) => {
    const matchState = user.viewer_match_state || "none";
    if (matchState === "matched") {
      return false;
    }
    if (!userMatchesCategory(user, selectedCategory)) {
      return false;
    }
    return true;
  });

  marketplaceTotalEl.textContent = String(filtered.length);
  matchesCountBadgeEl.textContent = String(filtered.length);

  if (!filtered.length) {
    const card = document.createElement("div");
    card.className = "surface-card";
    card.innerHTML = searchQuery
      ? "<h3>No hay resultados para esa busqueda</h3><p>Prueba con otras palabras o cambia de categoria.</p>"
      : "<h3>No hay usuarios compatibles todavia</h3><p>Completa tu perfil con habilidades para encontrar matches.</p>";
    marketplaceGrid.appendChild(card);
    return;
  }

  filtered.forEach((user) => {
    const authorName = `${user.nombre || ""} ${user.apellido || ""}`.trim() || "Usuario";
    const matchState = user.viewer_match_state || "none";
    const offeredSkills = (user.habilidades_ofertadas || []).map((h) => h.nombre).join(", ") || "-";
    const searchedSkills = (user.habilidades_busçadas || []).map((h) => h.nombre).join(", ") || "-";
    const bio = user.biografia || "";
    const card = document.createElement("article");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-head">
        <div class="match-avatar">${getInitials(authorName)}</div>
        <div>
          <h3>${authorName}</h3>
          <div class="muted">${matchState === "received" ? "Quiere intercambiar contigo" : matchState === "sent" ? "Intercambio pendiente" : matchState === "mutual-pending" ? "Intercambio mutuo pendiente" : "Compatible contigo"}</div>
        </div>
      </div>
      ${bio ? `<div><div class="muted">Biografia</div><div>${bio}</div></div>` : ""}
      <div>
        <div class="muted">Te puede ensenar:</div>
        <div class="strong-list">${offeredSkills}</div>
      </div>
      <div>
        <div class="muted">Quiere aprender:</div>
        <div class="strong-list">${searchedSkills}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const matchBtn = document.createElement("button");
    matchBtn.type = "button";

    if (matchState === "matched") {
      matchBtn.className = "secondary-btn";
      matchBtn.textContent = "Abrir chat";
      matchBtn.onclick = () => onOpenMatchedConversation(user.viewer_conversation_id);
    } else if (matchState === "mutual-pending") {
      matchBtn.className = "primary-btn";
      matchBtn.textContent = "Aceptar";
      matchBtn.onclick = () => onAcceptRequest(user.id);
    } else if (matchState === "sent") {
      matchBtn.className = "secondary-btn";
      matchBtn.textContent = "Interes enviado";
      matchBtn.disabled = true;
    } else if (matchState === "received") {
      matchBtn.className = "primary-btn";
      matchBtn.textContent = "Aceptar";
      matchBtn.onclick = () => onAcceptRequest(user.id);
    } else {
      matchBtn.className = "primary-btn";
      matchBtn.textContent = "Aceptar";
      matchBtn.onclick = () => onAcceptRequest(user.id);
    }

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "ghost-btn";
    detailsBtn.type = "button";
    detailsBtn.textContent = "Ir al perfil";
    detailsBtn.onclick = () => onShowRequestDetails({ from_user_id: user.id }, "matchesView");

    actions.appendChild(matchBtn);
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

    const emisorId = emisor.id || item.usuario_emisor_id;
    const respondBtn = document.createElement("button");
    respondBtn.className = "primary-btn";
    respondBtn.type = "button";
    respondBtn.textContent = "Responder match";
    respondBtn.onclick = () => onAcceptRequest(emisorId, item.id);

    const profileBtn = document.createElement("button");
    profileBtn.className = "ghost-btn";
    profileBtn.type = "button";
    profileBtn.textContent = "Ir al perfil";
    profileBtn.onclick = () => onShowRequestDetails({ from_user_id: emisorId }, "incomingMatchesView");

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
    profileBtn.textContent = "Ir al perfil";
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
