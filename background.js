// Background service worker — handles Google Calendar API calls

/**
 * Get an OAuth2 access token via chrome.identity.
 * @param {boolean} interactive - Whether to show the sign-in prompt.
 * @returns {Promise<string>} The access token.
 */
function getAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(token);
            }
        });
    });
}

/**
 * Remove a cached auth token (for sign-out).
 * @param {string} token
 */
function removeCachedToken(token) {
    return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
}

/**
 * Fetch the user's calendar list.
 * @param {string} token
 * @returns {Promise<Array>} Array of { id, summary, backgroundColor, selected }
 */
async function fetchCalendars(token) {
    const resp = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || "Failed to fetch calendars");
    }
    const data = await resp.json();
    return (data.items || []).map((cal) => ({
        id: cal.id,
        summary: cal.summary || cal.id,
        backgroundColor: cal.backgroundColor || "#4285f4",
        selected: cal.selected !== false,
    }));
}

/**
 * Fetch events from a single calendar within a time range.
 * Filters out all-day events (those with event.start.date instead of event.start.dateTime).
 * @param {string} token
 * @param {string} calendarId
 * @param {string} timeMin - ISO 8601 start bound
 * @param {string} timeMax - ISO 8601 end bound
 * @returns {Promise<Array>} Array of { start, end } (ISO strings) for timed events
 */
async function fetchEvents(token, calendarId, timeMin, timeMax) {
    const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId
    )}/events?${params}`;

    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error?.message || "Failed to fetch events");
    }
    const data = await resp.json();

    // Filter to timed events only (skip all-day events which use .start.date)
    return (data.items || [])
        .filter((evt) => evt.start?.dateTime && evt.end?.dateTime)
        .filter((evt) => evt.status !== "cancelled")
        .map((evt) => ({
            start: evt.start.dateTime,
            end: evt.end.dateTime,
            summary: evt.summary || "(No title)",
        }));
}

// ── Message Listener ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_AUTH_TOKEN") {
        getAuthToken(message.interactive !== false)
            .then((token) => sendResponse({ success: true, token }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // keep channel open for async response
    }

    if (message.type === "SIGN_OUT") {
        getAuthToken(false)
            .then((token) => {
                if (token) return removeCachedToken(token);
            })
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "GET_CALENDARS") {
        getAuthToken(false)
            .then((token) => fetchCalendars(token))
            .then((calendars) => sendResponse({ success: true, calendars }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "GET_BUSY_SLOTS") {
        // message.calendarIds: string[] — calendars to check
        // message.timeMin, message.timeMax: ISO strings — time range from When2Meet grid
        const { calendarIds, timeMin, timeMax } = message;

        getAuthToken(false)
            .then(async (token) => {
                const allEvents = [];
                for (const calId of calendarIds) {
                    const events = await fetchEvents(token, calId, timeMin, timeMax);
                    allEvents.push(...events);
                }
                return allEvents;
            })
            .then((busySlots) => sendResponse({ success: true, busySlots }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }
});
