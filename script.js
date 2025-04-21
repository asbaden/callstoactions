// Ensure config.js is loaded first and contains SUPABASE_URL and SUPABASE_ANON_KEY

// Initialize Supabase client using the config object
const { createClient } = supabase;
const _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
console.log('Supabase client instance:', _supabase);

console.log('Supabase Initialized');

// --- DOM Elements ---
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authSection = document.getElementById('auth-section');
const callControls = document.getElementById('call-controls');
const journalSection = document.getElementById('journal-section');
const callStatus = document.getElementById('call-status');
const journalEntriesDiv = document.getElementById('journal-entries');

// Profile elements
const sobrietyDateInput = document.getElementById('sobriety-date');
const saveProfileButton = document.getElementById('save-profile-button');
const profileStatus = document.getElementById('profile-status');

// --- Authentication State ---
let currentUser = null;
let userProfile = null; // To store fetched profile data

// --- Create Remote Audio Element Globally ---
let remoteAudioElement = document.createElement('audio');
remoteAudioElement.autoplay = true;
console.log("Pre-created remote audio element.");
// We won't append it to the document body unless needed for debugging controls
// document.body.appendChild(remoteAudioElement);
// --- End Audio Element Creation ---

// Function to update UI based on authentication status
const updateUI = (user) => {
    currentUser = user;
    if (user) {
        // User is logged in
        loginButton.style.display = 'none';
        logoutButton.style.display = 'block';
        callControls.style.display = 'block';
        journalSection.style.display = 'block';
        console.log('UI Updated: User logged in:', user.email);
        loadJournalEntries();
        loadUserProfile(); // Load profile data including sobriety date
    } else {
        // User is logged out
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        callControls.style.display = 'none';
        journalSection.style.display = 'none';
        if (sobrietyDateInput) sobrietyDateInput.value = ''; // Clear date input
        if (profileStatus) profileStatus.textContent = ''; // Clear profile status
        if (journalEntriesDiv) journalEntriesDiv.innerHTML = ''; // Clear entries
        console.log('UI Updated: User logged out');
    }
};

// --- Initial Load and Auth Listener ---

// Listen for authentication state changes
// This listener should automatically handle the session info from the URL hash
// upon redirect and also handles subsequent login/logout events.
console.log('Setting up onAuthStateChange listener...');
const { data: { subscription } } = _supabase.auth.onAuthStateChange((event, session) => {
    console.log(`onAuthStateChange event: ${event}`, session);
    // If the event is SIGNED_IN, check if the session is valid
    if (event === 'SIGNED_IN' && session) {
        console.log('Session details from SIGNED_IN event:', session);
        // Try to manually verify by getting user again - helps diagnose token issues
        _supabase.auth.getUser().then(({ data: { user }, error }) => {
            if (error) {
                console.error('Error confirming user after SIGNED_IN event:', error);
                 // Force logout if confirmation fails
                _supabase.auth.signOut(); 
            } else if (user) {
                console.log('User confirmed after SIGNED_IN event:', user);
                updateUI(user); // Update UI with confirmed user
            } else {
                 console.log('getUser() returned no user after SIGNED_IN');
            }
        });
    } else if (event === 'SIGNED_OUT') {
        updateUI(null); // Ensure UI reflects logout
    } else if (event === 'INITIAL_SESSION') {
         updateUI(session?.user ?? null); // Handle potential existing session
    }
    // Other events like TOKEN_REFRESHED, USER_UPDATED can be handled if needed
});

// --- Event Listeners (Moved below function definitions) ---

loginButton.addEventListener('click', async () => {
    console.log('Login button clicked');
    const { data, error } = await _supabase.auth.signInWithOAuth({ 
        provider: 'google'
        // options can be added here if needed
    });
    if (error) {
        console.error('Error starting Google sign-in:', error);
        alert('Error starting sign-in: ' + error.message);
    }
});

logoutButton.addEventListener('click', async () => {
    console.log('Logout button clicked');
    const { error } = await _supabase.auth.signOut();
    if (error) {
        console.error('Error logging out:', error);
        alert('Error logging out: ' + error.message);
    } else {
        console.log('SignOut command sent successfully.');
        // UI update is handled by onAuthStateChange
    }
});

