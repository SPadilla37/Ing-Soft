import { API_BASE, dbKeyProfilePrefix, dbKeySession, languagesCatalog, skillsCatalog } from "../config/constants.js";
import { api as apiRequest } from "../services/api.js";
import { wsUrl } from "../services/websocket.js";
import { getInitials, renderSummaryChips, setStatus, starText } from "../components/ui.js";
import { renderIncomingMatchesSection, renderMarketplaceSection, renderMyMatchesSection } from "../components/marketplace.js";
import { connectConversationSocket, disconnectConversationSocket, renderConversationsSection, sendConversationMessage } from "../services/chat.js";
import { loginDomain, setAuthModeDomain, signupDomain } from "./domains/auth.js";
import {
  closeSkillPickerDomain,
  completeOnboardingDomain,
  getPickerSelectionDomain,
  openSkillPickerDomain,
  renderPickerCategoriesDomain,
  renderPickerSkillsDomain,
  renderSelectedSummaryDomain,
} from "./domains/onboarding.js";
import {
  closePublicProfileDomain,
  loadCurrentUserFromApiDomain,
  normalizeProfileFromUserDomain,
  openPublicProfileDomain,
  persistProfileToApiDomain,
  saveProfileFromDashboardDomain,
  updateProfileTriggerTextsDomain,
  hydrateProfileUIDomain,
} from "./domains/profile.js";

