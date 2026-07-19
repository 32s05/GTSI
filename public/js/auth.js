// public/js/auth.js
document.addEventListener("DOMContentLoaded", () => {
  GT.renderNav();
  GT.renderFooter();

  // If already logged in, bounce to dashboard
  if (GT.getUser() && (document.getElementById("login-form") || document.getElementById("signup-form"))) {
    location.href = "dashboard.ejs";
    return;
  }

  function setError(fieldId, hasError) {
    document.getElementById(fieldId)?.classList.toggle("has-error", hasError);
  }

  function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.innerHTML = loading ? `<span class="spinner"></span> Please wait…` : label;
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      const emailOk = /\S+@\S+\.\S+/.test(email);
      setError("field-email", !emailOk);
      setError("field-password", !password);
      if (!emailOk || !password) return;

      const btn = document.getElementById("login-submit");
      setLoading(btn, true, "Log in");
      try {
        const { user } = await GT.api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        GT.setUser(user);
        GT.toast(`Welcome back, ${user.name.split(" ")[0]}!`, "success");
        const redirect = sessionStorage.getItem("gt_redirect_after_login") || "dashboard.ejs";
        sessionStorage.removeItem("gt_redirect_after_login");
        setTimeout(() => (location.href = redirect), 500);
      } catch (err) {
        GT.toast(err.message, "error");
        setLoading(btn, false, "Log in");
      }
    });
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const contact = document.getElementById("contact").value.trim();
      const password = document.getElementById("password").value;
      const confirm = document.getElementById("confirm").value;
      const terms = document.getElementById("terms").checked;

      const emailOk = /\S+@\S+\.\S+/.test(email);
      setError("field-name", !name);
      setError("field-email", !emailOk);
      setError("field-contact", !contact);
      setError("field-password", password.length < 6);
      setError("field-confirm", password !== confirm);

      if (!name || !emailOk || !contact || password.length < 6 || password !== confirm) return;
      if (!terms) {
        GT.toast("Please agree to the Terms of Service to continue.", "error");
        return;
      }

      const btn = document.getElementById("signup-submit");
      setLoading(btn, true, "Create account");
      try {
        const { user } = await GT.api("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({ name, email, password, contact }),
        });
        GT.setUser(user);
        GT.toast(`Account created — welcome, ${user.name.split(" ")[0]}!`, "success");
        setTimeout(() => (location.href = "dashboard.ejs"), 500);
      } catch (err) {
        GT.toast(err.message, "error");
        setLoading(btn, false, "Create account");
      }
    });
  }
});
