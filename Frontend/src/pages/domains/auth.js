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
  const email = $("signupEmail").value.trim().toLowerCase();
  const username = $("signupUsername").value.trim();
  const pass = $("signupPass").value.trim();
  if (!email || !username || pass.length < 4) {
    alert("Completa correo, nombre de usuario y una contrasena de al menos 4 caracteres.");
    return;
  }

  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password: pass }),
    });
    setCurrentUserRecord(result.user);
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
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass = $("loginPass").value.trim();

  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pass }),
    });
    setCurrentUserRecord(result.user);
    setSession(result.user.id, email);
  } catch (error) {
    alert(error.message);
    return;
  }

  await ensureOnboardingOrDashboard();
  log("Sesion iniciada.");
}
