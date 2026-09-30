(function () {
    function apply() {
        var dash = document.getElementById("navDashboard");
        var signIn = document.getElementById("navSignIn");
        var logoutBtn = document.getElementById("btnLogout");
        fetch("/api/auth/me", { credentials: "include" })
            .then(function (r) {
                return r.json();
            })
            .then(function (j) {
                var user = j && j.success && j.user;
                if (dash) {
                    if (user) dash.removeAttribute("hidden");
                    else dash.setAttribute("hidden", "");
                }
                if (signIn) {
                    if (user) signIn.setAttribute("hidden", "");
                    else signIn.removeAttribute("hidden");
                }
                if (logoutBtn) {
                    if (user) logoutBtn.removeAttribute("hidden");
                    else logoutBtn.setAttribute("hidden", "");
                }
            })
            .catch(function () {
                if (dash) dash.setAttribute("hidden", "");
                if (signIn) signIn.removeAttribute("hidden");
                if (logoutBtn) logoutBtn.setAttribute("hidden", "");
            });
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    } else {
        apply();
    }
})();