// --- Journal Entry Loading Function ---
async function loadJournalEntries() {
    if (!currentUser) {
        console.log('loadJournalEntries called, but no user logged in.');
        journalEntriesDiv.innerHTML = ''; // Clear entries if user logs out
        return;
    }

    console.log('Loading journal entries for user:', currentUser.id);
    journalEntriesDiv.innerHTML = '<p>Loading entries...</p>'; // Show loading indicator

    try {
        const { data: entries, error } = await _supabase
            .from('journal_entries')
            // Select all columns INCLUDING the transcript AND the new action_items
            .select('*, full_transcript, action_items') 
            // .eq('user_id', currentUser.id) // RLS handles this, but explicit check is fine too
            .order('created_at', { ascending: false }); // Show newest first

        if (error) {
            console.error('Error fetching journal entries:', error);
            journalEntriesDiv.innerHTML = '<p style="color: red;">Error loading entries.</p>';
            return;
        }

        if (!entries || entries.length === 0) {
            journalEntriesDiv.innerHTML = '<p>No journal entries found.</p>';
            return;
        }

        // Clear loading message
        journalEntriesDiv.innerHTML = '';

        // Display entries
        entries.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.classList.add('journal-entry');
            entryElement.dataset.entryId = entry.id; // Store ID for potential future use

            // Format date nicely
            const date = new Date(entry.created_at).toLocaleString();

            // --- Build Header and Initial Content ---
            let headerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong class="journal-entry-header" style="cursor: pointer;">${date} - ${entry.call_type.toUpperCase()} (Click to view transcript)</strong>
                    <button class="delete-entry-button" data-entry-id="${entry.id}" style="padding: 2px 5px; font-size: 0.8em; cursor: pointer;">Delete</button>
                </div>
                <br>
            `;
            
            let visibleContentHTML = headerHTML; // Start with header
            if (entry.intention) visibleContentHTML += `<em>Intention:</em> ${entry.intention}<br>`;
            // Keep displaying the raw action plan text for context if it exists
            if (entry.action_plan) visibleContentHTML += `<em>Action Plan (Raw):</em> ${entry.action_plan}<br>`; 

            // --- Add Action Items Checklist ---
            if (entry.action_items && Array.isArray(entry.action_items) && entry.action_items.length > 0) {
                visibleContentHTML += '<strong>Action Items:</strong><ul class="action-items-list">';
                entry.action_items.forEach((item, index) => {
                    // Note: Checkbox state is not saved currently
                    visibleContentHTML += `<li><input type="checkbox" id="item-${entry.id}-${index}"> <label for="item-${entry.id}-${index}">${item}</label></li>`;
                });
                visibleContentHTML += '</ul>';
            }
            // --- End Action Items Checklist ---


            // --- Format Transcript (Chat Bubbles) ---
            let transcriptHTML = ''; // Declare once
            if (entry.full_transcript) {
                // --- Format Transcript with Speaker Grouping ---
                let formattedTranscript = "";
                const lines = entry.full_transcript.split('\n');
                let currentSpeaker = null;
                let currentUtterance = "";
            
                function flushUtterance() {
                    if (currentSpeaker && currentUtterance.trim() !== "") {
                        // Determine bubble alignment and specific class
                        const alignmentClass = currentSpeaker === "Me" ? 'me-bubble' : 'actions-bubble';
                        
                        // Get the trimmed utterance directly (space-separated)
                        const utteranceHTML = currentUtterance.trim();

                        // Create the bubble div
                        formattedTranscript += `<div class="chat-bubble ${alignmentClass}">${utteranceHTML}</div>`; 
                    }
                    currentUtterance = ""; // Reset utterance
                }
            
                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    // Skip empty lines entirely
                    if (trimmedLine === "") return; 
            
                    let speaker = null;
                    let text = ""; // Initialize text
            
                    if (trimmedLine.startsWith("Me:")) {
                        speaker = "Me";
                        // Get text after prefix, keep internal whitespace
                        text = line.substring(3).trimLeft(); 
                    } else if (trimmedLine.startsWith("Actions:")) {
                        speaker = "Actions";
                         // Get text after prefix, keep internal whitespace
                        text = line.substring(8).trimLeft();
                    } else {
                        // Line without prefix - assume continuation of the last speaker OR default if first line
                        speaker = currentSpeaker || "Actions"; // Default to Actions if no speaker yet
                        text = line; // Use the original line content (keeping leading/trailing space relative to this line)
                    }
            
                    if (speaker && speaker !== currentSpeaker) {
                        // Speaker changed, flush the previous utterance
                        flushUtterance();
                        currentSpeaker = speaker;
                        currentUtterance = text.trim(); // Start new utterance, trim leading/trailing space
                    } else {
                         // Same speaker (or continuation assumed), append text with a SPACE
                        currentUtterance += (currentUtterance ? " " + text.trim() : text.trim()); 
                    }
                });
            
                // Flush the last utterance after the loop
                flushUtterance();
                // --- End Formatting ---

                transcriptHTML = `
                   <div class="journal-transcript" style="display: none;">
                       <strong>Full Transcript:</strong><br>
                       ${formattedTranscript} 
                   </div>
               `;
            } else {
                 // Message if no transcript is saved
                 transcriptHTML = `
                    <div class="journal-transcript" style="display: none;">
                        <p><em>No full transcript saved for this entry.</em></p>
                    </div>
                `;
            }
             // --- End Transcript Formatting ---


            // Set the combined HTML
            entryElement.innerHTML = visibleContentHTML + transcriptHTML + '<hr>'; // Add a separator

            journalEntriesDiv.appendChild(entryElement);
        });

    } catch (err) {
        console.error('Unexpected error in loadJournalEntries:', err);
        journalEntriesDiv.innerHTML = '<p style="color: red;">An unexpected error occurred.</p>';
    }
}

// --- Call Functionality ---
// Remove WebSocket related variables
// let websocket = null;
let mediaRecorder = null; // May be removed if WebRTC handles audio track directly
let audioContext = null; // Still potentially needed for playback or resampling
let audioQueue = []; // Likely removed, WebRTC uses tracks
let isPlaying = false; // Likely removed
let stopCallBtn = null; // Reference to stop call button
let userStream = null; // Store the user's media stream
let openaiSessionId = null; // Store the OpenAI session ID (Still potentially useful for context)
// let outputAudioFormat = 'pcm16'; // Format handled by WebRTC negotiation
// let isSessionReady = false; // State managed by WebRTC connection state

// WebRTC specific variables
let peerConnection = null;
let dataChannel = null;
let assistantTranscript = ""; // Accumulator for CURRENT AI turn display text
let currentAiResponseId = null; // Track ID of the AI response being displayed

// Variables for transcript logging
let currentCallType = null; 
let currentCallTranscript = "";
let currentJournalEntryId = null;
let lastSpeaker = null; // Track last speaker for formatting ('Me', 'Actions', null)
let currentAssistantTurnDiv = null; // Keep track of the current div for AI delta updates
let currentUserTurnDiv = null; // Keep track of the current div for user delta updates (if needed)

// Placeholder for the backend endpoint that provides OpenAI session tokens
const OPENAI_SESSION_ENDPOINT = '/api/openai-session';
// Base URL for WebRTC SDP exchange
const OPENAI_WEBRTC_URL = 'https://api.openai.com/v1/realtime'; 
// Specify the model (can be dynamic later)
const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview'; 


async function startCall(callType) {
    // --- Store call type and reset transcript ---
    currentCallType = callType;
    currentCallTranscript = "";
    // IMPORTANT: Reset ID here, before any potential early exit or cleanup stopCall
    currentJournalEntryId = null; 
    lastSpeaker = null; // Reset on new call
    if(callStatus) callStatus.innerHTML = ''; // Clear previous transcript display on new call
    // --- End reset ---

    if (!currentUser) {
        alert('Please log in first.');
        return;
    }

    // --- Moved Check & Initial Entry Creation Earlier ---
    if (!currentUser || !currentUser.id) {
        console.error("User object or ID not available at startCall initiation. Current state:", currentUser);
        alert("User authentication issue. Cannot start call. Please try refreshing.");
        if(callStatus) callStatus.textContent = 'Auth Error.';
        currentCallType = null;
        return;
    }

    // --- PRE-CLEANUP: Stop any existing call *without* saving --- 
    console.log("startCall: Performing pre-cleanup stopCall (if needed)...");
    await stopCall(true); // Pass true for isCleanupOnly flag
    console.log("startCall: Pre-cleanup finished.");
    // --- End Pre-cleanup ---

    // --- NEW: Fetch Morning Tasks if Evening Call ---
    let morningActionItems = null;
    if (callType === 'evening') {
        console.log("Evening call: Attempting to fetch morning action items...");
        try {
            // Calculate start of today (midnight)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const { data: morningEntry, error: morningError } = await _supabase
                .from('journal_entries')
                .select('action_items')
                .eq('user_id', currentUser.id)
                .eq('call_type', 'morning')
                .gte('created_at', todayStart.toISOString()) // Entries from today onwards
                .order('created_at', { ascending: false }) // Get the latest one today
                .limit(1)
                .maybeSingle(); // Get one or null
            
            if (morningError) {
                console.error("Error fetching morning entry:", morningError);
                // Continue without tasks if fetch fails
            } else if (morningEntry && morningEntry.action_items && Array.isArray(morningEntry.action_items)) {
                morningActionItems = morningEntry.action_items;
                console.log("Found morning action items:", morningActionItems);
            } else {
                console.log("No morning entry with action items found for today.");
            }
        } catch (fetchErr) {
            console.error("Error in logic fetching morning tasks:", fetchErr);
        }
    }
    // --- End Fetch Morning Tasks ---

    // --- Create Initial Journal Entry ---
    try {
        console.log("Creating initial journal entry...");
        const { data: newEntry, error: insertError } = await _supabase
            .from('journal_entries')
            .insert({ 
                user_id: currentUser.id,
                call_type: currentCallType 
                // action_items will be null initially
            })
            .select('id')
            .single();

        if (insertError) {
            throw insertError; // Let the catch block handle logging/alerting
        }
        if (!newEntry || !newEntry.id) {
            throw new Error("Failed to get ID for new journal entry after insert.");
        }
        currentJournalEntryId = newEntry.id; // SET THE ID FOR *THIS* CALL
        console.log(`Initial journal entry created with ID: ${currentJournalEntryId}`);
    } catch (error) {
        console.error('Error creating initial journal entry:', error);
        alert(`Failed to create journal entry: ${error.message}. Call cannot proceed.`);
        if (callStatus) callStatus.textContent = 'Journal entry error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none'; // Ensure stop button is hidden
        currentCallType = null;
        currentJournalEntryId = null; // Ensure ID is null on failure
        return; // Exit startCall
    }
    // --- End Initial Entry Creation ---

    // Check if a call is already in progress via peerConnection state
    // This check is less critical now due to pre-cleanup stopCall, but harmless
    if (peerConnection && peerConnection.connectionState !== 'closed' && peerConnection.connectionState !== 'failed') {
        console.warn('WebRTC call was already in progress despite pre-cleanup attempt. State:', peerConnection.connectionState);
        // alert('A call is already in progress.'); // Maybe don't alert, just proceed?
        // return; 
    }
    
    // Clean up previous connection if necessary (Should be handled by pre-cleanup stopCall)
    // await stopCall(); 

    // Reset state variables (ID is now set, transcript reset earlier)
    userStream = null;
    openaiSessionId = null;
    // peerConnection = null; // Handled by stopCall cleanup
    // dataChannel = null;
    
    // Show Stop Button *after* successful entry creation and cleanup
    if (stopCallBtn) {
        console.log("Showing Stop Call button");
        stopCallBtn.style.display = 'inline-block';
    }
    
    // --- ADDED DEBUG LOG --- 
    console.log("startCall: Proceeding after showing stop button..."); 
    // --- END ADDED DEBUG LOG ---

    console.log(`Starting ${callType} call (WebRTC)...`);
    if(callStatus) callStatus.textContent = `Initializing ${callType} call...`; // Check if callStatus exists

    // 1. Get Supabase Auth Token (JWT)
    console.log("Attempting to get Supabase session...");
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    console.log("getSession result:", { session, sessionError });

    if (sessionError || !session) {
        console.error('Condition met: Error getting session or no active session.', { sessionError, sessionValue: session });
        alert('Could not get authentication token. Session might have expired. Please log in again.');
        if (callStatus) callStatus.textContent = 'Auth error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return; // Exit startCall
    }
    const accessToken = session.access_token;
    console.log('Got Supabase Access Token.');

    // 2. Fetch OpenAI Session Token (Ephemeral Key)
    let dynamicInstructionsData = {}; // Object to hold dynamic data for backend
    let ephemeralKey = null; // Declare ephemeralKey here

    // --- ADDED LOG --- 
    console.log("Preparing to fetch OpenAI session token...");

    // Pre-fetch user name from auth metadata (fallback)
    dynamicInstructionsData.userName = currentUser.user_metadata?.full_name || currentUser.email;
    console.log(`User name set: ${dynamicInstructionsData.userName}`);

    // Fetch latest profile data before starting call
    let currentProfile = userProfile;
    if (!currentProfile) {
        console.log("No cached profile, fetching before call...");
        try {
            const { data, error: profileError } = await _supabase
                .from('profiles')
                .select(`sobriety_date`)
                .eq('user_id', currentUser.id)
                .maybeSingle();
            // Note: Supabase v2 might not use status 406 for maybeSingle no-row
            if (profileError) throw profileError; 
            currentProfile = data; // Update local cache (will be null if no profile)
            console.log("Profile fetch result:", currentProfile);
        } catch (error) {
             console.error('Error fetching profile before call:', error);
             currentProfile = null;
        }
    }

    // Calculate days sober if date exists
    if (currentProfile?.sobriety_date) {
        // --- Wrap calculation in try...catch --- 
        try { 
            const sobrietyDate = new Date(currentProfile.sobriety_date);
            const today = new Date();
            // Reset time part to compare dates only
            sobrietyDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            if (!isNaN(sobrietyDate)) {
                const diffTime = Math.abs(today - sobrietyDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                dynamicInstructionsData.daysSober = diffDays >= 0 ? diffDays + 1 : 0; 
                console.log(`Days sober calculated: ${dynamicInstructionsData.daysSober}`);
            } else {
                 console.warn("Sobriety date from profile is invalid.");
            }
        } catch (e) {
             console.error("Error calculating days sober:", e);
             // Continue without daysSober if calculation fails
        }
        // --- End calculation wrapper ---
    }

    // --- Pass Morning Tasks to Backend --- 
    dynamicInstructionsData.morning_tasks = morningActionItems; // Add tasks (will be null if none)
    console.log("Data being sent to /api/openai-session:", dynamicInstructionsData);
    // --- End Pass Morning Tasks ---

    // Fetch session token and pass dynamic data
    try {
        const sessionEndpointUrl = `${config.BACKEND_API_URL}/api/openai-session`;
        console.log(`Fetching OpenAI session token from ${sessionEndpointUrl}...`);
        
        const requestBody = JSON.stringify({ 
            call_type: callType, 
            user_name: dynamicInstructionsData.userName,
            days_sober: dynamicInstructionsData.daysSober,
            morning_tasks: dynamicInstructionsData.morning_tasks // Include tasks in body
        });
        console.log("Request body for /api/openai-session:", requestBody);
        
        const response = await fetch(sessionEndpointUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: requestBody
        });
        console.log(`/api/openai-session Response status: ${response.status}`); // <-- ADDED LOG

        if (!response.ok) {
            const errorText = await response.text(); // Read error text
            console.error("/api/openai-session error response body:", errorText); // <-- ADDED LOG
            // Try to parse as JSON for more detail
            let errorDetails = errorText;
            try { errorDetails = JSON.parse(errorText); } catch(e) { /* ignore */ }
            throw new Error(`Failed to get OpenAI session token: ${response.status} ${JSON.stringify(errorDetails)}`);
        }
        
        console.log("Attempting to parse JSON response..."); // <-- ADDED LOG
        const sessionData = await response.json();
        console.log("Parsed session data:", sessionData); // <-- ADDED LOG

        if (!sessionData || !sessionData.client_secret || !sessionData.client_secret.value || !sessionData.id) {
             console.error("Invalid session data received:", sessionData); // <-- ADDED LOG
            throw new Error('Invalid session data received from backend.');
        }

        openaiSessionId = sessionData.id;
        ephemeralKey = sessionData.client_secret.value;
        console.log('Received OpenAI Session ID:', openaiSessionId);
        console.log('Received Ephemeral Key (Client Secret)');

    } catch (error) {
        console.error('Error fetching OpenAI session token:', error); 
        alert(`Failed to start call: ${error.message}`);
        if (callStatus) callStatus.textContent = 'Session token error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return; // Exit startCall
    }
    
    console.log("Proceeding to request microphone access...");

    // 3. Request Microphone Access
    try {
        console.log("Calling getUserMedia..."); // <-- ADDED LOG
        userStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                 // Try preferred settings, browser may adjust
                sampleRate: 24000, 
                channelCount: 1,
                echoCancellation: true, 
                noiseSuppression: true
            } 
        });
        console.log("getUserMedia call finished. User stream:", userStream); // <-- ADDED LOG
        
        if (!userStream) { // <-- ADDED CHECK
             throw new Error("getUserMedia returned null or undefined stream.");
        }

        console.log('Microphone access granted.');
        const audioTracks = userStream.getAudioTracks();
        if (audioTracks.length > 0) {
             console.log('Actual microphone settings:', audioTracks[0].getSettings());
        } else {
             console.warn("User stream obtained but contains no audio tracks.");
             throw new Error("Microphone access granted but no audio tracks found."); // Treat as error
        }
    } catch (err) {
        console.error('Error getting microphone access:', err); 
        alert('Microphone access denied or failed: ' + err.message);
        if (callStatus) callStatus.textContent = 'Mic access error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return; // Exit startCall
    }

    // 4. Initiate WebRTC Connection
    console.log("Proceeding to initiate WebRTC connection..."); // <-- ADDED LOG
    try {
        // Ensure ephemeralKey is valid before proceeding
        if (!ephemeralKey) { // <-- ADDED CHECK
             throw new Error("Cannot initiate WebRTC connection: Ephemeral key is missing.");
        }
        await connectOpenAIWebRTC(ephemeralKey, callType);
    } catch (error) {
         console.error('Error initiating WebRTC connection:', error);
         alert(`Failed to connect via WebRTC: ${error.message}`);
         if (callStatus) callStatus.textContent = 'WebRTC Connection Error.';
         // Attempt cleanup even on WebRTC connection failure
         await stopCall(); 
    }
}

// --- NEW Function to connect to OpenAI via WebRTC ---
async function connectOpenAIWebRTC(ephemeralKey, callType) {
    console.log("Initiating WebRTC connection...");
    callStatus.textContent = 'Setting up WebRTC...';

    // Create PeerConnection
    peerConnection = new RTCPeerConnection();

    // --- Event Handlers for PeerConnection ---
    peerConnection.onicecandidate = (event) => {
        // ICE candidates are typically handled automatically in modern browsers
        // for Offer/Answer, but log them for debugging.
        if (event.candidate) {
            // console.debug('ICE Candidate generated:', event.candidate);
        } else {
            // console.debug('All ICE candidates have been sent');
        }
    };

    peerConnection.onconnectionstatechange = (event) => {
        console.log('WebRTC Connection State Changed:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case "connected":
                callStatus.textContent = "WebRTC Connected.";
                break;
            case "disconnected":
            case "failed":
                callStatus.textContent = "WebRTC Disconnected.";
                stopCall(); // Clean up on failure/disconnect
                break;
            case "closed":
                callStatus.textContent = "WebRTC Call Ended.";
                // Cleanup is likely already done by stopCall
                break;
        }
    };

    peerConnection.onicegatheringstatechange = (event) => {
        console.log('ICE Gathering State Changed:', peerConnection.iceGatheringState);
    };

    peerConnection.onsignalingstatechange = (event) => {
        console.log('Signaling State Changed:', peerConnection.signalingState);
    };

    peerConnection.onerror = (event) => {
         // This often doesn't provide much detail, connectionstatechange is usually more informative
         console.error('WebRTC PeerConnection Error Event:', event);
    };

    // Handle incoming audio track from OpenAI
    peerConnection.ontrack = (event) => {
        // Use template literals correctly
        console.log(`[${Date.now()}] ontrack event fired. Track kind: ${event.track.kind}, ReadyState: ${event.track.readyState}`);
        
        if (event.streams && event.streams[0]) {
            const remoteStream = event.streams[0];
            console.log(`[${Date.now()}] Remote stream received. ID: ${remoteStream.id}, Active: ${remoteStream.active}`);
            
            // Check if the audio element already has this stream
            if (remoteAudioElement.srcObject !== remoteStream) {
                console.log(`[${Date.now()}] Attaching remote stream to pre-created audio element.`);
                remoteAudioElement.srcObject = remoteStream;
                remoteAudioElement.muted = false; // Ensure not muted
            } else {
                 console.log(`[${Date.now()}] Remote stream already attached to audio element.`);
            }
            
            // --- Attempt to play with a short delay --- 
            console.log(`[${Date.now()}] Preparing to call play() via setTimeout...`);
            setTimeout(() => {
                console.log(`[${Date.now()}] Calling play() via setTimeout...`);
                remoteAudioElement.play().then(() => {
                    console.log(`[${Date.now()}] (Delayed) Remote audio element playback initiated successfully.`);
                    // Log state after successful delayed play
                    console.log(`Audio State Post-Delayed-Play: paused=${remoteAudioElement.paused}, muted=${remoteAudioElement.muted}, readyState=${remoteAudioElement.readyState}, networkState=${remoteAudioElement.networkState}`);
                }).catch(error => {
                    console.error(`[${Date.now()}] (Delayed) Error trying to play remote audio element:`, error);
                    console.error(`Audio Element State on Delayed Error: paused=${remoteAudioElement.paused}, muted=${remoteAudioElement.muted}, readyState=${remoteAudioElement.readyState}, networkState=${remoteAudioElement.networkState}, srcObject set=${!!remoteAudioElement.srcObject}`);
                });
            }, 150); // Use a 150ms delay 
            // --- End delayed play attempt ---
            
        } else {
             console.warn(`[${Date.now()}] Received track event without stream data.`);
        }
    };

    // Add local microphone track to send audio to OpenAI
    if (userStream) {
        userStream.getTracks().forEach(track => {
             console.log("Adding local audio track to PeerConnection.");
             peerConnection.addTrack(track, userStream);
        });
    } else {
         throw new Error("User media stream not available to add track.");
    }

    // Set up the data channel for JSON messages
    console.log("Creating data channel 'oai-events'...");
    dataChannel = peerConnection.createDataChannel("oai-events");
    dataChannel.binaryType = 'arraybuffer'; // Set appropriate binary type if needed

    dataChannel.onopen = () => {
        console.log("Data Channel 'oai-events' opened.");
        // NO LONGER sending session.update here, instructions sent at session creation
        // const event = { type: "session.update", session: { instructions: instructions } };
        // sendDataChannelMessage(event);

        // Directly set status now
        callStatus.textContent = `${callType} call ready. Speak now...`;
    };

    dataChannel.onclose = () => {
        console.log("Data Channel 'oai-events' closed.");
        // Connection state change usually handles main cleanup
    };

    dataChannel.onerror = (error) => {
        console.error("Data Channel Error:", error);
    };

    dataChannel.onmessage = (event) => {
        // console.debug("Data Channel message received:", event.data);
        try {
            const message = JSON.parse(event.data);
            // console.debug('Parsed message from Data Channel:', message);

            // Function to add a new turn div
            function addTurnDiv(speaker, text) {
                const turnDiv = document.createElement('div');
                turnDiv.style.marginBottom = '0.5em'; // Add spacing like in CSS
                
                const speakerLabel = document.createElement('strong');
                speakerLabel.textContent = speaker + ":";
                speakerLabel.style.display = 'inline-block'; // Use inline-block as per style.css
                speakerLabel.style.marginRight = '0.5em';
                
                const textSpan = document.createElement('span');
                textSpan.textContent = text;
                
                turnDiv.appendChild(speakerLabel);
                turnDiv.appendChild(textSpan);
                callStatus.appendChild(turnDiv);
                callStatus.scrollTop = callStatus.scrollHeight; // Auto-scroll
                return turnDiv; // Return the created div
            }

            // Process messages similarly to WebSocket approach
            switch (message.type) {
                 case 'session.created': 
                     console.log('OpenAI session confirmed via Data Channel (or inferred):', message);
                     break;
                 
                 // --- Handle AI speech delta ---
                 case 'response.audio_transcript.delta':
                      // --- MODIFIED Check: Only append if same response AND last speaker was AI ---
                      if (message.response_id && 
                          message.response_id === currentAiResponseId && 
                          lastSpeaker === 'Actions' && 
                          currentAssistantTurnDiv) 
                      {
                           // --- Continuation: Append text to the existing AI bubble ---
                           assistantTranscript += message.delta; // Append to display accumulator
                           currentCallTranscript += message.delta; // Append to raw log
                           currentAssistantTurnDiv.textContent = assistantTranscript; // Update existing span
                      } else {
                           // --- Start of a *new* visual AI bubble ---
                           // (Could be a new response_id OR the first delta after a "Me" bubble)
                           
                           // 1. Finalize previous turn in raw log (if needed)
                           if (lastSpeaker === 'Actions' && !currentCallTranscript.endsWith('\n')) {
                                currentCallTranscript += '\n';
                           } else if (lastSpeaker === 'Me' && !currentCallTranscript.endsWith('\n')) {
                                currentCallTranscript += '\n';
                           }

                           // 2. Create NEW display bubble for this AI text
                           const turnDiv = addTurnDiv("Actions", message.delta);
                           currentAssistantTurnDiv = turnDiv.querySelector('span'); // Get the span for potential future appends
                           
                           // 3. Reset display accumulator and update tracking variables
                           assistantTranscript = message.delta;
                           currentAiResponseId = message.response_id; // Track this response ID
                           lastSpeaker = 'Actions';

                           // 4. Add prefix and text to raw log for this new turn
                           // Decide if prefix is needed based on whether it's truly a new response_id?
                           // For now, add prefix whenever creating a new visual bubble for simplicity.
                           // We only add the *prefix* here if it's genuinely the start of the logged turn.
                           // Check if the log *doesn't* already end with the start of this message.
                           // A bit complex, let's simplify: Just add the text, prefix was handled conceptually.
                           const prefix = currentCallTranscript.endsWith('\n') ? "Actions: " : "";
                           currentCallTranscript += prefix + message.delta;
                      }
                      break;

                 // --- Handle User speech completion ---
                 case 'conversation.item.input_audio_transcription.completed':
                      console.log(`Received Data Channel Event: ${message.type}`, message);
                      if (message.transcript) {
                          const userText = message.transcript.trim();
                          // 1. Finalize previous turn in raw log (if needed)
                           if (lastSpeaker === 'Actions' && !currentCallTranscript.endsWith('\n')) {
                               currentCallTranscript += '\n';
                           } // No newline needed if last was 'Me'
                           
                          // 2. Append user transcript to raw log (WITH prefix and newline)
                          currentCallTranscript += `Me: ${userText}\n`; 
                          
                          // 3. Add user turn bubble to display 
                          addTurnDiv("Me", userText);
                          lastSpeaker = 'Me';

                          // 4. Clear AI display accumulator (ready for next AI turn)
                          assistantTranscript = ""; 
                          currentAssistantTurnDiv = null; 
                          // DO NOT reset currentAiResponseId here
                      }
                      break;

                 // --- Handle response completion ---
                 case 'response.done':
                      if (message.response_id === currentAiResponseId) {
                           console.log(`response.done received for currently displayed AI response: ${currentAiResponseId}`);
                           // Add final newline to raw log if needed
                           if (lastSpeaker === 'Actions' && !currentCallTranscript.endsWith('\n')) {
                                currentCallTranscript += '\n';
                           }
                           // Reset tracking for the *next* potential AI response
                           currentAiResponseId = null; 
                           assistantTranscript = ""; 
                           currentAssistantTurnDiv = null;
                      }
                      // Log full response object if present
                      if (message.response) {
                          console.log("Full response object on 'response.done':", message.response);
                          if (message.response.status === 'failed' && message.response.status_details) {
                              console.error("Response generation failed. Details:", message.response.status_details);
                          }
                      }
                      break;
                 
                 // --- Handle session termination/errors (existing code) ---
                 case 'session.warning':
                 case 'session.error':
                 case 'session.terminated':
                      // ... (existing handling: log, addTurnDiv, stopCall) ...
                      // Also reset AI tracking on error/termination
                      currentAiResponseId = null; 
                      assistantTranscript = ""; 
                      currentAssistantTurnDiv = null;
                      break;

                 // --- Remove redundant/potentially problematic newline logic --- 
                 // case 'response.output_item.done': // Let response.done handle final newline
                 // case 'response.audio_transcript.done': // Let response.done handle final newline
                      // Log these events if needed for debugging, but don't modify transcript here
                      // console.log(`Received Data Channel Event (Logged Only): ${message.type}`, message);
                      // break;
                 
                 // --- Log other potentially useful events (existing code) --- 
                 case 'rate_limits.updated':
                 case 'response.output_item.added': 
                 case 'response.content_part.added':
                 case 'output_audio_buffer.started':
                 case 'output_audio_buffer.cleared':
                 case 'response.audio.done': 
                 case 'response.content_part.done': 
                 case 'conversation.item.truncated':
                 case 'input_audio_buffer.speech_started':
                 case 'input_audio_buffer.speech_stopped':
                 case 'input_audio_buffer.committed':
                 case 'conversation.item.created':
                 case 'conversation.item.input_audio_transcription.delta': // Remove incorrect logic from here
                 // case 'response.created': // Handled above
                 // case 'response.done': // Handled above
                      // Log only if not handled elsewhere
                      console.log(`Received Data Channel Event (Logged Only): ${message.type}`, message);
                      break;

                 default:
                     if (message.type === 'error' && message.error) {
                          console.error('Received generic OpenAI error message:', message.error);
                          addTurnDiv("System", `OpenAI Error: ${message.error.message || 'Unknown error'}`);
                          stopCall();
                     } else {
                        console.log('Unhandled message type from Data Channel:', message.type, message);
                     }
            }
        } catch (e) {
            console.error('Failed to parse incoming Data Channel message or handle event:', event.data, e);
        }
    };

    // Start the SDP Offer/Answer exchange
    console.log("Creating SDP Offer...");
    callStatus.textContent = 'Negotiating connection...';
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log("Local description (Offer) set.");

    // Send Offer to OpenAI Realtime endpoint
    const sdpEndpoint = `${OPENAI_WEBRTC_URL}?model=${OPENAI_REALTIME_MODEL}`;
    console.log(`Sending SDP Offer to ${sdpEndpoint}...`);
    const sdpResponse = await fetch(sdpEndpoint, {
        method: "POST",
        body: offer.sdp, // Send the SDP string
        headers: {
            "Authorization": `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp" 
        },
    });

    if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error(`SDP Exchange failed: ${sdpResponse.status}`, errorText);
         try {
            // Check if OpenAI returned JSON error despite Content-Type
             const errorJson = JSON.parse(errorText);
             if (errorJson.error) {
                 throw new Error(`SDP Exchange Failed: ${errorJson.error.message} (Code: ${errorJson.error.code})`);
             }
         } catch(e) { /* Ignore if not JSON */ }
         // Throw generic error if JSON parse failed or didn't contain OpenAI error structure
        throw new Error(`SDP Exchange request failed with status ${sdpResponse.status}`);
    }

    const answerSdp = await sdpResponse.text();
    console.log("Received SDP Answer.");
    const answer = {
        type: "answer",
        sdp: answerSdp,
    };
    await peerConnection.setRemoteDescription(answer);
    console.log("Remote description (Answer) set. WebRTC setup complete.");
    // Connection state change handler will update status further
}

