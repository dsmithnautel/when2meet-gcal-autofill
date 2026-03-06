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

        // Resolve the current user's person ID
        var personId = null;
        if (typeof YouID !== "undefined" && YouID) {
            personId = YouID;
        } else if (typeof PeopleIDs !== "undefined" && PeopleIDs && PeopleIDs.length > 0) {
            personId = PeopleIDs[PeopleIDs.length - 1];
        }

        // Resolve the event ID from page globals or the URL
        var eventId = null;
        if (typeof GroupID !== "undefined" && GroupID) {
            eventId = GroupID;
        } else if (typeof EventID !== "undefined" && EventID) {
            eventId = EventID;
        } else {
            var urlQuery = window.location.search.replace("?", "");
            if (urlQuery) {
                eventId = urlQuery;
            }
        }

        if (!personId || !eventId) {
            console.error("Missing required IDs - personId:", personId, "eventId:", eventId);
            return;
        }

        console.log("When2Meet Autofill: Using personId:", personId, "eventId:", eventId);

        // Build the availability binary string, preserving already-selected slots
        var timestampsToMark = new Set(e.data.timestamps);
        var alreadySelected = new Set(e.data.alreadySelectedTimestamps || []);
        var availabilityString = "";

        for (var i = 0; i < TimeOfSlot.length; i++) {
            if (timestampsToMark.has(TimeOfSlot[i]) || alreadySelected.has(TimeOfSlot[i])) {
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
