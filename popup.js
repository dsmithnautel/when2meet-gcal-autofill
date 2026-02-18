// Popup script — manages auth state, calendar list, and autofill trigger

const $ = (sel) => document.querySelector(sel);

// DOM refs
const viewLoading = $("#view-loading");
const viewSignedOut = $("#view-signed-out");
const viewSignedIn = $("#view-signed-in");
const statusNotW2M = $("#status-not-when2meet");
const statusError = $("#status-error");
const errorMessage = $("#error-message");
const calendarList = $("#calendar-list");
const btnSignIn = $("#btn-sign-in");
const btnSignOut = $("#btn-sign-out");
const btnAutofill = $("#btn-autofill");

// ── Helpers ───────────────────────────────────────────────────────────

function showView(view) {
    [viewLoading, viewSignedOut, viewSignedIn].forEach((v) =>
        v.classList.add("hidden")
    );
    view.classList.remove("hidden");
}

function showError(msg) {
    statusError.classList.remove("hidden");
    errorMessage.textContent = msg;
}

function hideError() {
    statusError.classList.add("hidden");
}

function sendMessage(msg) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (response) => resolve(response));
    });
}

// ── Check if current tab is a When2Meet event page ────────────────────

async function isOnWhen2Meet() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url) {
                resolve(tab.url.includes("when2meet.com"));
            } else {
                resolve(false);
            }
        });
    });
}

// ── Render calendar list ──────────────────────────────────────────────

async function renderCalendars(calendars) {
    // Load ignored calendars from storage
    const stored = await new Promise((resolve) =>
        chrome.storage.local.get("ignoredCalendars", (data) =>
            resolve(data.ignoredCalendars || [])
        )
    );

    calendarList.innerHTML = "";

    calendars.forEach((cal) => {
        const isIgnored = stored.includes(cal.id);
        const item = document.createElement("label");
        item.className = "calendar-item";
        item.innerHTML = `
      <span class="calendar-color" style="background: ${cal.backgroundColor}"></span>
      <span class="calendar-name">${escapeHtml(cal.summary)}</span>
      <input type="checkbox" data-cal-id="${escapeHtml(cal.id)}"
             ${!isIgnored ? "checked" : ""} />
    `;
        calendarList.appendChild(item);
    });

    // Save on any checkbox change
    calendarList.addEventListener("change", saveIgnoredCalendars);
}

function saveIgnoredCalendars() {
    const checkboxes = calendarList.querySelectorAll('input[type="checkbox"]');
    const ignored = [];
    checkboxes.forEach((cb) => {
        if (!cb.checked) {
            ignored.push(cb.dataset.calId);
        }
    });
    chrome.storage.local.set({ ignoredCalendars: ignored });
}

function getActiveCalendarIds() {
    const checkboxes = calendarList.querySelectorAll('input[type="checkbox"]');
    const ids = [];
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            ids.push(cb.dataset.calId);
        }
    });
    return ids;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ── Init ──────────────────────────────────────────────────────────────

async function init() {
    hideError();
    showView(viewLoading);

    // Check if on When2Meet
    const onW2M = await isOnWhen2Meet();
    if (!onW2M) {
        statusNotW2M.classList.remove("hidden");
    }

    // Try to get a token non-interactively
    const tokenResp = await sendMessage({
        type: "GET_AUTH_TOKEN",
        interactive: false,
    });

    if (!tokenResp.success) {
        // Not signed in
        showView(viewSignedOut);
        return;
    }

    // Signed in — fetch calendars
    const calResp = await sendMessage({ type: "GET_CALENDARS" });
    if (!calResp.success) {
        showView(viewSignedIn);
        showError("Failed to load calendars: " + calResp.error);
        return;
    }

    await renderCalendars(calResp.calendars);
    showView(viewSignedIn);

    // Disable autofill button if not on When2Meet
    if (!onW2M) {
        btnAutofill.disabled = true;
        btnAutofill.style.opacity = "0.5";
        btnAutofill.title = "Navigate to a When2Meet event first";
    }
}

// ── Event Handlers ────────────────────────────────────────────────────

btnSignIn.addEventListener("click", async () => {
    btnSignIn.disabled = true;
    btnSignIn.textContent = "Signing in...";
    hideError();

    const resp = await sendMessage({ type: "GET_AUTH_TOKEN", interactive: true });
    if (resp.success) {
        init(); // re-initialize to show signed-in view
    } else {
        showError("Sign-in failed: " + resp.error);
        btnSignIn.disabled = false;
        btnSignIn.innerHTML =
            '<span class="google-icon">G</span> Sign in with Google';
    }
});

btnSignOut.addEventListener("click", async () => {
    await sendMessage({ type: "SIGN_OUT" });
    showView(viewSignedOut);
});

btnAutofill.addEventListener("click", async () => {
    hideError();
    const calendarIds = getActiveCalendarIds();

    if (calendarIds.length === 0) {
        showError("Select at least one calendar.");
        return;
    }

    btnAutofill.disabled = true;
    btnAutofill.textContent = "Fetching events...";

    // Send message to content script to start autofill
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(
            tabs[0].id,
            {
                type: "AUTOFILL",
                calendarIds,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    showError(
                        "Could not communicate with When2Meet page. Try refreshing the page."
                    );
                } else if (response && !response.success) {
                    showError(response.error || "Autofill failed.");
                }
                // else: content script handles the rest

                btnAutofill.disabled = false;
                btnAutofill.innerHTML = "Autofill Availability";
            }
        );
    });
});

// Go!
init();
