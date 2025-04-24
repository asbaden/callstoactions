// Ensure config.js is loaded first and contains SUPABASE_URL and SUPABASE_ANON_KEY

// Initialize Supabase client using the config object
const { createClient } = supabase;
const _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
console.log('Supabase client instance:', _supabase);

console.log('Supabase Initialized');

// --- Updated DOM Elements ---
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authSection = document.getElementById('auth-section');
const mainContent = document.getElementById('main-content');
const morningView = document.getElementById('morning-view');
const eveningView = document.getElementById('evening-view');
const journalView = document.getElementById('journal-view');
const profileView = document.getElementById('profile-view');
const callInProgress = document.getElementById('call-in-progress');
const callStatus = document.getElementById('call-status');
const journalEntriesContainer = document.getElementById('journal-entries');

// Header elements
const daysCount = document.getElementById('days-count');
const recoveryDaysCount = document.getElementById('recovery-days-count');
const recoveryDaysCountEvening = document.getElementById('recovery-days-count-evening');
const editDaysBtn = document.getElementById('edit-days-btn');
const historyBtn = document.getElementById('history-btn');
const settingsBtn = document.getElementById('settings-btn');

// View switching buttons
const switchToEveningBtn = document.getElementById('switch-to-evening');
const switchToMorningBtn = document.getElementById('switch-to-morning');

// Call buttons
const morningCallBtn = document.getElementById('morning-call-button');
const eveningCallBtn = document.getElementById('evening-call-button');
const stopCallBtn = document.getElementById('stop-call-button');

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

// --- View Switching Functions ---
function showMorningView() {
  morningView.style.display = 'block';
  eveningView.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  callInProgress.style.display = 'none';
}

function showEveningView() {
  morningView.style.display = 'none';
  eveningView.style.display = 'block';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  callInProgress.style.display = 'none';
}

function showJournalView() {
  morningView.style.display = 'none';
  eveningView.style.display = 'none';
  journalView.style.display = 'block';
  profileView.style.display = 'none';
  callInProgress.style.display = 'none';
  loadJournalEntries();
}

function showProfileView() {
  morningView.style.display = 'none';
  eveningView.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'block';
  callInProgress.style.display = 'none';
}

function showCallInProgress() {
  morningView.style.display = 'none';
  eveningView.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  callInProgress.style.display = 'block';
}

// --- Basic UI Function ---
function updateUI(user) {
  currentUser = user;
  if (user) {
    // User is logged in
    authSection.style.display = 'none';
    mainContent.style.display = 'block';
    showMorningView(); // Default to morning view
    loadJournalEntries();
    loadUserProfile(); // Load profile data including sobriety date
    console.log('UI Updated: User logged in:', user.email);
  } else {
    // User is logged out
    authSection.style.display = 'block';
    mainContent.style.display = 'none';
    if (sobrietyDateInput) sobrietyDateInput.value = ''; // Clear date input
    if (profileStatus) profileStatus.textContent = ''; // Clear profile status
    if (journalEntriesContainer) journalEntriesContainer.innerHTML = ''; // Clear entries
    console.log('UI Updated: User logged out');
  }
}

