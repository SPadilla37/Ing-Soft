export function getInitials(text) {
  const clean = (text || "?").trim();
  return clean ? clean.slice(0, 1).toUpperCase() : "?";
}

export function setStatus(target, message, type = "info") {
  if (!target) return;
  target.textContent = message;
  if (type === "ok") {
    target.style.color = "#7ce4b3";
  } else if (type === "error") {
    target.style.color = "#ff9cb0";
  } else {
    target.style.color = "";
  }
}

export function displayUserName(request, role = "from") {
  if (role === "from") {
    return request.from_user_name || request.from_user_id;
  }
  return request.to_user_name || request.to_user_id || "-";
}

export function renderSummaryChips(target, values) {
  target.innerHTML = "";
  if (!values.length) {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = "Sin seleccion";
    target.appendChild(chip);
    return;
  }

  values.forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = value;
    target.appendChild(chip);
  });
}

export function starText(value, max = 5) {
  const safeValue = Math.max(0, Math.min(max, Number(value) || 0));
  const full = Math.round(safeValue);
  return "★".repeat(full) + "☆".repeat(Math.max(0, max - full));
}