const $ = (id) => document.getElementById(id);

    const authScreen = $("authScreen");
    const onboardingModal = $("onboardingModal");
    const skillPickerOverlay = $("skillPickerOverlay");
    const dashboard = $("dashboard");
    const chatBox = $("chatBox");
    const marketplaceGrid = $("marketplaceGrid");
    const incomingMatchesGrid = $("incomingMatchesGrid");
    const myMatchesGrid = $("myMatchesGrid");
    const conversationsList = $("conversationsList");
    const dashboardCategoryChips = $("dashboardCategoryChips");
    const teachSummary = $("teachSummary");
    const learnSummary = $("learnSummary");
    const languageSummary = $("languageSummary");
    const teachPreview = $("teachPreview");
    const learnPreview = $("learnPreview");
    const profileTeachChips = $("profileTeachChips");
    const profileLearnChips = $("profileLearnChips");
    const profileLanguageChips = $("profileLanguageChips");
    const pickerTitle = $("pickerTitle");
    const pickerSearchInput = $("pickerSearchInput");
    const pickerCategoryChips = $("pickerCategoryChips");
    const pickerSkillsList = $("pickerSkillsList");
    const publishStatus = $("publishStatus");
    const chatStatus = $("chatStatus");
    const profileAvatarLarge = $("profileAvatarLarge");
    const topShell = document.querySelector(".top-shell");
    const searchShell = document.querySelector(".search-shell");
    const publicProfileAvatar = $("publicProfileAvatar");
    const publicProfileName = $("publicProfileName");
    const publicProfileBio = $("publicProfileBio");
    const publicProfileSummary = $("publicProfileSummary");
    const publicProfileLanguages = $("publicProfileLanguages");
    const publicProfileRating = $("publicProfileRating");
    const publicProfileTeachChips = $("publicProfileTeachChips");
    const publicProfileLearnChips = $("publicProfileLearnChips");
    const publicProfilePrimaryBtn = $("publicProfilePrimaryBtn");
    const deleteConfirmModal = $("deleteConfirmModal");

    let currentUser = null;
    let currentUserRecord = null;
    const socketState = { socket: null, connectedConversationId: "" };
    let selectedCategory = "All";
    let selectedConversationId = "";
    let onboardingTeach = new Set();
    let onboardingLearn = new Set();
    let onboardingLanguages = new Set();
    let profileTeachDraft = new Set();
    let profileLearnDraft = new Set();
    let profileLanguagesDraft = new Set();
    let currentMarketplace = [];
    let currentIncomingMatches = [];
    let currentMyMatches = [];
    let currentConversations = [];
    let pickerMode = "teach";
    let pickerSource = "onboarding";
    let pickerCategory = "All";
    let ownPendingRequests = [];
    let publicProfileUserId = "";
    let publicProfileReturnView = "matchesView";
    let deleteConfirmResolver = null;

    function log(message) {
      console.debug(`[SkillSwap] ${message}`);
    }

    function loadSession() {
      currentUser = localStorage.getItem(dbKeySession) || null;
      currentUserRecord = null;
    }

    function setSession(email) {
      localStorage.setItem(dbKeySession, email);
      currentUser = email;
    }

    function clearSession() {
      localStorage.removeItem(dbKeySession);
      currentUser = null;
      currentUserRecord = null;
      selectedConversationId = "";
      ownPendingRequests = [];
      disconnectConversationSocket({ socketState, setChatStatus });
      setPublishStatus("Sesion cerrada.", "info");
      authScreen.classList.remove("hidden");
      onboardingModal.classList.add("hidden");
      skillPickerOverlay.classList.add("hidden");
      dashboard.classList.add("hidden");
      activateView("matchesView");
    }

    function cfg() {
      return { apiBase: API_BASE };
    }

    function profileKey(user) { return `${dbKeyProfilePrefix}${user}`; }

    function getCurrentUserRecord() {
      return currentUserRecord;
    }

    function getProfile(user = currentUser) {
      if (!user) return null;
      try {
        return JSON.parse(localStorage.getItem(profileKey(user)) || "null");
      } catch {
        return null;
      }
    }

    function saveProfile(profile) {
      if (!currentUser) return;
      localStorage.setItem(profileKey(currentUser), JSON.stringify(profile));
    }

    function normalizeProfileFromUser(user) {
      return normalizeProfileFromUserDomain(user);
    }

    async function loadCurrentUserFromApi() {
      await loadCurrentUserFromApiDomain({
        currentUser,
        api,
        saveProfile,
        setCurrentUserRecord: (user) => {
          currentUserRecord = user;
        },
      });
    }

    async function persistProfileToApi(profile) {
      await persistProfileToApiDomain({
        currentUser,
        api,
        profile,
        saveProfile,
        setCurrentUserRecord: (user) => {
          currentUserRecord = user;
        },
      });
    }

    function setPublishStatus(message, type = "info") {
      setStatus(publishStatus, message, type);
    }

    function setChatStatus(message, type = "info") {
      setStatus(chatStatus, message, type);
    }

    function getPickerSelection(mode = pickerMode, source = pickerSource) {
      return getPickerSelectionDomain({
        mode,
        source,
        profileTeachDraft,
        profileLearnDraft,
        profileLanguagesDraft,
        onboardingTeach,
        onboardingLearn,
        onboardingLanguages,
      });
    }

    async function openPublicProfile(userId, returnView = "matchesView") {
      await openPublicProfileDomain({
        userId,
        returnView,
        currentUser,
        api,
        getProfile,
        getCurrentUserRecord,
        setPublicProfileUserId: (value) => {
          publicProfileUserId = value;
        },
        setPublicProfileReturnView: (value) => {
          publicProfileReturnView = value;
        },
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
      });
    }

    function closePublicProfile() {
      closePublicProfileDomain({
        publicProfileReturnView,
        activateView,
        setPublicProfileUserId: (value) => {
          publicProfileUserId = value;
        },
      });
    }

    function updateProfileTriggerTexts() {
      updateProfileTriggerTextsDomain({
        $,
        profileTeachDraft,
        profileLearnDraft,
        profileLanguagesDraft,
      });
    }

    async function api(path, options = {}) {
      const { apiBase } = cfg();
      return apiRequest(apiBase, path, options);
    }

    function setAuthMode(mode) {
      setAuthModeDomain({ $, mode });
    }

    function renderSelectedSummary(type, source = "onboarding") {
      renderSelectedSummaryDomain({
        type,
        source,
        renderSummaryChips,
        getPickerSelection,
        profileTeachChips,
        profileLearnChips,
        profileLanguageChips,
        teachSummary,
        learnSummary,
        languageSummary,
        updateProfileTriggerTexts,
      });
    }

    function renderPickerCategories() {
      renderPickerCategoriesDomain({
        pickerMode,
        pickerCategory,
        pickerCategoryChips,
        skillsCatalog,
        setPickerCategory: (value) => {
          pickerCategory = value;
        },
        renderPickerCategories,
        renderPickerSkills,
      });
    }

    function renderPickerSkills() {
      renderPickerSkillsDomain({
        pickerMode,
        pickerCategory,
        pickerSource,
        pickerSearchInput,
        pickerSkillsList,
        skillsCatalog,
        languagesCatalog,
        getPickerSelection: () => getPickerSelection(),
        renderSelectedSummary,
      });
    }

    function openSkillPicker(mode, source = "onboarding") {
      openSkillPickerDomain({
        mode,
        source,
        pickerSearchInput,
        pickerTitle,
        skillPickerOverlay,
        setPickerMode: (value) => {
          pickerMode = value;
        },
        setPickerSource: (value) => {
          pickerSource = value;
        },
        setPickerCategory: (value) => {
          pickerCategory = value;
        },
        renderPickerCategories,
        renderPickerSkills,
      });
    }

    function closeSkillPicker() {
      closeSkillPickerDomain({ skillPickerOverlay });
    }

    function renderDashboardCategories() {
      dashboardCategoryChips.innerHTML = "";
      Object.keys(skillsCatalog).forEach((category) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `chip${selectedCategory === category ? " active" : ""}`;
        chip.textContent = category;
        chip.onclick = () => {
          selectedCategory = category;
          renderDashboardCategories();
          renderMarketplace(currentMarketplace);
        };
        dashboardCategoryChips.appendChild(chip);
      });
    }

    function renderTopBar() {
      const profile = getProfile() || {};
      const userRecord = getCurrentUserRecord() || {};
      const visibleName = profile.fullName || userRecord.name || currentUser;
      $("topAvatar").textContent = getInitials(visibleName);
      $("topUsername").textContent = visibleName;
      $("topMeta").textContent = (profile.languages || []).join(" · ") || currentUser;
    }

    function requestMatchesMyLearning(request) {
      const profile = getProfile() || {};
      const learnSkills = (profile.learnSkills || []).map((skill) => String(skill).toLowerCase().trim()).filter(Boolean);
      if (!learnSkills.length) {
        return true;
      }

      const offeredText = String(request.offered_skill || "").toLowerCase();
      return learnSkills.some((skill) => offeredText.includes(skill));
    }

    function activateView(viewId) {
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
      document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.view === viewId));
      const showSearch = viewId === "matchesView";
      searchShell.classList.toggle("hidden", !showSearch);
      topShell.classList.toggle("user-only", !showSearch);
    }

    async function ensureOnboardingOrDashboard() {
      try {
        await loadCurrentUserFromApi();
      } catch (error) {
        log(`No se pudo cargar el usuario desde backend: ${error.message}`);
      }

      const profile = getProfile();
      if (!profile || !profile.teachSkills?.length || !profile.learnSkills?.length) {
        authScreen.classList.add("hidden");
        dashboard.classList.add("hidden");
        const record = getCurrentUserRecord();
        $("fullName").value = record?.name || "";
        onboardingLanguages = new Set(getProfile()?.languages || []);
        renderSelectedSummary("language");
        onboardingModal.classList.remove("hidden");
        return;
      }
      onboardingModal.classList.add("hidden");
      authScreen.classList.add("hidden");
      dashboard.classList.remove("hidden");
      hydrateProfileUI();
      await refreshAll();
    }

    function hydrateProfileUI() {
      hydrateProfileUIDomain({
        $,
        currentUser,
        getProfile,
        getInitials,
        renderSelectedSummary,
        renderTopBar,
        profileAvatarLarge,
        teachPreview,
        learnPreview,
        setProfileTeachDraft: (value) => {
          profileTeachDraft = value;
        },
        setProfileLearnDraft: (value) => {
          profileLearnDraft = value;
        },
        setProfileLanguagesDraft: (value) => {
          profileLanguagesDraft = value;
        },
      });
    }

    async function signup() {
      await signupDomain({
        $,
        api,
        setSession,
        renderSelectedSummary,
        ensureOnboardingOrDashboard,
        log,
        setCurrentUserRecord: (user) => {
          currentUserRecord = user;
        },
        setOnboardingTeach: (value) => {
          onboardingTeach = value;
        },
        setOnboardingLearn: (value) => {
          onboardingLearn = value;
        },
      });
    }

    async function login() {
      await loginDomain({
        $,
        api,
        setSession,
        ensureOnboardingOrDashboard,
        log,
        setCurrentUserRecord: (user) => {
          currentUserRecord = user;
        },
      });
    }

    async function completeOnboarding() {
      await completeOnboardingDomain({
        $,
        onboardingTeach,
        onboardingLearn,
        onboardingLanguages,
        saveProfile,
        persistProfileToApi,
        hydrateProfileUI,
        ensureOnboardingOrDashboard,
        publishRequest,
      });
    }

    function buildMarketplacePayload(fromProfile = false) {
      const profile = getProfile() || {};
      const offered = fromProfile ? (profile.teachSkills || []).join(", ") : $("publishOfferedSkill").value.trim();
      const requested = fromProfile ? (profile.learnSkills || []).join(", ") : $("publishRequestedSkill").value.trim();
      const intro = fromProfile ? (profile.marketplaceMessage || "") : $("publishIntroMessage").value.trim();
      return {
        from_user_id: currentUser,
        to_user_id: null,
        offered_skill: offered,
        requested_skill: requested,
        intro_message: intro
      };
    }

    async function publishRequest(fromOnboarding = false) {
      if (!currentUser) return;
      try {
        const payload = buildMarketplacePayload(fromOnboarding);
        if (!payload.offered_skill || !payload.requested_skill) {
          alert("Debes indicar las habilidades que ofreces y quieres aprender.");
          return;
        }
        const result = await api("/message-requests", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        ownPendingRequests = [result.request, ...ownPendingRequests.filter((item) => item.id !== result.request.id)];
        setPublishStatus("Solicitud publicada correctamente.", "ok");
        log(`Solicitud publicada: ${result.request.id}`);
        renderLatestRequest();
        await loadMarketplace();
      } catch (error) {
        setPublishStatus(`No se pudo publicar: ${error.message}`, "error");
        log(`Error publicando solicitud: ${error.message}`);
      }
    }

    async function loadLatestOwnRequest() {
      if (!currentUser) {
        ownPendingRequests = [];
        return;
      }
      try {
        const result = await api(`/message-requests/${encodeURIComponent(currentUser)}/outgoing`);
        ownPendingRequests = result.requests.filter((item) => item.status === "pending" && item.to_user_id === "__PUBLIC__");
      } catch {
        ownPendingRequests = [];
      }
    }

    async function deleteLatestRequest(requestId = null) {
      const targetRequestId = requestId || ownPendingRequests[0]?.id;
      if (!targetRequestId) {
        setPublishStatus("No tienes una publicacion publica pendiente para borrar.", "info");
        return;
      }
      try {
        await api(`/message-requests/${encodeURIComponent(targetRequestId)}?user_id=${encodeURIComponent(currentUser)}`, {
          method: "DELETE"
        });
        setPublishStatus("Publicacion eliminada.", "ok");
        ownPendingRequests = ownPendingRequests.filter((item) => item.id !== targetRequestId);
        renderLatestRequest();
        await loadMarketplace();
      } catch (error) {
        setPublishStatus(`No se pudo borrar la publicacion: ${error.message}`, "error");
      }
    }

    function confirmDeleteRequest(request) {
      const offered = String(request?.offered_skill || "").trim() || "(sin habilidad)";
      const requested = String(request?.requested_skill || "").trim() || "(sin habilidad)";

      if (deleteConfirmResolver) {
        deleteConfirmResolver(false);
      }

      $("deleteConfirmOffered").textContent = offered;
      $("deleteConfirmRequested").textContent = requested;
      deleteConfirmModal.classList.remove("hidden");

      setTimeout(() => {
        $("deleteConfirmAcceptBtn").focus();
      }, 0);

      return new Promise((resolve) => {
        deleteConfirmResolver = resolve;
      });
    }

    function closeDeleteConfirmModal(confirmed) {
      deleteConfirmModal.classList.add("hidden");
      const resolver = deleteConfirmResolver;
      deleteConfirmResolver = null;
      if (resolver) {
        resolver(Boolean(confirmed));
      }
    }

    function renderLatestRequest() {
      const box = $("latestRequestBox");
      box.innerHTML = "";
      if (!ownPendingRequests.length) {
        const empty = document.createElement("div");
        empty.className = "list-item";
        empty.textContent = "Aun no tienes una publicacion publica pendiente.";
        box.appendChild(empty);
        return;
      }

      ownPendingRequests.forEach((request) => {
        const card = document.createElement("div");
        card.className = "list-item";
        card.innerHTML = `
          <strong>${request.offered_skill}</strong>
          <div class="muted">Quiere aprender: ${request.requested_skill}</div>
          <div class="muted">Estado: ${request.status}</div>
        `;

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "mini-btn";
        deleteBtn.textContent = "Borrar esta publicacion";
        deleteBtn.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (!(await confirmDeleteRequest(request))) {
            return;
          }
          await deleteLatestRequest(request.id);
        });

        actions.appendChild(deleteBtn);
        card.appendChild(actions);
        box.appendChild(card);
      });
    }

    function renderMarketplace(requests) {
      renderMarketplaceSection({
        requests,
        selectedCategory,
        searchQuery: $("searchInput").value.trim(),
        marketplaceGrid,
        marketplaceTotalEl: $("marketplaceTotal"),
        matchesCountBadgeEl: $("matchesCountBadge"),
        requestMatchesMyLearning,
        onAcceptRequest: acceptRequest,
        onOpenMatchedConversation: openMatchedConversation,
        onShowRequestDetails: showRequestDetails,
      });
    }

    function renderIncomingMatches(items) {
      renderIncomingMatchesSection({
        items,
        incomingMatchesGrid,
        incomingMatchesCountBadgeEl: $("incomingMatchesCountBadge"),
        onAcceptRequest: acceptRequest,
        onShowRequestDetails: showRequestDetails,
      });
    }

    function renderMyMatches(items) {
      renderMyMatchesSection({
        items,
        myMatchesGrid,
        myMatchesCountBadgeEl: $("myMatchesCountBadge"),
        onOpenMatchedConversation: openMatchedConversation,
        onShowRequestDetails: showRequestDetails,
        onFinalizeMatch: finalizeMatch,
        onRateMatch: rateMatch,
      });
    }

    async function openMatchedConversation(conversationId) {
      if (!conversationId) {
        setChatStatus("Ese match aun no tiene chat disponible.", "info");
        return;
      }

      selectedConversationId = conversationId;
      $("conversationId").value = conversationId;
      activateView("chatView");
      await loadConversations();
      connectWs(true);
    }

    function showRequestDetails(request, returnView = "matchesView") {
      openPublicProfile(request.from_user_id, returnView);
    }

    async function loadMarketplace() {
      if (!currentUser) return;
      try {
        const params = new URLSearchParams({ viewer_user_id: currentUser });
        const query = $("searchInput").value.trim();
        if (query) params.append("q", query);
        const result = await api(`/marketplace/requests?${params.toString()}`);
        currentMarketplace = result.requests;
        renderMarketplace(currentMarketplace);
      } catch (error) {
        log(`Error cargando marketplace: ${error.message}`);
      }
    }

    async function loadIncomingMatches() {
      if (!currentUser) return;
      try {
        const result = await api(`/matches/${encodeURIComponent(currentUser)}/incoming`);
        currentIncomingMatches = result.incoming || [];
        renderIncomingMatches(currentIncomingMatches);
      } catch (error) {
        currentIncomingMatches = [];
        renderIncomingMatches(currentIncomingMatches);
        log(`Error cargando matches recibidos: ${error.message}`);
      }
    }

    async function loadMyMatches() {
      if (!currentUser) return;
      try {
        const result = await api(`/matches/${encodeURIComponent(currentUser)}`);
        currentMyMatches = result.matches || [];
        renderMyMatches(currentMyMatches);
      } catch (error) {
        currentMyMatches = [];
        renderMyMatches(currentMyMatches);
        log(`Error cargando mis matches: ${error.message}`);
      }
    }

    async function finalizeMatch(matchId) {
      try {
        await api(`/matches/${encodeURIComponent(matchId)}/finalize`, {
          method: "POST",
          body: JSON.stringify({ user_id: currentUser })
        });
        await loadMyMatches();
      } catch (error) {
        alert(`No se pudo finalizar el match: ${error.message}`);
      }
    }

    async function rateMatch(matchId, rating) {
      try {
        await api(`/matches/${encodeURIComponent(matchId)}/rate`, {
          method: "POST",
          body: JSON.stringify({ user_id: currentUser, rating })
        });
        await loadMyMatches();
      } catch (error) {
        alert(`No se pudo guardar la calificacion: ${error.message}`);
      }
    }

    async function acceptRequest(requestId, responderToUserId = null) {
      try {
        const result = await api(`/marketplace/requests/${requestId}/accept`, {
          method: "POST",
          body: JSON.stringify({
            accepter_user_id: currentUser,
            ...(responderToUserId ? { responder_to_user_id: responderToUserId } : {})
          })
        });
        await loadMarketplace();
        await loadIncomingMatches();
        await loadMyMatches();
        if (result.matched && result.conversation_id) {
          selectedConversationId = result.conversation_id;
          $("conversationId").value = selectedConversationId;
          activateView("chatView");
          await loadConversations();
          connectWs(true);
          setChatStatus("Hubo match mutuo. Chat habilitado.", "ok");
          log(`Match mutuo. Conversacion: ${selectedConversationId}`);
          return;
        }

        setChatStatus("Interes enviado. El chat se abrira solo si la otra persona tambien hace match.", "info");
        log(`Interes enviado para la solicitud ${requestId}`);
      } catch (error) {
        setChatStatus(`No se pudo procesar el match: ${error.message}`, "error");
        log(`Error procesando match: ${error.message}`);
      }
    }

    function renderConversations() {
      renderConversationsSection({
        conversationsList,
        conversationTotalEl: $("conversationTotal"),
        chatCountBadgeEl: $("chatCountBadge"),
        currentConversations,
        selectedConversationId,
        onSelectConversation: (conversationId) => {
          selectedConversationId = conversationId;
          $("conversationId").value = conversationId;
          renderConversations();
          connectWs(true);
        },
      });
    }

    async function deleteSelectedConversation() {
      const conversationId = $("conversationId").value.trim();
      if (!conversationId) {
        setChatStatus("Selecciona una conversacion antes de borrarla.", "info");
        return;
      }

      try {
        await api(`/conversations/${encodeURIComponent(conversationId)}?user_id=${encodeURIComponent(currentUser)}`, {
          method: "DELETE"
        });

        disconnectConversationSocket({ socketState, setChatStatus });

        if (selectedConversationId === conversationId) {
          selectedConversationId = "";
        }
        $("conversationId").value = "";
        chatBox.innerHTML = "";
        setChatStatus("Chat borrado para ti. El otro usuario lo mantiene.", "ok");
        await loadConversations();
      } catch (error) {
        setChatStatus(`No se pudo borrar el chat: ${error.message}`, "error");
      }
    }

    async function loadConversations() {
      if (!currentUser) return;
      try {
        const result = await api(`/conversations/${encodeURIComponent(currentUser)}`);
        currentConversations = result.conversations;
        if (selectedConversationId) {
          const exists = currentConversations.some((conversation) => conversation.id === selectedConversationId);
          if (!exists) {
            selectedConversationId = "";
            $("conversationId").value = "";
            disconnectConversationSocket({ socketState, setChatStatus });
          }
        }
        renderConversations();

        if (selectedConversationId) {
          connectWs(true);
        }
      } catch (error) {
        log(`Error cargando conversaciones: ${error.message}`);
      }
    }

    function connectWs(autoConnect = false) {
      const conversationId = $("conversationId").value.trim();
      connectConversationSocket({
        autoConnect,
        conversationId,
        currentUser,
        socketState,
        setChatStatus,
        log,
        chatBox,
        buildWsUrl: (cid, uid) => wsUrl(cfg().apiBase, cid, uid),
      });
    }

    function disconnectWs() {
      disconnectConversationSocket({ socketState, setChatStatus });
    }

    function sendWsMessage() {
      const content = $("chatInput").value.trim();
      const sentOrNoop = sendConversationMessage({ socketState, content });
      if (!sentOrNoop) {
        alert("Conecta el chat primero.");
        return;
      }
      if (!content) return;
      $("chatInput").value = "";
    }

    async function saveProfileFromDashboard() {
      await saveProfileFromDashboardDomain({
        $,
        getProfile,
        profileTeachDraft,
        profileLearnDraft,
        profileLanguagesDraft,
        saveProfile,
        persistProfileToApi,
        hydrateProfileUI,
        log,
      });
    }

    async function refreshAll() {
      renderTopBar();
      hydrateProfileUI();
      renderDashboardCategories();
      await loadLatestOwnRequest();
      renderLatestRequest();
      await loadMarketplace();
      await loadIncomingMatches();
      await loadMyMatches();
      await loadConversations();
      const profile = getProfile() || {};
      $("mySkillsPreview").textContent = String((profile.teachSkills || []).length + (profile.learnSkills || []).length);
    }

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => activateView(btn.dataset.view));
    });

    $("showLoginTab").onclick = () => setAuthMode("login");
    $("showSignupTab").onclick = () => setAuthMode("signup");
    $("signupBtn").onclick = () => { signup(); };
    $("loginBtn").onclick = () => { login(); };
    $("openTeachPickerBtn").onclick = () => openSkillPicker("teach", "onboarding");
    $("openLearnPickerBtn").onclick = () => openSkillPicker("learn", "onboarding");
    $("openLanguagePickerBtn").onclick = () => openSkillPicker("language", "onboarding");
    $("openProfileTeachPickerBtn").onclick = () => openSkillPicker("teach", "profile");
    $("openProfileLearnPickerBtn").onclick = () => openSkillPicker("learn", "profile");
    $("openProfileLanguagePickerBtn").onclick = () => openSkillPicker("language", "profile");
    $("savePickerBtn").onclick = closeSkillPicker;
    $("clearPickerBtn").onclick = () => {
      getPickerSelection().clear();
      renderPickerSkills();
      renderSelectedSummary(pickerMode, pickerSource);
    };
    $("cancelPickerBtn").onclick = closeSkillPicker;
    $("deleteConfirmCancelBtn").onclick = () => closeDeleteConfirmModal(false);
    $("deleteConfirmAcceptBtn").onclick = () => closeDeleteConfirmModal(true);
    deleteConfirmModal.addEventListener("click", (event) => {
      if (event.target === deleteConfirmModal) {
        closeDeleteConfirmModal(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !deleteConfirmModal.classList.contains("hidden")) {
        closeDeleteConfirmModal(false);
      }
    });
    pickerSearchInput.addEventListener("input", renderPickerSkills);
    $("completeOnboardingBtn").onclick = completeOnboarding;
    $("searchBtn").onclick = loadMarketplace;
    $("publishRequestBtn").onclick = () => publishRequest(false);
    $("deleteRequestBtn").onclick = async () => {
      await loadLatestOwnRequest();
      renderLatestRequest();
      setPublishStatus("Lista de publicaciones actualizada.", "info");
    };
    $("loadConversationsBtn").onclick = loadConversations;
    $("disconnectWsBtn").onclick = disconnectWs;
    $("deleteConversationBtn").onclick = deleteSelectedConversation;
    $("sendWsMessageBtn").onclick = sendWsMessage;
    $("saveProfileBtn").onclick = () => { saveProfileFromDashboard(); };
    $("viewPublicProfileBtn").onclick = () => {
      openPublicProfile(currentUser, "profileView");
    };
    $("changeAvatarBtn").onclick = () => {
      alert("Por ahora el avatar se genera automaticamente con tu inicial.");
    };
    $("closePublicProfileBtn").onclick = closePublicProfile;
    $("logoutBtn").onclick = clearSession;
    async function initializeApp() {
      loadSession();
      renderSelectedSummary("teach");
      renderSelectedSummary("learn");
      renderSelectedSummary("language");
      renderDashboardCategories();

      if (currentUser) {
        await ensureOnboardingOrDashboard();
      } else {
        authScreen.classList.remove("hidden");
        onboardingModal.classList.add("hidden");
        skillPickerOverlay.classList.add("hidden");
        dashboard.classList.add("hidden");
      }
    }

    initializeApp();

