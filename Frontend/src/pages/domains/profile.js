import { LIMITS, validateOptionalTrimmed, validateProfileFullName, validateRequiredTrimmed } from "../../utils/validation.js";

export function normalizeProfileFromUserDomain(user) {
  if (!user) return null;
  const teachSkills = Array.isArray(user.habilidades_ofertadas)
    ? user.habilidades_ofertadas.map((h) => h.nombre)
    : [];
  const learnSkills = Array.isArray(user.habilidades_busçadas)
    ? user.habilidades_busçadas.map((h) => h.nombre)
    : [];
  return {
    fullName: `${user.nombre || ""} ${user.apellido || ""}`.trim() || "",
    bio: user.biografia || "",
    teachSkills,
    learnSkills,
    marketplaceMessage: user.biografia || "",
  };
}

export async function loadCurrentUserFromApiDomain({ currentUser, api, saveProfile, setCurrentUserRecord }) {
  if (!currentUser) return;
  const result = await api(`/usuarios/${currentUser}`);
  setCurrentUserRecord(result.user);
  const normalized = normalizeProfileFromUserDomain(result.user);
  if (normalized) {
    saveProfile(normalized);
  }
}

export async function persistProfileToApiDomain({ currentUser, api, profile, saveProfile }) {
  if (!currentUser) return;
  const fullNameParts = (profile.fullName || "").split(" ");
  const nombre = fullNameParts[0] || "";
  const apellido = profile.lastName?.trim() || fullNameParts.slice(1).join(" ") || "";

  const { getSkillIdByName } = await import("../../config/constants.js");
  const habilidadesOfertadas = (profile.teachSkills || [])
    .map((name) => getSkillIdByName(name))
    .filter((id) => id != null);
  const habilidadesBuscadas = (profile.learnSkills || [])
    .map((name) => getSkillIdByName(name))
    .filter((id) => id != null);

  const result = await api(`/usuarios/${currentUser}/profile`, {
    method: "PUT",
    body: JSON.stringify({
      nombre,
      apellido,
      biografia: profile.bio || "",
      habilidades_ofertadas: habilidadesOfertadas,
      habilidades_busçadas: habilidadesBuscadas,
    }),
  });
  saveProfile(profile);
}

export async function fetchProfileForPublicViewDomain({
  userId,
  currentUser,
  getProfile,
  getCurrentUserRecord,
  api,
}) {
  if (String(userId) === String(currentUser)) {
    const currentProfile = getProfile() || {};
    return {
      id: currentUser,
      nombre: currentProfile.fullName || getCurrentUserRecord()?.nombre || "",
      apellido: "",
      habilidades_ofertadas: (currentProfile.teachSkills || []).map((n) => ({ nombre: n })),
      habilidades_busçadas: (currentProfile.learnSkills || []).map((n) => ({ nombre: n })),
      biografia: currentProfile.bio || "",
      rating: getCurrentUserRecord()?.rating || { average: null, count: 0 },
    };
  }

  const result = await api(`/usuarios/${userId}`);
  return result.user;
}

export async function openPublicProfileDomain({
  userId,
  returnView = "matchesView",
  currentUser,
  api,
  getProfile,
  getCurrentUserRecord,
  setPublicProfileUserId,
  setPublicProfileReturnView,
  publicProfileAvatar,
  publicProfileName,
  publicProfileBio,
  publicProfileSummary,
  publicProfileTeachChips,
  publicProfileLearnChips,
  publicProfileRating,
  publicProfilePrimaryBtn,
  getInitials,
  renderSummaryChips,
  starText,
  activateView,
}) {
  try {
    const user = await fetchProfileForPublicViewDomain({
      userId,
      currentUser,
      getProfile,
      getCurrentUserRecord,
      api,
    });

    const normalized = normalizeProfileFromUserDomain(user);
    const averageRating = user?.rating?.average;
    const ratingCount = user?.rating?.count || 0;

    setPublicProfileUserId(user.id);
    setPublicProfileReturnView(returnView);

    const fullName = normalized.fullName || `${user.nombre || ""} ${user.apellido || ""}`.trim();
    publicProfileAvatar.textContent = getInitials(fullName || String(userId));
    publicProfileName.textContent = fullName || String(userId);
    publicProfileBio.textContent = normalized.bio || "Sin descripcion publica todavia.";
    publicProfileSummary.textContent = user.id === currentUser
      ? "Este es tu perfil publico."
      : `Perfil de ${fullName || userId}.`;

    renderSummaryChips(publicProfileTeachChips, normalized.teachSkills || []);
    renderSummaryChips(publicProfileLearnChips, normalized.learnSkills || []);

    if (averageRating === null || averageRating === undefined || !ratingCount) {
      publicProfileRating.innerHTML = "<span class=\"stars-detail\">Aun no hay reseñas</span>";
    } else {
      const averageValue = Number(averageRating);
      publicProfileRating.innerHTML = `<span class="stars-line">${starText(averageValue, 5)}</span><div class="stars-detail">${averageValue.toFixed(2)} / 5 (${ratingCount} calificaciones)</div>`;
    }

    if (String(user.id) === String(currentUser)) {
      publicProfilePrimaryBtn.textContent = "Editar perfil";
      publicProfilePrimaryBtn.onclick = () => {
        activateView("profileView");
      };
    } else {
      publicProfilePrimaryBtn.textContent = "Volver a Matches";
      publicProfilePrimaryBtn.onclick = () => {
        activateView(returnView);
      };
    }

    activateView("publicProfileView");
  } catch (error) {
    alert(`No se pudo cargar el perfil publico: ${error.message}`);
  }
}

