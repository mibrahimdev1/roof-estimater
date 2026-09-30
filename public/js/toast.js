/* Lightweight toast system for API responses */
(function () {
    const TYPES = {
        success: "toast-success",
        error: "toast-error"
    };

    function ensureContainer() {
        let el = document.getElementById("toastContainer");
        if (el) {
            el.classList.add("toast-container");
            return el;
        }
        el = document.createElement("div");
        el.id = "toastContainer";
        el.classList.add("toast-container");
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-relevant", "additions");
        document.body.appendChild(el);
        return el;
    }

    function toText(s) {
        if (s === undefined || s === null) return "";
        return String(s);
    }

    function showToast(type, message, opts = {}) {
        const container = ensureContainer();
        const toast = document.createElement("div");
        toast.className = `toast ${TYPES[type] || TYPES.success}`;

        const title = opts.title ? `<div class="toast-title">${escapeHtml(opts.title)}</div>` : "";
        const body = `<div class="toast-body">${escapeHtml(toText(message))}</div>`;

        const iconClass = type === "error" ? "fa-solid fa-xmark" : "fa-solid fa-check";

        // Success = check, Error = cancel
        toast.innerHTML = `<i class="toast-icon ${iconClass}" aria-hidden="true"></i>${title}${body}`;

        container.appendChild(toast);

        const timeout = Number.isFinite(opts.duration) ? opts.duration : 4000;
        window.setTimeout(() => {
            toast.classList.add("toast-exit");
            toast.addEventListener(
                "transitionend",
                () => toast.remove(),
                { once: true }
            );
        }, timeout);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    window.showToast = showToast;
})();

