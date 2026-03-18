import { starText } from "./ui.js";

export function renderMatchStatusLabel(match) {
  if (match.status === "completed") {
    return "Finalizado";
  }
  return match.my_finalized ? "En proceso · Esperando al otro usuario" : "En proceso";
}

export function renderRatingStars(match) {
  if (match.my_rating !== null && match.my_rating !== undefined) {
    return `<span class="stars-line">${starText(match.my_rating, 5)}</span><div class="stars-detail">Tu calificacion: ${match.my_rating}/5</div>`;
  }
  return "<span class=\"stars-detail\">Aun no calificas este match</span>";
}
