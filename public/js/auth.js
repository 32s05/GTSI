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

  // Password strength helper
  function checkPasswordStrength(val, email) {
    const emailPart = email.split('@')[0];
    return {
      length: val.length >= 8,
      case: /[a-z]/.test(val) && /[A-Z]/.test(val),
      special: /[0-9!@#$%^&*]/.test(val),
      email: emailPart && !val.includes(emailPart),
      common: val.length > 0 && val.toLowerCase() !== "password123"
    };
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
        
        // Smart routing: Send admins to admin.ejs, regular users to dashboard.ejs
        let redirect = sessionStorage.getItem("gt_redirect_after_login");
        if (!redirect) {
            redirect = (user.role === "admin") ? "admin.ejs" : "dashboard.ejs";
        }
        sessionStorage.removeItem("gt_redirect_after_login");
        setTimeout(() => (location.href = redirect), 500);
        
      } catch (err) {
        GT.toast(err.message, "error");
        setLoading(btn, false, "Log in");
      }
    });
  }

  // Password requirements UI feedback
  const passwordInput = document.getElementById("password");
  const emailInput = document.getElementById("email");

  if (passwordInput) {
    passwordInput.addEventListener("input", () => {
      const strength = checkPasswordStrength(passwordInput.value, emailInput.value);
      
      document.getElementById("req-length").style.color = strength.length ? "#2d8a55" : "#666";
      document.getElementById("req-case").style.color = strength.case ? "#2d8a55" : "#666";
      document.getElementById("req-special").style.color = strength.special ? "#2d8a55" : "#666";
      document.getElementById("req-email").style.color = strength.email ? "#2d8a55" : "#666";
      document.getElementById("req-common").style.color = strength.common ? "#2d8a55" : "#666";
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
      const strength = checkPasswordStrength(password, email);
      const isPasswordValid = Object.values(strength).every(Boolean);

      setError("field-name", !name);
      setError("field-email", !emailOk);
      setError("field-contact", !contact);
      setError("field-password", !isPasswordValid);
      setError("field-confirm", password !== confirm);

      if (!name || !emailOk || !contact || !isPasswordValid || password !== confirm) return;
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