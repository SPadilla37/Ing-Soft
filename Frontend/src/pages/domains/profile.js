export function normalizeProfileFromUserDomain(user) {
  if (!user) return null;
  const profile = user.profile || {};
  const languages = String(profile.language || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // Soportar tanto nombres de campo del contrato nuevo como del esquema viejo
  const nombre = profile.nombre || profile.full_name || user.name || user.nombre || "";
  const apellido = profile.apellido || user.apellido || "";
  const fullName = apellido ? `${nombre} ${apellido}`.trim() : nombre;

  const teachSkills = Array.isArray(profile.habilidades_ofertadas)
    ? profile.habilidades_ofertadas
    : Array.isArray(profile.teach_skills)
      ? profile.teach_skills
      : [];

  const learnSkills = Array.isArray(profile.habilidades_buscadas)
    ? profile.habilidades_buscadas
    : Array.isArray(profile.learn_skills)
      ? profile.learn_skills
      : [];

  return {
    fullName,
    nombre,
    apellido,
    bio: profile.biografia || profile.bio || "",
    foto_url: profile.foto_url || "",
    teachSkills,
    learnSkills,
    languages,
    marketplaceMessage: profile.marketplace_message || "",
  };
}

export async function loadCurrentUserFromApiDomain({ currentUser, api, setCurrentUserRecord, saveProfile }) {
  if (!currentUser) return;
  const result = await api(`/usuarios/${encodeURIComponent(currentUser)}`);
  setCurrentUserRecord(result.user);
  const normalized = normalizeProfileFromUserDomain(result.user);
  if (normalized) {
    saveProfile(normalized);
  }
}

export async function persistProfileToApiDomain({ currentUser, api, profile, setCurrentUserRecord, saveProfile }) {
  if (!currentUser) return;
  const result = await api(`/usuarios/${encodeURIComponent(currentUser)}/profile`, {
    method: "PUT",
    body: JSON.stringify({
      nombre: profile.nombre || profile.fullName || "",
      apellido: profile.apellido || "",
      foto_url: profile.foto_url || "",
      biografia: profile.bio || "",
      habilidades_ofertadas: profile.teachSkills || [],
      habilidades_buscadas: profile.learnSkills || [],
    }),
  });
  setCurrentUserRecord(result.user);
  const normalized = normalizeProfileFromUserDomain(result.user);
  if (normalized) {
    saveProfile(normalized);
  }
}

export async function fetchProfileForPublicViewDomain({
  userId,
  currentUser,
  getProfile,
  getCurrentUserRecord,
  api,
}) {
  if (userId === currentUser) {
    const currentProfile = getProfile() || {};
    return {
      id: currentUser,
      name: currentProfile.fullName || getCurrentUserRecord()?.name || currentUser,
      profile: {
        full_name: currentProfile.fullName || getCurrentUserRecord()?.name || currentUser,
        bio: currentProfile.bio || "",
        teach_skills: currentProfile.teachSkills || [],
        learn_skills: currentProfile.learnSkills || [],
        language: (currentProfile.languages || []).join(", "),
      },
    };
  }

  const result = await api(`/usuarios/${encodeURIComponent(userId)}`);
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
  publicProfileLanguages,
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

    publicProfileAvatar.textContent = getInitials(normalized.fullName || user.name || user.id);
    publicProfileName.textContent = normalized.fullName || user.name || user.id;
    publicProfileBio.textContent = normalized.bio || "Sin descripcion publica todavia.";
    publicProfileSummary.textContent = user.id === currentUser
      ? "Estos son los idiomas visibles en tu perfil publico."
      : `Idiomas visibles en el perfil publico de ${normalized.fullName || user.name || user.id}.`;

    renderSummaryChips(publicProfileLanguages, normalized.languages || []);
    renderSummaryChips(publicProfileTeachChips, normalized.teachSkills || []);
    renderSummaryChips(publicProfileLearnChips, normalized.learnSkills || []);

    if (averageRating === null || averageRating === undefined || !ratingCount) {
      publicProfileRating.innerHTML = "<span class=\"stars-detail\">No reviews yet</span>";
    } else {
      const averageValue = Number(averageRating);
      publicProfileRating.innerHTML = `<span class="stars-line">${starText(averageValue, 5)}</span><div class="stars-detail">${averageValue.toFixed(2)} / 5 (${ratingCount} calificaciones)</div>`;
    }

    if (user.id === currentUser) {
      publicProfilePrimaryBtn.textContent = "Edit Profile";
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

export function updateProfileTriggerTextsDomain({ $, profileTeachDraft, profileLearnDraft, profileLanguagesDraft }) {
  $("openProfileTeachPickerBtn").textContent = profileTeachDraft.size
    ? Array.from(profileTeachDraft).join(", ")
    : "Seleccionar habilidades";
  $("openProfileLearnPickerBtn").textContent = profileLearnDraft.size
    ? Array.from(profileLearnDraft).join(", ")
    : "Seleccionar habilidades";
  $("openProfileLanguagePickerBtn").textContent = profileLanguagesDraft.size
    ? Array.from(profileLanguagesDraft).join(", ")
    : "Seleccionar idiomas";
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
  setProfileLanguagesDraft,
}) {
  const profile = getProfile() || {};
  $("profileFullName").value = profile.fullName || "";
  $("profileBio").value = profile.bio || "";
  $("publishOfferedSkill").value = (profile.teachSkills || []).join(", ");
  $("publishRequestedSkill").value = (profile.learnSkills || []).join(", ");
  $("publishIntroMessage").value = profile.marketplaceMessage || "";
  profileAvatarLarge.textContent = getInitials(profile.fullName || currentUser);

  setProfileTeachDraft(new Set(profile.teachSkills || []));
  setProfileLearnDraft(new Set(profile.learnSkills || []));
  setProfileLanguagesDraft(new Set(profile.languages || []));

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
  renderSelectedSummary("language", "profile");

  $("publishSummaryText").textContent = profile.fullName
    ? `${profile.fullName}. Puedes editar tus habilidades e idiomas en Perfil.`
    : "Completa tu perfil y publica tu solicitud para aparecer aqui.";
  renderTopBar();
}

export async function saveProfileFromDashboardDomain({
  $,
  getProfile,
  profileTeachDraft,
  profileLearnDraft,
  profileLanguagesDraft,
  saveProfile,
  persistProfileToApi,
  hydrateProfileUI,
  log,
}) {
  const previous = getProfile() || {};
  const profile = {
    ...previous,
    fullName: $("profileFullName").value.trim(),
    bio: $("profileBio").value.trim(),
    teachSkills: Array.from(profileTeachDraft),
    learnSkills: Array.from(profileLearnDraft),
    languages: Array.from(profileLanguagesDraft),
    marketplaceMessage: previous.marketplaceMessage || $("publishIntroMessage").value.trim(),
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
