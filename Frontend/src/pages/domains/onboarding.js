export function getPickerSelectionDomain({
  mode,
  source,
  profileTeachDraft,
  profileLearnDraft,
  profileLanguagesDraft,
  onboardingTeach,
  onboardingLearn,
  onboardingLanguages,
}) {
  if (source === "profile") {
    if (mode === "teach") return profileTeachDraft;
    if (mode === "learn") return profileLearnDraft;
    return profileLanguagesDraft;
  }

  if (mode === "teach") return onboardingTeach;
  if (mode === "learn") return onboardingLearn;
  return onboardingLanguages;
}

export function renderSelectedSummaryDomain({
  type,
  source = "onboarding",
  renderSummaryChips,
  getPickerSelection,
  profileTeachChips,
  profileLearnChips,
  profileLanguageChips,
  teachSummary,
  learnSummary,
  languageSummary,
  updateProfileTriggerTexts,
}) {
  const selected = Array.from(getPickerSelection(type, source));
  if (source === "profile") {
    if (type === "teach") renderSummaryChips(profileTeachChips, selected);
    else if (type === "learn") renderSummaryChips(profileLearnChips, selected);
    else renderSummaryChips(profileLanguageChips, selected);
    updateProfileTriggerTexts();
    return;
  }

  if (type === "teach") renderSummaryChips(teachSummary, selected);
  else if (type === "learn") renderSummaryChips(learnSummary, selected);
  else renderSummaryChips(languageSummary, selected);
}

export function renderPickerCategoriesDomain({
  pickerMode,
  pickerCategory,
  pickerCategoryChips,
  skillsCatalog,
  setPickerCategory,
  renderPickerCategories,
  renderPickerSkills,
}) {
  pickerCategoryChips.innerHTML = "";
  if (pickerMode === "language") {
    pickerCategoryChips.classList.add("hidden");
    return;
  }

  pickerCategoryChips.classList.remove("hidden");
  Object.keys(skillsCatalog).forEach((category) => {
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
  skillsCatalog,
  languagesCatalog,
  getPickerSelection,
  renderSelectedSummary,
}) {
  const selected = getPickerSelection();
  const query = pickerSearchInput.value.trim().toLowerCase();
  pickerSkillsList.innerHTML = "";

  if (pickerMode === "language") {
    const wrap = document.createElement("div");
    wrap.className = "picker-option-list";

    languagesCatalog
      .filter((language) => language.toLowerCase().includes(query))
      .forEach((language) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `picker-option${selected.has(language) ? " active" : ""}`;
        item.innerHTML = `<span>${language}</span><span>${selected.has(language) ? "Seleccionado" : "+"}</span>`;
        item.onclick = () => {
          if (selected.has(language)) selected.delete(language);
          else selected.add(language);
          renderPickerSkillsDomain({
            pickerMode,
            pickerCategory,
            pickerSource,
            pickerSearchInput,
            pickerSkillsList,
            skillsCatalog,
            languagesCatalog,
            getPickerSelection,
            renderSelectedSummary,
          });
          renderSelectedSummary("language", pickerSource);
        };
        wrap.appendChild(item);
      });

    if (!wrap.children.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No hay idiomas para esa busqueda.";
      pickerSkillsList.appendChild(empty);
    } else {
      pickerSkillsList.appendChild(wrap);
    }
    return;
  }

  Object.entries(skillsCatalog)
    .filter(([category]) => category !== "All")
    .filter(([category]) => pickerCategory === "All" || category === pickerCategory)
    .forEach(([category, skills]) => {
      const filteredSkills = skills.filter((skill) => skill.toLowerCase().includes(query));
      if (!filteredSkills.length) return;

      const block = document.createElement("div");
      block.className = "category-block";
      const title = document.createElement("strong");
      title.textContent = category;
      block.appendChild(title);

      const wrap = document.createElement("div");
      wrap.className = "skills-wrap";
      filteredSkills.forEach((skill) => {
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
            skillsCatalog,
            languagesCatalog,
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
  pickerSearchInput.placeholder = mode === "language" ? "Search languages..." : "Search skills...";
  if (mode === "teach") pickerTitle.textContent = source === "profile" ? "Skills you want to teach" : "Selecciona habilidades para ofrecer";
  else if (mode === "learn") pickerTitle.textContent = source === "profile" ? "Skills you want to learn" : "Selecciona habilidades para aprender";
  else pickerTitle.textContent = "Languages you speak";
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
  onboardingLanguages,
  saveProfile,
  persistProfileToApi,
  hydrateProfileUI,
  ensureOnboardingOrDashboard,
  publishRequest,
}) {
  const fullName = $("fullName").value.trim();
  const bio = $("bio").value.trim();
  if (!fullName || !bio || !onboardingTeach.size || !onboardingLearn.size || !onboardingLanguages.size) {
    alert("Completa todos los datos y selecciona habilidades e idiomas.");
    return;
  }

  const profile = {
    fullName,
    bio,
    teachSkills: Array.from(onboardingTeach),
    learnSkills: Array.from(onboardingLearn),
    languages: Array.from(onboardingLanguages),
    marketplaceMessage: `Hola, puedo ensenar ${Array.from(onboardingTeach).join(", ")} y quiero aprender ${Array.from(onboardingLearn).join(", ")}.`,
  };

  saveProfile(profile);
  try {
    await persistProfileToApi(profile);
  } catch (error) {
    alert(`No se pudo guardar el perfil en la base de datos: ${error.message}`);
    return;
  }

  hydrateProfileUI();
  await ensureOnboardingOrDashboard();
  await publishRequest(true);
}
