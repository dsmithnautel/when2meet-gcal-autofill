// Injected script — runs in the MAIN world to access page variables
console.log("🟢 INJECTED SCRIPT LOADED IN MAIN WORLD - TEST");

// Listen for request to read page data
window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "__w2m_request_data") {
        console.log("When2Meet Autofill: Received request for page data");
        var data = { slots: [] };

        try {
            if (typeof TimeOfSlot !== "undefined" && typeof AvailableAtSlot !== "undefined") {
                for (var i = 0; i < TimeOfSlot.length; i++) {
                    data.slots.push({
                        index: i,
                        timestamp: TimeOfSlot[i],
                    });
                }
            }
        } catch (e) {
            data.error = e.message;
        }


        console.log("When2Meet Autofill: Dispatching response with", data.slots.length, "slots");
        window.postMessage({
            type: "__w2m_gcal_data",
            data: data
        }, "*");
    }
});

// Listen for request to mark slots as available
window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "__w2m_mark_available") {
        console.log("When2Meet Autofill: Starting auto-save process for", e.data.timestamps.length, "slots");

        if (typeof AvailableAtSlot === "undefined" || typeof TimeOfSlot === "undefined") {
            console.error("❌ Required variables not found");
            return;
        }

        // Build a map from timestamp to index
        var timestampToIndex = {};
        for (var i = 0; i < TimeOfSlot.length; i++) {
            timestampToIndex[TimeOfSlot[i]] = i;
        }

        // Mark slots in AvailableAtSlot array
        for (var i = 0; i < e.data.timestamps.length; i++) {
            var timestamp = e.data.timestamps[i];
            var index = timestampToIndex[timestamp];

            if (index !== undefined) {
                AvailableAtSlot[index] = "1";
            }
        }

        console.log("✅ Updated AvailableAtSlot array");

        // COMPREHENSIVE DEBUGGING FOR EVENT ID
        console.log("=== DEBUGGING EVENT ID ===");
        console.log("Full URL:", window.location.href);
        console.log("Pathname:", window.location.pathname);
        console.log("Hash:", window.location.hash);

        // Check all potential global variables
        console.log("GroupID:", typeof GroupID !== "undefined" ? GroupID : "undefined");
        console.log("EventID:", typeof EventID !== "undefined" ? EventID : "undefined");
        console.log("YouAre:", typeof YouAre !== "undefined" ? YouAre : "undefined");
        console.log("PeopleIDs:", typeof PeopleIDs !== "undefined" ? PeopleIDs : "undefined");

        // List ALL window properties that might contain the event ID
        var eventKeys = Object.keys(window).filter(function (k) {
            return k.toLowerCase().includes('event') || k.toLowerCase().includes('group');
        });
        console.log("Window keys with 'event' or 'group':", eventKeys);

        // Show values of those keys
        for (var i = 0; i < eventKeys.length; i++) {
            console.log("  " + eventKeys[i] + ":", window[eventKeys[i]]);
        }

        // Try to extract from URL
        var urlMatch = window.location.pathname.match(/\/(\d+)/);
        console.log("URL regex match:", urlMatch);

        // Find person ID
        var personId = null;
        if (typeof YouAre !== "undefined" && YouAre) {
            personId = YouAre;
        } else if (typeof PeopleIDs !== "undefined" && PeopleIDs.length > 0) {
            personId = PeopleIDs[PeopleIDs.length - 1];
        }

        // Find event ID - try ALL methods
        var eventId = null;

        if (typeof GroupID !== "undefined" && GroupID) {
            eventId = GroupID;
            console.log("Found eventId via GroupID");
        } else if (typeof EventID !== "undefined" && EventID) {
            eventId = EventID;
            console.log("Found eventId via EventID");
        } else if (urlMatch && urlMatch[1]) {
            eventId = urlMatch[1];
            console.log("Found eventId via URL regex");
        }

        console.log("=== RESULTS ===");
        console.log("personId:", personId);
        console.log("eventId:", eventId);

        if (!personId || !eventId) {
            console.error("❌ Missing required IDs - cannot save");
            console.log("💡 Please share the debug output above so we can find the event ID");
            return;
        }

        // Build the availability binary string
        var availabilityString = "";
        for (var i = 0; i < AvailableAtSlot.length; i++) {
            availabilityString += (AvailableAtSlot[i] === "1" || AvailableAtSlot[i] === 1) ? "1" : "0";
        }

        // Build the slots list (all slots)
        var allSlots = TimeOfSlot.join(",");

        // Send POST request
        console.log("📤 Sending save request to /ajax");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/ajax", true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onload = function () {
            if (xhr.status === 200) {
                console.log("✅ Successfully saved to server!");
                console.log("Response:", xhr.responseText);
            } else {
                console.error("❌ Save failed with status:", xhr.status);
                console.error("Response:", xhr.responseText);
            }
        };

        xhr.onerror = function () {
            console.error("❌ Network error during save");
        };

        var postData = "person=" + encodeURIComponent(personId) +
            "&event=" + encodeURIComponent(eventId) +
            "&slots=" + encodeURIComponent(allSlots) +
            "&availability=" + encodeURIComponent(availabilityString) +
            "&ChangeToAvailable=true";

        console.log("POST data length:", postData.length, "bytes");
        console.log("Marked slots:", availabilityString.split("1").length - 1, "out of", AvailableAtSlot.length);

        xhr.send(postData);
    }
});