// --- Hook into UI functions ---
// Add action items loading to updateUI
const _originalUpdateUI = updateUI;
function _extendedUpdateUI(user) {
  _originalUpdateUI(user);
  
  // Load action items when UI is updated and user is logged in
  if (user) {
    loadActionItems();
  }
}
updateUI = _extendedUpdateUI;

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
        journalEntriesContainer.innerHTML = ''; // Clear entries if user logs out
        return;
    }

    console.log('Loading journal entries for user:', currentUser.id);
    journalEntriesContainer.innerHTML = '<p>Loading entries...</p>'; // Show loading indicator

    // Update the current date in the journal header
    const currentJournalDate = document.getElementById('current-journal-date');
    if (currentJournalDate) {
        const today = new Date();
        currentJournalDate.textContent = today.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    try {
        const { data: entries, error } = await _supabase
            .from('journal_entries')
            .select('*, full_transcript, action_items')
            .order('created_at', { ascending: false }); // Show newest first

        if (error) {
            console.error('Error fetching journal entries:', error);
            journalEntriesContainer.innerHTML = '<p style="color: red;">Error loading entries.</p>';
            return;
        }

        if (!entries || entries.length === 0) {
            journalEntriesContainer.innerHTML = '<p>No journal entries found.</p>';
            return;
        }

        // Clear loading message
        journalEntriesContainer.innerHTML = '';

        // Group entries by date
        const entriesByDate = {};
        entries.forEach(entry => {
            const dateObj = new Date(entry.created_at);
            const dateString = dateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            if (!entriesByDate[dateString]) {
                entriesByDate[dateString] = [];
            }
            entriesByDate[dateString].push(entry);
        });

        // Display entries grouped by date
        Object.keys(entriesByDate).forEach(dateString => {
            // Create a date container
            const dateContainer = document.createElement('div');
            dateContainer.classList.add('date-group');
            
            // Create date header
            const dateHeader = document.createElement('h3');
            dateHeader.classList.add('date-header');
            dateHeader.textContent = dateString;
            dateContainer.appendChild(dateHeader);
            
            // Create entry list for this date
            const dateEntries = document.createElement('ul');
            dateEntries.classList.add('journal-list');
            
            // Add entries for this date
            entriesByDate[dateString].forEach(entry => {
                const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                
                const entryElement = document.createElement('li');
                entryElement.classList.add('journal-item');
                entryElement.dataset.entryId = entry.id;

                // Determine icon based on call type
                const iconType = entry.call_type === 'morning' ? 'wb_sunny' : 'nights_stay';
                const iconClass = entry.call_type === 'morning' ? 'icon-morning' : 'icon-evening';
                
                // Create the journal entry with the new design
                let entryHTML = `
                    <div class="journal-header">
                        <div class="journal-type">
                            <div class="icon ${iconClass}">
                                <span class="material-icons">${iconType}</span>
                            </div>
                            <span>${time} - ${entry.call_type.charAt(0).toUpperCase() + entry.call_type.slice(1)} Check-in</span>
                        </div>
                        <button class="delete-entry-button" data-entry-id="${entry.id}">Delete</button>
                    </div>
                `;
                
                // Add action items if available
                if (entry.action_items && Array.isArray(entry.action_items) && entry.action_items.length > 0) {
                    entryHTML += '<div class="action-items"><div class="action-items-title">Action items:</div>';
                    
                    entry.action_items.forEach(item => {
                        entryHTML += `
                            <div class="action-item">
                                <span class="action-item-bullet">•</span>
                                <span>${item}</span>
                            </div>
                        `;
                    });
                    
                    entryHTML += '</div>';
                }

                // Add transcript section (hidden by default)
                if (entry.full_transcript) {
                    // Format transcript (similar to existing code)
                    let formattedTranscript = "";
                    const lines = entry.full_transcript.split(/\n+/).filter(line => line.trim() !== '');

                    lines.forEach(line => {
                        const trimmedLine = line.trim();
                        let text = "";
                        let alignmentClass = '';

                        if (trimmedLine.startsWith("Me:")) {
                            text = trimmedLine.substring(3).trim();
                            alignmentClass = 'me-bubble';
                        } else if (trimmedLine.startsWith("Actions:")) {
                            text = trimmedLine.substring(8).trim();
                            alignmentClass = 'actions-bubble';
                        } else {
                            console.warn("Found transcript line without expected prefix:", trimmedLine);
                            text = trimmedLine;
                            alignmentClass = 'actions-bubble';
                        }

                        if (alignmentClass && text) {
                            formattedTranscript += `<div class="chat-bubble ${alignmentClass}">${text}</div>`;
                        }
                    });

                    entryHTML += `
                        <div class="journal-transcript" style="display: none;">
                            ${formattedTranscript || '<p><em>No transcript available</em></p>'}
                        </div>
                    `;
                }

                entryElement.innerHTML = entryHTML;
                dateEntries.appendChild(entryElement);
            });
            
            // Add the entries list to the date container
            dateContainer.appendChild(dateEntries);
            
            // Add the date container to the journal entries container
            journalEntriesContainer.appendChild(dateContainer);
        });

    } catch (err) {
        console.error('Unexpected error in loadJournalEntries:', err);
        journalEntriesContainer.innerHTML = '<p style="color: red;">An unexpected error occurred.</p>';
    }
}

