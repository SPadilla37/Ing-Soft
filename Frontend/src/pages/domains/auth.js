import { setAuthToken } from "../../services/api.js";
import { validateEmail, validatePassword, validateUsername } from "../../utils/validation.js";

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
  const emailCheck = validateEmail($("signupEmail").value);
  if (!emailCheck.ok) {
    alert(emailCheck.message);
    return;
  }
  const userCheck = validateUsername($("signupUsername").value);
  if (!userCheck.ok) {
    alert(userCheck.message);
    return;
  }
  const passCheck = validatePassword($("signupPass").value);
  if (!passCheck.ok) {
    alert(passCheck.message);
    return;
  }
  const email = emailCheck.value;
  const username = userCheck.value;
  const pass = passCheck.value;

  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password: pass }),
    });
    setCurrentUserRecord(result.user);
    if (result.access_token) setAuthToken(result.access_token);
    setSession(result.user.id, email);
  } catch (error) {
    alert(error.message);
    return;
  }

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
  const emailCheck = validateEmail($("loginEmail").value);
  if (!emailCheck.ok) {
    alert(emailCheck.message);
    return;
  }
  const passCheck = validatePassword($("loginPass").value);
  if (!passCheck.ok) {
    alert(passCheck.message);
    return;
  }
  const email = emailCheck.value;
  const pass = passCheck.value;

  try {
    const result = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password: pass }).toString(),
    });

    setCurrentUserRecord(result.user);
    if (result.access_token) setAuthToken(result.access_token);
    setSession(result.user.id, email);
  } catch (error) {
    alert(error.message || "No se pudo iniciar sesion.");
    return;
  }

  await ensureOnboardingOrDashboard();
  log("Sesion iniciada.");
}