export function closePublicProfileDomain({ publicProfileReturnView, setPublicProfileUserId, activateView }) {
  setPublicProfileUserId("");
  activateView(publicProfileReturnView || "matchesView");
}

export function updateProfileTriggerTextsDomain({ $, profileTeachDraft, profileLearnDraft }) {
  $("openProfileTeachPickerBtn").textContent = profileTeachDraft.size
    ? Array.from(profileTeachDraft).join(", ")
    : "Seleccionar habilidades";
  $("openProfileLearnPickerBtn").textContent = profileLearnDraft.size
    ? Array.from(profileLearnDraft).join(", ")
    : "Seleccionar habilidades";
}

export function hydrateProfileUIDomain({
  $,
  currentUser,
  getProfile,
  getInitials,
  renderSelectedSummary,
  renderTopBar,
  profileAvatarLarge,
  teachPreview,
  learnPreview,
  setProfileTeachDraft,
  setProfileLearnDraft,
}) {
  const profile = getProfile() || {};
  $("profileFullName").value = profile.fullName || "";
  $("profileBio").value = profile.bio || "";
  $("publishIntroMessage").value = profile.marketplaceMessage || "";
  const visibleName = profile.fullName || String(currentUser);
  profileAvatarLarge.textContent = getInitials(visibleName);

  setProfileTeachDraft(new Set(profile.teachSkills || []));
  setProfileLearnDraft(new Set(profile.learnSkills || []));

  teachPreview.innerHTML = "";
  learnPreview.innerHTML = "";

  (profile.teachSkills || []).forEach((skill) => {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = skill;
    teachPreview.appendChild(chip);
  });

  (profile.learnSkills || []).forEach((skill) => {
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.textContent = skill;
    learnPreview.appendChild(chip);
  });

  renderSelectedSummary("teach", "profile");
  renderSelectedSummary("learn", "profile");

  $("publishSummaryText").textContent = profile.fullName
    ? `${profile.fullName}. Puedes editar tus habilidades en Perfil.`
    : "Completa tu perfil y publica tu solicitud para aparecer aqui.";
  renderTopBar();
}

export async function saveProfileFromDashboardDomain({
  $,
  getProfile,
  profileTeachDraft,
  profileLearnDraft,
  saveProfile,
  persistProfileToApi,
  hydrateProfileUI,
  log,
}) {
  const nameCheck = validateProfileFullName($("profileFullName").value);
  if (!nameCheck.ok) {
    alert(nameCheck.message);
    return;
  }
  const bioCheck = validateRequiredTrimmed($("profileBio").value, "La biografia", LIMITS.bioMax);
  if (!bioCheck.ok) {
    alert(bioCheck.message);
    return;
  }
  const introCheck = validateOptionalTrimmed(
    $("publishIntroMessage").value,
    LIMITS.messageRequestMax,
    "El mensaje para el mercado",
  );
  if (!introCheck.ok) {
    alert(introCheck.message);
    return;
  }

  const previous = getProfile() || {};
  const profile = {
    ...previous,
    fullName: nameCheck.value,
    bio: bioCheck.value,
    teachSkills: Array.from(profileTeachDraft),
    learnSkills: Array.from(profileLearnDraft),
    marketplaceMessage: introCheck.value || previous.marketplaceMessage || "",
  };

  saveProfile(profile);
  try {
    await persistProfileToApi(profile);
  } catch (error) {
    alert(`No se pudo guardar el perfil en la base de datos: ${error.message}`);
    return;
  }

  hydrateProfileUI();
  log("Perfil actualizado.");
}