// --- Call Functionality ---
// Remove WebSocket related variables
// let websocket = null;
let mediaRecorder = null; // May be removed if WebRTC handles audio track directly
let audioContext = null; // Still potentially needed for playback or resampling
let audioQueue = []; // Likely removed, WebRTC uses tracks
let isPlaying = false; // Likely removed
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
let waitingForUserResponse = false; // NEW: Flag to track when AI has asked a question and waiting for user
let conversationMessages = []; // Initialize conversationMessages globally
let currentSpeaker = null; // Initialize currentSpeaker to prevent "not defined" errors
console.log("Initialized global conversation state variables");

// Placeholder for the backend endpoint that provides OpenAI session tokens
const OPENAI_SESSION_ENDPOINT = '/api/openai-session';
// Base URL for WebRTC SDP exchange
const OPENAI_WEBRTC_URL = 'https://api.openai.com/v1/realtime'; 
// Specify the model (can be dynamic later)
const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview'; 


async function startCall(callType) {
    // Show call-in-progress view
    showCallInProgress();
    
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
                .maybeSingle();
            
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
        const currentTimestamp = new Date().toISOString(); // Get current timestamp in ISO format
        const { data: newEntry, error: insertError } = await _supabase
            .from('journal_entries')
            .insert({ 
                user_id: currentUser.id,
                call_type: currentCallType,
                created_at: currentTimestamp // Explicitly set the current timestamp
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
                 
                 // --- Handle User speech completion ---
                 case 'conversation.item.input_audio_transcription.completed':
                      console.log(`Received Data Channel Event: ${message.type}`, message);
                      if (message.transcript) {
                          const userText = message.transcript.trim();
                          
                          // Add user turn bubble to display (always show in UI)
                          addTurnDiv("Me", userText);
                          
                          // Process ALL user messages
                          // 1. Finalize previous turn in raw log (if needed)
                          if (lastSpeaker === 'Actions' && !currentCallTranscript.endsWith('\n')) {
                              currentCallTranscript += '\n';
                          } // No newline needed if last was 'Me'
                          
                          // 2. Append user transcript to raw log (WITH prefix and newline)
                          currentCallTranscript += `Me: ${userText}\n`; 
                          
                          // 3. Add user message to conversationMessages for transcript saving
                          conversationMessages.push({
                              speaker: "User",
                              text: userText
                          });
                          console.log("Added user message to conversationMessages:", conversationMessages);
                          
                          // 4. Reset AI response tracking and response waiting flag
                          currentAiResponseId = null;
                          assistantTranscript = "";
                          currentAssistantTurnDiv = null;
                          waitingForUserResponse = false; // Reset the waiting flag when user speaks
                          
                          lastSpeaker = 'Me';
                      }
                      break;

                 // --- Handle AI text chunks ---
                 case 'response.content_part.added':
                     console.log("Content part message:", message);
                     // Log the actual content structure to understand how it's formatted
                     console.log("Content structure:", JSON.stringify(message.content));
                     
                     // Try to find the text content in various possible locations
                     let textContent = "";
                     if (message.content?.text) {
                         textContent = message.content.text;
                     } else if (message.content?.value) {
                         textContent = message.content.value;
                     } else if (typeof message.content === 'string') {
                         textContent = message.content;
                     }
                     
                     console.log("Extracted text content:", textContent);
                     
                     if (textContent) {
                         // Set the current speaker to AI if not already set
                         if (currentSpeaker !== "AI") {
                             currentSpeaker = "AI";
                             currentMessage = textContent;
                         } else {
                             // Accumulate the AI message text
                             currentMessage += textContent;
                         }
                         console.log("Accumulated AI message so far:", currentMessage);
                         
                         // Update display in real-time
                         if (currentAssistantTurnDiv && lastSpeaker === "Actions") {
                             // If we already have a bubble for this AI response, update it
                             assistantTranscript += textContent;
                             currentAssistantTurnDiv.textContent = assistantTranscript;
                         } else {
                             // Create a new bubble for this AI response
                             const turnDiv = addTurnDiv("Actions", textContent);
                             currentAssistantTurnDiv = turnDiv.querySelector('span');
                             assistantTranscript = textContent;
                             
                             // Update raw transcript format as well
                             if (currentCallTranscript && !currentCallTranscript.endsWith('\n')) {
                                 currentCallTranscript += '\n';
                             }
                             currentCallTranscript += `Actions: ${textContent}`;
                             lastSpeaker = 'Actions';
                         }
                         
                         // Add to conversationMessages if we have enough text
                         if (currentMessage.length >= 5 && !conversationMessages.some(msg => msg.speaker === "AI" && msg.text.includes(currentMessage))) {
                             conversationMessages.push({
                                 speaker: "AI",
                                 text: currentMessage
                             });
                             console.log("Added current message to conversationMessages:", conversationMessages);
                         }
                     }
                     break;

                 // --- Handle incremental AI speech content ---
                 case 'response.audio_transcript.delta':
                     // console.log("AI transcript delta received:", message);
                     // Check for content in various possible locations
                     let deltaText = "";
                     if (message.delta) {
                         deltaText = message.delta;
                     } else if (message.content?.delta) {
                         deltaText = message.content.delta;
                     }

                     if (deltaText) {
                         // console.log("AI transcript delta content:", deltaText);

                         // Update display in real-time & raw transcript
                         if (currentAssistantTurnDiv && lastSpeaker === 'Actions') {
                             // If we already have a bubble for this AI response, update it
                             assistantTranscript += deltaText;
                             currentAssistantTurnDiv.textContent = assistantTranscript;
                             // Append delta to raw transcript (no prefix)
                             currentCallTranscript += deltaText;
                         } else {
                             // Create a new bubble for this AI response
                             const turnDiv = addTurnDiv("Actions", deltaText);
                             currentAssistantTurnDiv = turnDiv.querySelector('span');
                             assistantTranscript = deltaText;

                             // Update raw transcript format - Add prefix ONLY for the first delta
                             if (currentCallTranscript && !currentCallTranscript.endsWith('\n')) {
                                 currentCallTranscript += '\n';
                             }
                             currentCallTranscript += `Actions: ${deltaText}`; // Add prefix here
                             lastSpeaker = 'Actions';
                         }

                         // Accumulate for the structured messages using global vars
                         if (!currentSpeaker || currentSpeaker !== "AI") { // Start of new AI message
                             currentSpeaker = "AI";
                             currentMessage = deltaText;
                         } else { // Continuation of AI message
                             currentMessage += deltaText;
                         }
                     }
                     break;

                 // --- Handle complete AI speech transcript ---
                 case 'response.audio_transcript.done':
                     console.log("AI speech transcript received:", message);
                     // The transcript might be directly in message.transcript or nested inside other fields
                     let aiText = "";
                     
                     if (message.transcript) {
                         aiText = message.transcript.trim();
                     } else if (message.item && message.item.transcript) {
                         aiText = message.item.transcript.trim();
                     } else if (message.response && message.response.transcript) {
                         aiText = message.response.transcript.trim();
                     } else if (message.content && message.content.transcript) {
                         aiText = message.content.transcript.trim();
                     }
                     
                     console.log("AI transcript content:", aiText);
                     
                     // Only process if we found text content
                     if (aiText) {
                         // Add the AI response to our structured conversation if not already added
                         conversationMessages.push({
                             speaker: "AI",
                             text: aiText
                         });
                         
                         // Also update the display
                         const turnDiv = addTurnDiv("Actions", aiText);
                         currentAssistantTurnDiv = turnDiv.querySelector('span');
                         
                         // Update raw transcript format as well
                         if (currentCallTranscript && !currentCallTranscript.endsWith('\n')) {
                             currentCallTranscript += '\n';
                         }
                         currentCallTranscript += `Actions: ${aiText}\n`;
                         lastSpeaker = 'Actions';
                         
                         // Log for debugging
                         console.log("Updated conversationMessages:", conversationMessages);
                         console.log("Updated currentCallTranscript:", currentCallTranscript);
                     } else {
                         // If no transcript content was found, log the full message structure for debugging
                         console.log("Could not find transcript content. Full message structure:", JSON.stringify(message));
                     }
                     break;

                 // --- Finalize AI turn ---
                 case 'response.output_item.done':
                     console.log("AI response output complete:", message);

                     // Add the complete accumulated AI message to structured conversation
                     if (currentSpeaker === 'AI' && currentMessage) {
                         // Check if a similar message (prefix) already exists to avoid duplicates
                         const existingMsgIndex = conversationMessages.findIndex(msg => msg.speaker === "AI" && msg.text.startsWith(currentMessage.substring(0, 20)));
                         if (existingMsgIndex === -1) {
                           conversationMessages.push({
                               speaker: "AI",
                               text: currentMessage.trim() // Save trimmed complete message
                           });
                           console.log("Added final AI message to conversationMessages:", conversationMessages);
                         } else {
                             // Optionally update the existing message if the new one is longer/more complete
                             if (currentMessage.length > conversationMessages[existingMsgIndex].text.length) {
                                 conversationMessages[existingMsgIndex].text = currentMessage.trim();
                                 console.log("Updated existing AI message in conversationMessages:", conversationMessages);
                             }
                         }
                     }

                     // Finalize raw transcript with a newline if needed
                     if (lastSpeaker === 'Actions' && currentCallTranscript && !currentCallTranscript.endsWith('\n')) {
                         currentCallTranscript += '\n';
                     }

                     // Reset state for the next turn
                     currentMessage = "";
                     currentSpeaker = null;
                     assistantTranscript = ""; // Reset live display accumulator
                     currentAssistantTurnDiv = null; // Reset live display div
                     // lastSpeaker remains 'Actions' until user speaks
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
const _originalStopCall = stopCall;
async function _extendedStopCall(isCleanupOnly = false) {
  await _originalStopCall(isCleanupOnly);
  
  // After a call, check if we need to update action items
  if (!isCleanupOnly && currentCallType === 'morning') {
    // Reset the processed flag so we load fresh items
    localStorage.removeItem('morningCallItemsProcessed');
    
    // Update with a slight delay to allow database to update
    setTimeout(() => {
      loadActionItems();
    }, 1000);
  }
}
stopCall = _extendedStopCall;

// --- Modified function to accept entry ID as argument ---
async function saveTranscriptToJournal(entryIdToProcess) {
    if (!entryIdToProcess) {
        console.error("saveTranscriptToJournal called without a valid entryIdToProcess.");
        return;
    }
    
    // Use the structured conversation array for saving
    // First, generate a clean alternate format that looks like a natural conversation
    let structuredTranscript = "";
    if (conversationMessages.length > 0) {
        console.log("Creating structured transcript from conversation messages:", conversationMessages);
        conversationMessages.forEach((msg, index) => {
            const speakerLabel = msg.speaker === "User" ? "Me" : "Actions";
            structuredTranscript += `${speakerLabel}: ${msg.text}`;
            // Add appropriate line breaks between messages
            if (index < conversationMessages.length - 1) {
                structuredTranscript += "\n\n";
            }
        });
    } else {
        console.log("No conversation messages to create transcript from");
        // If no structured messages were captured, check if there's at least some AI content in assistantTranscript
        if (assistantTranscript && assistantTranscript.trim() !== "") {
            console.log("Using assistantTranscript as fallback for AI response");
            // Create a minimal transcript with the user message and AI response
            structuredTranscript = "Me: Hello?\n\nActions: " + assistantTranscript.trim();
        }
    }
    
    // If we still have no transcript but have some raw transcript, use that as a last resort
    if (!structuredTranscript && currentCallTranscript) {
        console.log("Using raw currentCallTranscript as last resort");
        structuredTranscript = currentCallTranscript;
    }
    
    // Use the structured transcript if available, otherwise fall back to the existing format
    const transcriptToSave = structuredTranscript || currentCallTranscript || ""; 
    console.log(`Attempting to save transcript (length: ${transcriptToSave.length}) and process action items for journal entry ID: ${entryIdToProcess}`);

    try {
        // --- Step 1: Save the transcript (even if empty) ---
        const { data: updateData, error: updateError } = await _supabase
            .from('journal_entries')
            .update({ 
                full_transcript: transcriptToSave, // Save transcript as is
             })
            .eq('id', entryIdToProcess) // Keep using internal parameter name
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
if (journalEntriesContainer) {
    journalEntriesContainer.addEventListener('click', (event) => {
        // Check if a journal entry or its header was clicked (but not action items or buttons)
        const entryItem = event.target.closest('.journal-item');
        const isActionItem = event.target.closest('.action-item');
        const isDeleteButton = event.target.classList.contains('delete-entry-button');
        
        // Only toggle transcript if clicking on the entry (not a button or action item)
        if (entryItem && !isActionItem && !isDeleteButton) {
            const transcriptDiv = entryItem.querySelector('.journal-transcript');
            if (transcriptDiv) {
                // Toggle display
                const isHidden = transcriptDiv.style.display === 'none';
                transcriptDiv.style.display = isHidden ? 'flex' : 'none';
                
                // Toggle active class
                if (isHidden) {
                    entryItem.classList.add('active');
                } else {
                    entryItem.classList.remove('active');
                }
            }
        }
        
        // Handle delete button clicks (existing functionality)
        if (isDeleteButton) {
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
                    _supabase
                        .from('journal_entries')
                        .delete()
                        .eq('id', entryId)
                        .then(({ error: deleteError }) => {
                            if (deleteError) {
                                throw deleteError;
                            }

                            console.log(`Successfully deleted entry ID: ${entryId}`);
                            // Remove the entry element directly from the DOM for immediate feedback
                            const entryElementToRemove = button.closest('.journal-item');
                            if (entryElementToRemove) {
                                entryElementToRemove.remove();
                            } else {
                                // Fallback: Reload all entries if element wasn't found
                                loadJournalEntries(); 
                            }
                        })
                        .catch(error => {
                            console.error(`Error deleting journal entry ID ${entryId}:`, error);
                            alert(`Failed to delete entry: ${error.message}`);
                            // Re-enable button on error
                            button.disabled = false; 
                            button.textContent = 'Delete';
                        });
                } catch (error) {
                    console.error(`Error initiating delete for journal entry ID ${entryId}:`, error);
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
            .maybeSingle();

        if (error && status !== 406) {
            throw error;
        }

        if (data) {
            console.log("Profile data received:", data);
            userProfile = data;
            
            if (data.sobriety_date) {
                if (sobrietyDateInput) {
                    sobrietyDateInput.value = data.sobriety_date;
                }
                
                // Calculate days sober
                const sobrietyDate = new Date(data.sobriety_date);
                const today = new Date();
                sobrietyDate.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);

                if (!isNaN(sobrietyDate)) {
                    const diffTime = Math.abs(today - sobrietyDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const daysText = `${diffDays} days`;
                    
                    // Update all day counters
                    if (daysCount) daysCount.textContent = daysText;
                    if (recoveryDaysCount) recoveryDaysCount.textContent = daysText;
                    if (recoveryDaysCountEvening) recoveryDaysCountEvening.textContent = daysText;
                }
                
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
        userProfile = null;
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
    console.log('DOM fully loaded. Attaching event listeners...');
    
    // View switching
    if (switchToEveningBtn) {
        switchToEveningBtn.addEventListener('click', showEveningView);
    }
    
    if (switchToMorningBtn) {
        switchToMorningBtn.addEventListener('click', showMorningView);
    }
    
    if (historyBtn) {
        historyBtn.addEventListener('click', showJournalView);
    }
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showProfileView);
    }
    
    if (editDaysBtn) {
        editDaysBtn.addEventListener('click', showProfileView);
    }
    
    // Profile save button
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', saveUserProfile);
        console.log("Profile save button listener attached.");
    }
    
    // Today's Action Items event listeners
    if (addActionBtn) {
        addActionBtn.addEventListener('click', () => {
            const text = newActionInput.value.trim();
            if (text) {
                addActionItem(text);
                newActionInput.value = '';
                newActionInput.focus();
            }
        });
        console.log("Add action button listener attached.");
    }
    
    if (newActionInput) {
        newActionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = newActionInput.value.trim();
                if (text) {
                    addActionItem(text);
                    newActionInput.value = '';
                }
            }
        });
        console.log("New action input listener attached.");
    }
    
    // Call buttons (along with existing listeners)
    if (morningCallBtn) {
        morningCallBtn.addEventListener('click', () => {
            console.log('Morning Call Button Listener EXECUTED!'); 
            startCall('morning');
        });
    }
    
    if (eveningCallBtn) {
        eveningCallBtn.addEventListener('click', () => {
            console.log('Evening Call Button Listener EXECUTED!'); 
            startCall('evening');
        });
    }
    
    if (stopCallBtn) {
        stopCallBtn.addEventListener('click', () => {
            console.log('Stop Call Button Listener EXECUTED!');
            stopCall();
            // After call ends, return to appropriate view based on call type
            if (currentCallType === 'morning') {
                showMorningView();
            } else {
                showEveningView();
            }
        });
    }
    
    // Toggle transcript visibility when clicking on entry headers
    if (journalEntriesContainer) {
        journalEntriesContainer.addEventListener('click', (event) => {
            // Check if a journal entry or its header was clicked (but not action items or buttons)
            const entryItem = event.target.closest('.journal-item');
            const isActionItem = event.target.closest('.action-item');
            const isDeleteButton = event.target.classList.contains('delete-entry-button');
            
            // Only toggle transcript if clicking on the entry (not a button or action item)
            if (entryItem && !isActionItem && !isDeleteButton) {
                const transcriptDiv = entryItem.querySelector('.journal-transcript');
                if (transcriptDiv) {
                    // Toggle display
                    const isHidden = transcriptDiv.style.display === 'none';
                    transcriptDiv.style.display = isHidden ? 'flex' : 'none';
                    
                    // Toggle active class
                    if (isHidden) {
                        entryItem.classList.add('active');
                    } else {
                        entryItem.classList.remove('active');
                    }
                }
            }
            
            // Handle delete button clicks (existing functionality)
            if (isDeleteButton) {
                // ... existing delete logic ...
            }
        });
    }
});

// --- DOM Elements for Action Items ---
const newActionInput = document.getElementById('new-action-input');
const addActionBtn = document.getElementById('add-action-btn');
const todayActionList = document.getElementById('today-action-items');

// --- Today's Action Items Functions ---
// Function to load existing action items (from local storage for now)
function loadActionItems() {
  // Check if element exists before trying to use it
  if (!todayActionList) {
    console.log('Today action list element not found, skipping loadActionItems');
    return;
  }
  
  try {
    // Clear the current list
    todayActionList.innerHTML = '';
    
    // Get saved action items from local storage
    const savedItems = JSON.parse(localStorage.getItem('todayActionItems')) || [];
    
    // Display each item
    savedItems.forEach(item => {
      addActionItemToDOM(item.text, item.completed);
    });
    
    // If we have action items from a completed morning call, add those too
    updateActionItemsFromMorningCall();
  } catch (error) {
    console.error('Error loading action items:', error);
  }
}

// Function to update action items based on morning call results
function updateActionItemsFromMorningCall() {
  // Check if we need to update from the latest morning call
  const todayDate = new Date().toLocaleDateString('en-US');
  const lastMorningCallDate = localStorage.getItem('lastMorningCallDate');
  
  // If we already processed today's call, don't add items again
  if (lastMorningCallDate === todayDate && localStorage.getItem('morningCallItemsProcessed') === 'true') {
    return;
  }
  
  // Get the most recent morning call to extract action items
  _supabase
    .from('journal_entries')
    .select('action_items, created_at')
    .eq('call_type', 'morning')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error('Error loading morning call action items:', error);
        return;
      }
      
      if (data && data.action_items && Array.isArray(data.action_items)) {
        // Get current items to avoid duplicates
        const currentItems = JSON.parse(localStorage.getItem('todayActionItems')) || [];
        const currentTexts = currentItems.map(item => item.text.toLowerCase());
        
        // Add each action item if not already in the list
        data.action_items.forEach(item => {
          if (!currentTexts.includes(item.toLowerCase())) {
            addActionItem(item);
          }
        });
        
        // Mark as processed so we don't add them again
        const callDate = new Date(data.created_at).toLocaleDateString('en-US');
        localStorage.setItem('lastMorningCallDate', callDate);
        localStorage.setItem('morningCallItemsProcessed', 'true');
      }
    });
}

