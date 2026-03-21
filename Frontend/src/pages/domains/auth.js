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
  const apellido = $("signupApellido").value.trim();
  const username = $("signupUsername").value.trim();
  const email = $("signupEmail").value.trim().toLowerCase();
  const pass = $("signupPass").value.trim();
  if (!name || !email || pass.length < 4) {
    alert("Completa nombre, correo y una contrasena de al menos 4 caracteres.");
    return;
  }

  let result;
  try {
    result = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, name, apellido, password: pass }),
    });
    setCurrentUserRecord(result.user);
  } catch (error) {
    alert(error.message);
    return;
  }

  // Guardar el ID numérico del usuario, no el email
  setSession(result.user.id);
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

  let result;
  try {
    result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: pass }),
    });
    setCurrentUserRecord(result.user);
  } catch (error) {
    alert(error.message);
    return;
  }

  // Guardar el ID numérico del usuario, no el email
  setSession(result.user.id);
  await ensureOnboardingOrDashboard();
  log("Sesion iniciada.");
}
