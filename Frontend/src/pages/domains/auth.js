import { setAuthToken } from "../../services/api.js";

export function setAuthModeDomain({ $, mode }) {
  const isLogin = mode === "login";
  $("showLoginTab").classList.toggle("active", isLogin);
  $("showSignupTab").classList.toggle("active", !isLogin);
  $("loginPane").classList.toggle("hidden", !isLogin);
  $("signupPane").classList.toggle("hidden", isLogin);
}

export async function signupDomain({
  $,
  api,
  setCurrentUserRecord,
  setSession,
  setOnboardingTeach,
  setOnboardingLearn,
  renderSelectedSummary,
  ensureOnboardingOrDashboard,
  log,
}) {
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim().toLowerCase();
  const pass = $("signupPass").value.trim();
  if (!name || !email || pass.length < 6) {
    alert("Completa nombre, correo y una contrasena de al menos 6 caracteres.");
    return;
  }

  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password: pass }),
    });
    setCurrentUserRecord(result.user);
  } catch (error) {
    alert(error.message);
    return;
  }

  setSession(email);
  setOnboardingTeach(new Set());
  setOnboardingLearn(new Set());
  renderSelectedSummary("teach");
  renderSelectedSummary("learn");
  await ensureOnboardingOrDashboard();
  log("Cuenta creada.");
}

export async function loginDomain({
  $,
  api,
  setCurrentUserRecord,
  setSession,
  ensureOnboardingOrDashboard,
  log,
}) {
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass = $("loginPass").value.trim();
  if (!email || !pass) {
    alert("Completa tu correo y contrasena.");
    return;
  }
  if (!email.includes("@") || !email.includes(".")) {
    alert("Correo invalido. Usa un formato tipo nombre@dominio.com.");
    return;
  }
  if (pass.length < 6) {
    alert("La contrasena debe tener al menos 6 caracteres.");
    return;
  }

  try {
    const result = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password: pass }).toString(),
    });
    setAuthToken(result.access_token);
    setCurrentUserRecord({ id: email });
  } catch (error) {
    alert(error.message || "No se pudo iniciar sesion.");
    return;
  }

  setSession(email);
  await ensureOnboardingOrDashboard();
  log("Sesion iniciada.");
}