// Function to add a new action item to both DOM and storage
function addActionItem(text) {
  if (!text || text.trim() === '') return;
  
  // Add to DOM
  addActionItemToDOM(text, false);
  
  // Save to local storage
  const savedItems = JSON.parse(localStorage.getItem('todayActionItems')) || [];
  savedItems.push({ text, completed: false });
  localStorage.setItem('todayActionItems', JSON.stringify(savedItems));
}

// Function to add an action item to the DOM
function addActionItemToDOM(text, completed) {
  if (!todayActionList) return;
  
  const li = document.createElement('li');
  li.classList.add('action-item-row');
  
  const checkbox = document.createElement('div');
  checkbox.classList.add('action-checkbox');
  if (completed) {
    checkbox.classList.add('checked');
  }
  
  const itemText = document.createElement('span');
  itemText.classList.add('action-text');
  itemText.textContent = text;
  if (completed) {
    itemText.classList.add('completed');
  }
  
  const deleteBtn = document.createElement('button');
  deleteBtn.classList.add('action-delete');
  deleteBtn.innerHTML = '&times;';
  
  li.appendChild(checkbox);
  li.appendChild(itemText);
  li.appendChild(deleteBtn);
  
  todayActionList.appendChild(li);
  
  // Add event listeners
  checkbox.addEventListener('click', () => {
    toggleActionItem(li, text);
  });
  
  deleteBtn.addEventListener('click', () => {
    deleteActionItem(li, text);
  });
}

// Function to toggle the completed state of an action item
function toggleActionItem(element, text) {
  const checkbox = element.querySelector('.action-checkbox');
  const itemText = element.querySelector('.action-text');
  
  const isCompleted = checkbox.classList.contains('checked');
  
  // Toggle UI
  checkbox.classList.toggle('checked');
  itemText.classList.toggle('completed');
  
  // Update in storage
  const savedItems = JSON.parse(localStorage.getItem('todayActionItems')) || [];
  const itemIndex = savedItems.findIndex(item => item.text === text);
  
  if (itemIndex !== -1) {
    savedItems[itemIndex].completed = !isCompleted;
    localStorage.setItem('todayActionItems', JSON.stringify(savedItems));
  }
}

// Function to delete an action item
function deleteActionItem(element, text) {
  // Remove from DOM
  element.remove();
  
  // Remove from storage
  const savedItems = JSON.parse(localStorage.getItem('todayActionItems')) || [];
  const updatedItems = savedItems.filter(item => item.text !== text);
  localStorage.setItem('todayActionItems', JSON.stringify(updatedItems));
}