// --- Helper to send messages via DataChannel ---
function sendDataChannelMessage(messageObject) {
    if (dataChannel && dataChannel.readyState === 'open') {
        try {
            const messageString = JSON.stringify(messageObject);
            dataChannel.send(messageString);
            console.log('Sent message via DataChannel:', messageObject);
        } catch (error) {
             console.error("Error sending message via DataChannel:", error, messageObject);
        }
    } else {
        console.warn('Attempted to send message but DataChannel not open. State:', dataChannel?.readyState, messageObject);
    }
}

// --- Update Stop Call function for WebRTC ---
// Add an optional flag to indicate if this is just for cleanup
async function stopCall(isCleanupOnly = false) { 
    console.log(`stopCall() initiated. Is cleanup only: ${isCleanupOnly}`);

    // Capture the ID before cleanup potentially triggers another stopCall or save clears it
    const entryIdToSave = currentJournalEntryId;
    // Only log if we *expect* to save later
    if (!isCleanupOnly) {
        console.log(`stopCall: Captured entry ID to potentially save: ${entryIdToSave}`);
    }

    // --- Perform Cleanup Actions First ---
    if (peerConnection) {
        console.log("Closing RTCPeerConnection...");
        // Unsubscribe event listeners BEFORE closing to prevent race conditions/double calls
        peerConnection.onconnectionstatechange = null;
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onicegatheringstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.onerror = null;
        if (dataChannel) {
            dataChannel.onopen = null;
            dataChannel.onclose = null;
            dataChannel.onerror = null;
            dataChannel.onmessage = null;
            // dataChannel.close(); // Closing peerConnection should close the channel
            dataChannel = null; 
        }
        peerConnection.close();
        peerConnection = null;
    }
    // Double check dataChannel nullification if peerConnection wasn't open
    if (dataChannel) {
        // dataChannel.close(); // Already handled above if peerConnection existed
        dataChannel = null;
    }
    
    if (userStream) {
        console.log("Stopping media stream tracks.");
        userStream.getTracks().forEach(track => track.stop());
        userStream = null;
    }
    
    if (remoteAudioElement && remoteAudioElement.parentNode) {
        // Clean up dynamically added audio element if needed
        // remoteAudioElement.parentNode.removeChild(remoteAudioElement);
        // remoteAudioElement = null;
    } else if (remoteAudioElement) {
        // Pause and reset srcObject if element wasn't added to DOM or is reused
         remoteAudioElement.pause();
         remoteAudioElement.srcObject = null;
    }

    // Reset other state variables
    openaiSessionId = null;
    assistantTranscript = "";
    currentAssistantTurnDiv = null; // Clear reference to live transcript divs
    currentUserTurnDiv = null;
    // Keep currentCallTranscript and lastSpeaker until after potential save
    
    // Hide stop call button ONLY if this is a real stop, not cleanup
    if (!isCleanupOnly && stopCallBtn && stopCallBtn.style.display !== 'none') {
        console.log("Hiding Stop Call button (normal stop)");
        stopCallBtn.style.display = 'none';
    }
    
    // Set status only if not already set by connection state change (which should be detached now)
    // And maybe only if it's a normal stop?
    if (!isCleanupOnly && callStatus && callStatus.textContent !== 'Call ended.') { 
         callStatus.textContent = 'Call ended.';
    }
    // --- End Cleanup Actions ---

    console.log("stopCall cleanup finished.");

    // --- Attempt to Save Transcript (Only Once, and not if just cleaning up) ---
    if (!isCleanupOnly && entryIdToSave) {
        console.log(`stopCall requesting save for entry ID: ${entryIdToSave}`);
        try {
            await saveTranscriptToJournal(entryIdToSave); // Pass the captured ID
        } catch (saveError) {
            console.error(`Error during saveTranscriptToJournal called from stopCall:`, saveError);
            // Even if save fails, reset the transcript state here
            currentCallTranscript = ""; 
            lastSpeaker = null; 
        }
    } else {
        if (isCleanupOnly) {
            console.log("stopCall: Skipping save because isCleanupOnly is true.");
        } else {
            console.log("stopCall: No valid entry ID captured, skipping transcript save.");
        }
        // Explicitly reset potentially lingering transcript data if no ID to save against or skipping
        currentCallTranscript = "";
        lastSpeaker = null;
    }
    
    // --- Final State Reset --- 
    // Now that saving is attempted/skipped, definitively reset the ID for the next call
    currentJournalEntryId = null; 
    console.log("stopCall: Final state reset complete.");
}

