// Content script — injected into When2Meet pages
// Handles: parsing the time grid, computing availability, preview overlay, and confirming

console.log("CONTENT SCRIPT LOADED");

(() => {
    // ── State ─────────────────────────────────────────────────────────────
    let previewActive = false;
    let previewSlotIds = [];
    let bannerEl = null;
    let alreadySelectedTimestamps = new Set();

    // ── Utility: send message to background service worker ────────────────
    function sendMessage(msg) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(msg, (response) => resolve(response));
        });
    }

    // ── Parse When2Meet grid ──────────────────────────────────────────────
    // An injected <script> tag is used to read these variables from the page's
    // JS context (content scripts run in an isolated world).

    function getPageData() {
        return new Promise((resolve) => {
            let timeoutId; // Declare before handler to avoid TDZ error

            // 1. Set up listener for response
            const handler = (e) => {
                if (e.data && e.data.type === "__w2m_gcal_data") {
                    clearTimeout(timeoutId);
                    window.removeEventListener("message", handler);
                    resolve(e.data.data);
                }
            };
            window.addEventListener("message", handler);

            // 2. Dispatch request event (caught by injected.js in MAIN world)

            window.postMessage({ type: "__w2m_request_data" }, "*");

            // 3. Fallback timeout
            timeoutId = setTimeout(() => {
                console.error("When2Meet Autofill: Timeout waiting for response");
                window.removeEventListener("message", handler);
                resolve({
                    slots: [],
                    error: "Timeout reading page data. Try refreshing the page.",
                });
            }, 3000);
        });
    }

    // ── Find slot DOM elements ────────────────────────────────────────────

    function getSlotElement(slotIndex) {
        // When2Meet uses YouTime{index} for the user's availability grid
        return (
            document.getElementById("YouTime" + slotIndex) ||
            document.querySelector(`[data-time="${slotIndex}"]`)
        );
    }

    // ── Detect already-selected slots ────────────────────────────────────

    function isSlotAlreadySelected(element) {
        if (!element) return false;
        const bg = window.getComputedStyle(element).backgroundColor;
        if (!bg || bg === "transparent" || bg === "rgba(0, 0, 0, 0)") return false;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return false;
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        // When2Meet colors available slots green (high green, lower red/blue)
        return g > r && g > b;
    }

    function detectAlreadySelectedSlots(slots) {
        const selected = new Set();
        for (const slot of slots) {
            const el = getSlotElement(slot.timestamp);
            if (isSlotAlreadySelected(el)) {
                selected.add(slot.timestamp);
            }
        }
        return selected;
    }

    // ── Compute free slots ────────────────────────────────────────────────

    function computeFreeSlots(slots, busyEvents) {
        // When2Meet slots are 15-minute intervals.
        // A slot is "free" if NO busy event overlaps it.

        const freeSlotIndices = [];

        for (const slot of slots) {
            const slotStartSec = slot.timestamp;
            const slotEndSec = slotStartSec + 15 * 60; // 15-minute slot

            const slotStartMs = slotStartSec * 1000;
            const slotEndMs = slotEndSec * 1000;

            let isBusy = false;
            for (const evt of busyEvents) {
                const evtStart = new Date(evt.start).getTime();
                const evtEnd = new Date(evt.end).getTime();

                // Overlap: event starts before slot ends AND event ends after slot starts
                if (evtStart < slotEndMs && evtEnd > slotStartMs) {
                    isBusy = true;
                    break;
                }
            }

            if (!isBusy) {
                freeSlotIndices.push(slot.timestamp); // Use timestamp, not index
            }
        }

        return freeSlotIndices;
    }

    // ── Preview Overlay ───────────────────────────────────────────────────

    function showPreview(freeSlotIndices) {
        previewActive = true;
        previewSlotIds = freeSlotIndices;

        // Highlight the free slots
        for (const idx of freeSlotIndices) {
            const el = getSlotElement(idx);
            if (el) {
                el.classList.add("w2m-gcal-preview-available");
            }
        }

        // Show toast notification
        showToast(`Auto-selecting ${freeSlotIndices.length} free slots...`);

        // Automatically select the slots after a brief delay
        // Increased delay to ensure page is ready
        setTimeout(() => {
            autoSelectSlots();
        }, 1000);
    }

    function clearPreview() {
        // Remove highlights
        document.querySelectorAll(".w2m-gcal-preview-available").forEach((el) => {
            el.classList.remove("w2m-gcal-preview-available");
        });

        // Remove banner
        if (bannerEl) {
            bannerEl.remove();
            bannerEl = null;
        }

        previewActive = false;
        previewSlotIds = [];
        alreadySelectedTimestamps = new Set();
    }

    // ── Banner with Auto-Select Button ───────────────────────────────────



    // ── Auto-Select Slots via Mouse Simulation ───────────────────────────

    function autoSelectSlots() {

        // Get slot elements, skipping any the user already selected to avoid toggling them off
        const slotElements = [];
        for (const timestamp of previewSlotIds) {
            if (alreadySelectedTimestamps.has(timestamp)) continue;
            const el = getSlotElement(timestamp);
            if (el) {
                slotElements.push(el);
            }
        }

        if (slotElements.length === 0 && alreadySelectedTimestamps.size === 0) {
            showToast("No slot elements found to select");
            return;
        }

        // Simulate mouse clicks only on newly-selected slots
        for (const el of slotElements) {
            simulateClick(el);
        }

        // Approach 2: Also trigger server save directly
        // Longer delay to ensure UI simulation completes and When2Meet processes the changes
        setTimeout(() => {
            confirmAutofill();
        }, 1500); // Increased from 500ms to 1500ms
    }

    function simulateClick(element) {
        // Create and dispatch mouse events to simulate a click
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const mouseDownEvent = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
        });

        const mouseUpEvent = new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
        });

        const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
        });

        element.dispatchEvent(mouseDownEvent);
        element.dispatchEvent(mouseUpEvent);
        element.dispatchEvent(clickEvent);
    }

    // ── Confirm: Directly modify When2Meet's state ───────────────────────

    function confirmAutofill() {
        const timestamps = [...previewSlotIds];
        const preserved = [...alreadySelectedTimestamps];
        clearPreview();

        window.postMessage({
            type: "__w2m_mark_available",
            timestamps: timestamps,
            alreadySelectedTimestamps: preserved
        }, "*");

        const newCount = timestamps.length - preserved.filter(t => timestamps.includes(t)).length;
        if (preserved.length > 0) {
            showToast(`Marked ${newCount} new slots as available (${preserved.length} existing preserved)!`);
        } else {
            showToast(`Marked ${timestamps.length} slots as available!`);
        }
    }

    function cancelPreview() {
        clearPreview();
        showToast("Autofill cancelled.");
    }

    // ── Toast ─────────────────────────────────────────────────────────────

    function showToast(message) {
        const toast = document.createElement("div");
        toast.className = "w2m-gcal-toast";
        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add("w2m-gcal-toast-visible"));

        setTimeout(() => {
            toast.classList.remove("w2m-gcal-toast-visible");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── Message Listener (from popup) ─────────────────────────────────────

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message.type !== "AUTOFILL") return;

        if (previewActive) {
            clearPreview();
        }

        (async () => {
            try {
                // 1. Parse the When2Meet grid
                const pageData = await getPageData();
                if (pageData.error) {
                    sendResponse({ success: false, error: pageData.error });
                    return;
                }

                if (!pageData.slots || pageData.slots.length === 0) {
                    sendResponse({
                        success: false,
                        error:
                            "Could not read When2Meet time slots. Please make sure you have entered your name to see the grid.",
                    });
                    return;
                }

                // 2. Determine time range from the grid
                const timestamps = pageData.slots.map((s) => s.timestamp);
                const minTime = Math.min(...timestamps);
                const maxTime = Math.max(...timestamps) + 15 * 60; // add 15 min for last slot

                const timeMin = new Date(minTime * 1000).toISOString();
                const timeMax = new Date(maxTime * 1000).toISOString();

                // 3. Fetch busy events from Google Calendar
                const busyResp = await sendMessage({
                    type: "GET_BUSY_SLOTS",
                    calendarIds: message.calendarIds,
                    timeMin,
                    timeMax,
                });

                if (!busyResp.success) {
                    sendResponse({
                        success: false,
                        error: "Failed to fetch calendar events: " + busyResp.error,
                    });
                    return;
                }

                // 4. Compute which slots are free
                const freeSlots = computeFreeSlots(pageData.slots, busyResp.busySlots);

                if (freeSlots.length === 0) {
                    sendResponse({
                        success: false,
                        error: "No free slots found — your calendar is fully booked for this time range!",
                    });
                    return;
                }

                // 5. Detect slots the user already selected before autofilling
                alreadySelectedTimestamps = detectAlreadySelectedSlots(pageData.slots);
                if (alreadySelectedTimestamps.size > 0) {
                    console.log("When2Meet Autofill: Preserving", alreadySelectedTimestamps.size, "already-selected slots");
                }

                // 6. Show preview
                showPreview(freeSlots);
                sendResponse({ success: true, slotCount: freeSlots.length });
            } catch (err) {
                sendResponse({
                    success: false,
                    error: "Unexpected error: " + err.message,
                });
            }
        })();

        return true; // async response
    });
})();
