import { starText } from "./ui.js";

export function renderMatchStatusLabel(match) {
  if (match.estado === "completado") {
    return "Finalizado";
  }
  return match.can_finalize ? "En proceso · Esperando al otro usuario" : "En proceso";
}

export function renderRatingStars(match) {
  const myRating = match.my_reseña?.calificacion;
  if (myRating !== null && myRating !== undefined) {
    return `<span class="stars-line">${starText(myRating, 5)}</span><div class="stars-detail">Tu calificacion: ${myRating}/5</div>`;
  }
  return "<span class=\"stars-detail\">Aun no calificas este match</span>";
}