// --- Modified function to accept entry ID as argument ---
async function saveTranscriptToJournal(entryIdToProcess) { 
    // Removed: const entryIdToProcess = currentJournalEntryId; 

    // --- MODIFIED CHECK: Check argument and transcript content --- 
    if (!entryIdToProcess) {
        // This case should ideally not be reached if called correctly from stopCall
        console.error("saveTranscriptToJournal called without a valid entryIdToProcess.");
        return; 
    }
    // Proceed even if transcript is empty, the check is primarily for the ID now.
    const transcriptToSave = currentCallTranscript || ""; // Ensure we save empty string if null/undefined
    console.log(`Attempting to save transcript (length: ${transcriptToSave.length}) and process action items for journal entry ID: ${entryIdToProcess}`);

    try {
        // --- Step 1: Save the transcript (even if empty) ---
        const { data: updateData, error: updateError } = await _supabase
            .from('journal_entries')
            .update({ 
                full_transcript: transcriptToSave, // Save transcript as is
             }) 
            .eq('id', entryIdToProcess)
            .eq('user_id', currentUser.id)
            .select('id') // Select the id back to confirm
            .single();

        if (updateError) {
            console.error("Error saving transcript to journal:", updateError);
            // Decide if we should still attempt action item generation? Maybe not if transcript save failed.
            // Reset state and exit
            currentJournalEntryId = null; 
            currentCallTranscript = ""; 
            lastSpeaker = null; 
            return; 
        }
        
        // --- Check if update actually happened (optional but good practice) ---
        if (!updateData || !updateData.id) {
             console.warn("Transcript update seemed to succeed but no ID returned. Aborting action item generation.");
             currentJournalEntryId = null; 
             currentCallTranscript = ""; 
             lastSpeaker = null; 
             return; 
        }

        console.log("Transcript saved successfully to journal entry:", entryIdToProcess);

        // --- Step 2: Trigger Action Item Generation (if transcript saved) ---
        console.log(`Triggering action item generation for entry: ${entryIdToProcess}`);
        // Get current session token for the backend API call
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
        if (sessionError || !session) {
             console.error('Error getting session token before generating action items:', sessionError);
             // Transcript is saved, but action items won't be generated now. Refresh might show them later.
             loadJournalEntries(); // Refresh journal entries anyway
        } else {
            try {
                const backendUrl = config.BACKEND_API_URL || ''; // Get backend URL from config.js
                const response = await fetch(`${backendUrl}/api/generate-action-items`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ journal_entry_id: entryIdToProcess })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Action item generation failed: ${response.status}`, errorData);
                    // Handle specific errors? e.g., 404 transcript not found (shouldn't happen here)
                } else {
                    const result = await response.json();
                    console.log("Action item generation successful:", result);
                }
            } catch (fetchError) {
                 console.error("Network or fetch error calling /api/generate-action-items:", fetchError);
            } finally {
                 // Refresh journal entries regardless of action item success/failure
                 // The entry list will show transcript immediately, and action items if they were generated & saved.
                 loadJournalEntries(); 
            }
        }

    } catch(error) {
        // Catch errors from the initial transcript update attempt OR the action item fetch
        console.error(`Error during saveTranscriptToJournal for entry ${entryIdToProcess}:`, error);
        // Re-throw the error so stopCall's catch block can see it if needed
        throw error; 
    } 
    // Removed the finally block that reset currentJournalEntryId
}

// --- Update Event Listener for Toggling Transcripts AND Deleting Entries ---
if (journalEntriesDiv) {
    journalEntriesDiv.addEventListener('click', async (event) => { // Make listener async
        // Check if a header was clicked (for toggling transcript)
        if (event.target.classList.contains('journal-entry-header')) {
            // Find the parent journal-entry element
            const entryElement = event.target.closest('.journal-entry');
            if (entryElement) {
                // Find the transcript div within this entry
                const transcriptDiv = entryElement.querySelector('.journal-transcript');
                if (transcriptDiv) {
                    // Toggle display
                    const isHidden = transcriptDiv.style.display === 'none';
                    transcriptDiv.style.display = isHidden ? 'block' : 'none';
                    // Optional: Update header text 
                    event.target.textContent = event.target.textContent.replace(
                        isHidden ? '(Click to view transcript)' : '(Click to hide transcript)',
                        isHidden ? '(Click to hide transcript)' : '(Click to view transcript)'
                    );
                }
            }
        }

        // Check if a delete button was clicked
        if (event.target.classList.contains('delete-entry-button')) {
            const button = event.target;
            const entryId = button.dataset.entryId;
            
            if (!entryId) {
                console.error("Delete button clicked but missing entry ID.");
                return;
            }

            // --- Confirmation Dialog --- 
            if (window.confirm("Are you sure you want to delete this journal entry? This cannot be undone.")) {
                console.log(`Attempting to delete journal entry ID: ${entryId}`);
                button.disabled = true; // Disable button during deletion
                button.textContent = 'Deleting...';

                try {
                    // Attempt deletion using Supabase client library
                    // Assumes RLS policy allows users to delete their own entries
                    const { error: deleteError } = await _supabase
                        .from('journal_entries')
                        .delete()
                        .eq('id', entryId);

                    if (deleteError) {
                        throw deleteError; // Throw error to be caught below
                    }

                    console.log(`Successfully deleted entry ID: ${entryId}`);
                    // Remove the entry element directly from the DOM for immediate feedback
                    const entryElementToRemove = button.closest('.journal-entry');
                    if (entryElementToRemove) {
                        entryElementToRemove.remove();
                    } else {
                        // Fallback: Reload all entries if element wasn't found
                        loadJournalEntries(); 
                    }

                } catch (error) {
                    console.error(`Error deleting journal entry ID ${entryId}:`, error);
                    alert(`Failed to delete entry: ${error.message}`);
                    // Re-enable button on error
                    button.disabled = false; 
                    button.textContent = 'Delete';
                }
            } else {
                // User clicked cancel
                console.log("Deletion cancelled by user.");
            }
        }
    });
}

// Add CSS for the action items list (Optional, basic styling)
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
.action-items-list { 
    list-style: none; 
    padding-left: 0; 
    margin-top: 5px; 
    margin-bottom: 10px; 
}
.action-items-list li { 
    margin-bottom: 4px; 
}
.action-items-list input[type="checkbox"] {
    margin-right: 8px;
    cursor: pointer;
}
.action-items-list label {
    cursor: pointer;
}
`;
document.head.appendChild(styleSheet);

// --- NEW: Function to load user profile ---
async function loadUserProfile() {
    if (!currentUser) return;

    console.log("Loading user profile...");
    // Reset status and input before loading
    if (profileStatus) profileStatus.textContent = 'Loading profile...';
    if (sobrietyDateInput) sobrietyDateInput.value = ''; 
    userProfile = null;

    try {
        const { data, error, status } = await _supabase
            .from('profiles')
            .select(`sobriety_date`)
            .eq('user_id', currentUser.id)
            .maybeSingle(); // Use maybeSingle() in case profile doesn't exist yet

        if (error && status !== 406) { // 406 means no rows found, which is okay with maybeSingle()
            throw error;
        }

        if (data) {
            console.log("Profile data received:", data);
            userProfile = data; // Store profile data
            if (data.sobriety_date && sobrietyDateInput) {
                sobrietyDateInput.value = data.sobriety_date; // Set input value
                if (profileStatus) profileStatus.textContent = 'Profile loaded.';
            } else {
                 if (profileStatus) profileStatus.textContent = 'Set your recovery start date.';
            }
        } else {
            console.log("No profile found for user.");
            if (profileStatus) profileStatus.textContent = 'Set your recovery start date.';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        if (profileStatus) profileStatus.textContent = 'Error loading profile.';
        userProfile = null; // Ensure profile is null on error
    }
}

// --- NEW: Function to save user profile ---
async function saveUserProfile() {
    if (!currentUser || !sobrietyDateInput) return;

    const sobrietyDate = sobrietyDateInput.value;
    // Basic validation: Check if it's a valid date string
    if (!sobrietyDate || isNaN(new Date(sobrietyDate))) {
        if(profileStatus) profileStatus.textContent = 'Please enter a valid date.';
        return;
    }

    console.log(`Saving sobriety date: ${sobrietyDate} for user: ${currentUser.id}`);
    if(profileStatus) profileStatus.textContent = 'Saving...';

    try {
        const { error } = await _supabase
            .from('profiles')
            .upsert({ 
                user_id: currentUser.id, // Link to the logged-in user
                sobriety_date: sobrietyDate,
                updated_at: new Date() // Explicitly set updated_at on upsert
             }, {
                onConflict: 'user_id' // If profile with user_id exists, update it
             });

        if (error) {
            throw error;
        }

        console.log("Profile saved successfully.");
        if(profileStatus) profileStatus.textContent = 'Date saved successfully!';
        // Reload profile data immediately after saving
        await loadUserProfile(); 

    } catch (error) {
        console.error('Error saving user profile:', error);
        if(profileStatus) profileStatus.textContent = 'Error saving date.';
    }
}

// --- ATTACH EVENT LISTENERS (AFTER FUNCTIONS ARE DEFINED) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded. Attaching call button listeners...'); // Log DOM loaded
    
    const morningCallBtn = document.getElementById('morning-call-button');
    const eveningCallBtn = document.getElementById('evening-call-button');
    stopCallBtn = document.getElementById('stop-call-button'); // Ensure stopCallBtn is assigned here

    // Log found elements
    console.log('Morning call button element:', morningCallBtn);
    console.log('Evening call button element:', eveningCallBtn);
    console.log('Stop call button element:', stopCallBtn);

    if (morningCallBtn) {
        morningCallBtn.addEventListener('click', () => {
            console.log('Morning Call Button Listener EXECUTED!'); 
            startCall('morning');
        });
        console.log('Morning call listener attached.');
    } else {
        console.error('Morning call button not found! Cannot attach listener.');
    }

    if (eveningCallBtn) {
        eveningCallBtn.addEventListener('click', () => {
            console.log('Evening Call Button Listener EXECUTED!'); 
            startCall('evening');
        });
        console.log('Evening call listener attached.');
    } else {
        console.error('Evening call button not found! Cannot attach listener.');
    }
    
    if (stopCallBtn) {
        stopCallBtn.addEventListener('click', () => {
            console.log('Stop Call Button Listener EXECUTED!');
            stopCall();
        });
        console.log('Stop call listener attached.');
    } else {
        console.error('Stop call button not found! Cannot attach listener.');
    }

    // Add listener for the profile save button
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', saveUserProfile); // Ensure saveUserProfile exists
        console.log("Profile save button listener attached.");
    } else {
         console.error('Save profile button not found!');
    }
});
