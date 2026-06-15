// Componente de Login
export function LoginPage() {
  return `
    <div class="login-container">
      <div class="login-card">
        <div class="logo">✝️</div>
        <h2>Bem-vindo!</h2>
        <p>Sistema de gestão para igrejas</p>

        <form id="login-form">
          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" name="email" placeholder="seu@email.com" required autocomplete="email">
          </div>

          <div class="form-group">
            <label for="password">Senha</label>
            <input type="password" id="password" name="password" placeholder="Digite sua senha" required autocomplete="current-password">
          </div>

          <div class="form-group">
            <label for="churchSlug">Igreja (slug)</label>
            <input type="text" id="churchSlug" name="churchSlug" placeholder="igreja-facil-demo" required autocomplete="off">
          </div>

          <div id="login-error" class="error-message" style="display:none;"></div>

          <button type="submit" class="login-btn">Entrar</button>
        </form>

        <div class="login-info">
          <small>Demo: pastor@igrejafacil.demo / igreja123 / igreja-facil-demo</small>
        </div>
      </div>
    </div>

    <script>
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errorEl = document.getElementById('login-error');
        const btn = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Entrando...';
        errorEl.style.display = 'none';

        try {
          const data = {
            email: form.email.value,
            password: form.password.value,
            churchSlug: form.churchSlug.value
          };

          const response = await fetch('http://localhost:3001/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Erro no login');
          }

          localStorage.setItem('token', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));

          window.dispatchEvent(new CustomEvent('auth:login', { detail: result.user }));
          window.router.navigate('/dashboard');

        } catch (error) {
          errorEl.textContent = error.message;
          errorEl.style.display = 'block';
        } finally {
          btn.disabled = false;
          btn.textContent = 'Entrar';
        }
      });
    </script>
  `;
}