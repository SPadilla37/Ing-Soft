import {
  LIMITS,
  validateOptionalTrimmed,
  validatePublishMessage,
  validateRequiredTrimmed,
} from "../../utils/validation.js";

export function getPickerSelectionDomain({
  mode,
  source,
  profileTeachDraft,
  profileLearnDraft,
  onboardingTeach,
  onboardingLearn,
}) {
  if (source === "profile") {
    if (mode === "teach") return profileTeachDraft;
    if (mode === "learn") return profileLearnDraft;
    return new Set();
  }

  if (mode === "teach") return onboardingTeach;
  if (mode === "learn") return onboardingLearn;
  return new Set();
}

export function renderSelectedSummaryDomain({
  type,
  source = "onboarding",
  renderSummaryChips,
  getPickerSelection,
  profileTeachChips,
  profileLearnChips,
  teachSummary,
  learnSummary,
  updateProfileTriggerTexts,
}) {
  const selected = Array.from(getPickerSelection(type, source));
  if (source === "profile") {
    if (type === "teach") renderSummaryChips(profileTeachChips, selected);
    else if (type === "learn") renderSummaryChips(profileLearnChips, selected);
    updateProfileTriggerTexts();
    return;
  }

  if (type === "teach") renderSummaryChips(teachSummary, selected);
  else if (type === "learn") renderSummaryChips(learnSummary, selected);
}

export function renderPickerCategoriesDomain({
  pickerMode,
  pickerCategory,
  pickerCategoryChips,
  skillsByCategory,
  setPickerCategory,
  renderPickerCategories,
  renderPickerSkills,
}) {
  pickerCategoryChips.innerHTML = "";
  const categories = Object.keys(skillsByCategory).sort();
  categories.forEach((category) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `chip${pickerCategory === category ? " active" : ""}`;
    chip.textContent = category;
    chip.onclick = () => {
      setPickerCategory(category);
      renderPickerCategories();
      renderPickerSkills();
    };
    pickerCategoryChips.appendChild(chip);
  });
}

export function renderPickerSkillsDomain({
  pickerMode,
  pickerCategory,
  pickerSource,
  pickerSearchInput,
  pickerSkillsList,
  skillsByCategory,
  getPickerSelection,
  renderSelectedSummary,
}) {
  const selected = getPickerSelection();
  const query = pickerSearchInput.value.trim().toLowerCase();
  pickerSkillsList.innerHTML = "";

  const categories = Object.keys(skillsByCategory).sort();
  categories.forEach((category) => {
    if (pickerCategory !== "All" && category !== pickerCategory) return;

    const skills = (skillsByCategory[category] || []).filter((skill) => skill.toLowerCase().includes(query));
    if (!skills.length) return;

    const block = document.createElement("div");
    block.className = "category-block";
    const title = document.createElement("strong");
    title.textContent = category;
    block.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "skills-wrap";
    skills.forEach((skill) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `skill-chip${selected.has(skill) ? " active" : ""}`;
      chip.textContent = skill;
      chip.onclick = () => {
        if (selected.has(skill)) {
          selected.delete(skill);
        } else {
          selected.add(skill);
        }
        renderPickerSkillsDomain({
          pickerMode,
          pickerCategory,
          pickerSource,
          pickerSearchInput,
          pickerSkillsList,
          skillsByCategory,
          getPickerSelection,
          renderSelectedSummary,
        });
        renderSelectedSummary(pickerMode, pickerSource);
      };
      wrap.appendChild(chip);
    });

    block.appendChild(wrap);
    pickerSkillsList.appendChild(block);
  });

  if (!pickerSkillsList.children.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No hay habilidades para esa busqueda.";
    pickerSkillsList.appendChild(empty);
  }
}

export function openSkillPickerDomain({
  mode,
  source = "onboarding",
  pickerSearchInput,
  pickerTitle,
  skillPickerOverlay,
  setPickerMode,
  setPickerSource,
  setPickerCategory,
  renderPickerCategories,
  renderPickerSkills,
}) {
  setPickerMode(mode);
  setPickerSource(source);
  setPickerCategory("All");
  pickerSearchInput.value = "";
  pickerSearchInput.placeholder = "Buscar habilidades...";
  if (mode === "teach") pickerTitle.textContent = source === "profile" ? "Habilidades que quieres enseñar" : "Selecciona habilidades para ofrecer";
  else if (mode === "learn") pickerTitle.textContent = source === "profile" ? "Habilidades que quieres aprender" : "Selecciona habilidades para aprender";
  renderPickerCategories();
  renderPickerSkills();
  skillPickerOverlay.classList.remove("hidden");
}

export function closeSkillPickerDomain({ skillPickerOverlay }) {
  skillPickerOverlay.classList.add("hidden");
}

export async function completeOnboardingDomain({
  $,
  onboardingTeach,
  onboardingLearn,
  saveProfile,
  persistProfileToApi,
  hydrateProfileUI,
  ensureOnboardingOrDashboard,
  publishRequest,
}) {
  const nameCheck = validateRequiredTrimmed($("fullName").value, "El nombre", LIMITS.nombreMax);
  if (!nameCheck.ok) {
    alert(nameCheck.message);
    return;
  }
  const lastCheck = validateOptionalTrimmed($("lastName").value, LIMITS.nombreMax, "El apellido");
  if (!lastCheck.ok) {
    alert(lastCheck.message);
    return;
  }
  const bioCheck = validateRequiredTrimmed($("bio").value, "La biografia", LIMITS.bioMax);
  if (!bioCheck.ok) {
    alert(bioCheck.message);
    return;
  }
  if (!onboardingTeach.size || !onboardingLearn.size) {
    alert("Selecciona habilidades para ofrecer y para aprender.");
    return;
  }

  const fullName = nameCheck.value;
  const lastName = lastCheck.value;
  const bio = bioCheck.value;

  const profile = {
    fullName: fullName + (lastName ? " " + lastName : ""),
    bio,
    teachSkills: Array.from(onboardingTeach),
    learnSkills: Array.from(onboardingLearn),
    marketplaceMessage: `Hola, puedo ensenar ${Array.from(onboardingTeach).join(", ")} y quiero aprender ${Array.from(onboardingLearn).join(", ")}.`,
  };

  const autoMsgCheck = validatePublishMessage(profile.marketplaceMessage);
  if (!autoMsgCheck.ok) {
    alert(
      `${autoMsgCheck.message} Reduce la cantidad de habilidades seleccionadas o acorta los nombres.`,
    );
    return;
  }

  const persistData = {
    ...profile,
    lastName,
  };

  saveProfile(profile);
  try {
    await persistProfileToApi(persistData);
  } catch (error) {
    alert(`No se pudo guardar el perfil en la base de datos: ${error.message}`);
    return;
  }

  hydrateProfileUI();
  await ensureOnboardingOrDashboard();
  await publishRequest(true);
}
