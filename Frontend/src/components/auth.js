import { loginUser, registerUser } from "../services/auth.js";

// Updated auth component with better integration
export function renderAuthScreen() {
  const authScreen = document.getElementById('authScreen');
  if (!authScreen) return;
  
  authScreen.innerHTML = `
    <div class="auth-container">
      <h2>Bienvenido a Habilio</h2>
      <div class="auth-tabs">
        <button class="tab-btn active" data-mode="login">Ingresar</button>
        <button class="tab-btn" data-mode="register">Registrarse</button>
      </div>
      <form class="auth-form active" data-mode="login">
        <input id="loginEmail" type="email" placeholder="tu@ejemplo.com" required>
        <input id="loginPassword" type="password" placeholder="Contraseña" required>
        <button type="submit">Entrar</button>
      </form>
      <form class="auth-form" data-mode="register">
        <input id="regName" placeholder="Tu nombre" required>
        <input id="regEmail" type="email" placeholder="tu@ejemplo.com" required>
        <input id="regPassword" type="password" placeholder="Contraseña segura" required>
        <button type="submit">Registrarse</button>
      </form>
      <div class="auth-footer">
        <p>API del backend: <a href="/Backend" target="_blank">/api/docs</a></p>
      </div>
    </div>
    <style>
      .auth-container { max-width: 400px; margin: 2rem auto; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .auth-tabs { display: flex; margin-bottom: 1rem; }
      .tab-btn { flex: 1; padding: 0.75rem; border: none; background: #f0f0f0; cursor: pointer; border-radius: 8px 8px 0 0; }
      .tab-btn.active { background: white; font-weight: bold; }
      .auth-form { background: white; padding: 1.5rem; border-radius: 0 8px 8px 8px; display: none; }
      .auth-form.active { display: block; }
      .auth-form input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
      .auth-form button { width: 100%; padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
      .auth-form button:hover { background: #0056b3; }
      .auth-footer { text-align: center; margin-top: 1rem; font-size: 0.9rem; color: #666; }
    </style>
  `;

  // Event listeners
  authScreen.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      authScreen.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      authScreen.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      authScreen.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    });
  });

  authScreen.querySelector('[data-mode="login"] form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      await loginUser(email, password);
      location.reload();
    } catch (err) {
      alert('El ingreso falló: ' + err.message);
    }
  });

  authScreen.querySelector('[data-mode="register"] form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    try {
      await registerUser(name, email, password);
      alert('¡Registrado! Ahora puedes iniciar sesión.');
    } catch (err) {
      alert('Registro falló: ' + err.message);
    }
  });
}
