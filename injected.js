// Injected script — runs in the MAIN world to access page variables
console.log("INJECTED SCRIPT LOADED IN MAIN WORLD - TEST");

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
            console.error("Required variables not found");
            return;
        }

        // Build a map from timestamp to index
        var timestampToIndex = {};
        for (var i = 0; i < TimeOfSlot.length; i++) {
            timestampToIndex[TimeOfSlot[i]] = i;
        }

        // Mark slots in AvailableAtSlot array - SAFELY
        for (var i = 0; i < e.data.timestamps.length; i++) {
            var timestamp = e.data.timestamps[i];
            var index = timestampToIndex[timestamp];

            if (index !== undefined) {
                // AvailableAtSlot is an array of arrays (list of personIDs at each slot)
                // It should not be overwritten with "1".
                // However, for POST request generation later, it needs to be known as available.
                // The page logic might expect arrays.

                // If simulating "I am available", the user ID should be ensured to be present.
                // But the save logic usually iterates AvailableAtSlot to build the availability string.

                // Just track which indices are set for the POST request,
                // and avoid modifying the global AvailableAtSlot destructively to avoid breaking page scripts.
                // OR update it correctly if instant UI feedback is desired.

                // Safe update:
                if (Array.isArray(AvailableAtSlot[index])) {
                    // Prevent destructive modification of global data
                }
            }
        }

        if (typeof GroupID !== "undefined" && GroupID) {
            eventId = GroupID;
        } else if (typeof EventID !== "undefined" && EventID) {
            eventId = EventID;
        } else if (queryMatch) {
            // When2Meet uses query string like ?35081112-5cGlg
            eventId = queryMatch;
        } else if (urlMatch && urlMatch[1]) {
            eventId = urlMatch[1];
        }

        if (!personId || !eventId) {
            console.error("Missing required IDs - cannot save");
            return;
        }

        // Build the availability binary string
        var timestampsToMark = new Set(e.data.timestamps);
        var availabilityString = "";

        for (var i = 0; i < TimeOfSlot.length; i++) {
            if (timestampsToMark.has(TimeOfSlot[i])) {
                availabilityString += "1";
            } else {
                availabilityString += "0";
            }
        }

        // Build the slots list (all slots)
        var allSlots = TimeOfSlot.join(",");

        // Send POST request
        console.log("Sending save request to /SaveTimes.php");
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/SaveTimes.php", true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onload = function () {
            if (xhr.status === 200) {
                console.log("Successfully saved to server!");
                console.log("Response:", xhr.responseText);
            } else {
                console.error("Save failed with status:", xhr.status);
                console.error("Response:", xhr.responseText);
            }
        };

        xhr.onerror = function () {
            console.error("Network error during save");
        };

        var postData = "person=" + encodeURIComponent(personId) +
            "&event=" + encodeURIComponent(eventId) +
            "&slots=" + encodeURIComponent(allSlots) +
            "&availability=" + encodeURIComponent(availabilityString) +
            "&ChangeToAvailable=true";

        console.log("POST data length:", postData.length, "bytes");


        xhr.send(postData);
    }
});
