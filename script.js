// Ensure config.js is loaded first and contains SUPABASE_URL and SUPABASE_ANON_KEY

// Initialize Supabase client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

// --- Authentication State ---
let currentUser = null;

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
    } else {
        // User is logged out
        loginButton.style.display = 'block';
        logoutButton.style.display = 'none';
        callControls.style.display = 'none';
        journalSection.style.display = 'none';
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
            .select('*') // Select all columns
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
            entryElement.classList.add('journal-entry'); // For potential styling

            // Format date nicely
            const date = new Date(entry.created_at).toLocaleString();

            let contentHTML = `<strong>${date} - ${entry.call_type.toUpperCase()}</strong><br>`;
            if (entry.intention) contentHTML += `<em>Intention:</em> ${entry.intention}<br>`;
            if (entry.action_plan) contentHTML += `<em>Action Plan:</em> ${entry.action_plan}<br>`;
            if (entry.content) contentHTML += `<em>Reflection:</em> ${entry.content}<br>`;
            if (entry.gratitude) contentHTML += `<em>Gratitude:</em> ${entry.gratitude}<br>`;
            
            entryElement.innerHTML = contentHTML + '<hr>'; // Add a separator
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
let remoteAudioElement = null; // To play back audio from OpenAI

// Placeholder for the backend endpoint that provides OpenAI session tokens
const OPENAI_SESSION_ENDPOINT = '/api/openai-session';
// Base URL for WebRTC SDP exchange
const OPENAI_WEBRTC_URL = 'https://api.openai.com/v1/realtime'; 
// Specify the model (can be dynamic later)
const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview'; 


async function startCall(callType) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }
    // Check if a call is already in progress via peerConnection state
    if (peerConnection && peerConnection.connectionState !== 'closed' && peerConnection.connectionState !== 'failed') {
        console.log('WebRTC call already in progress. State:', peerConnection.connectionState);
        alert('A call is already in progress.');
        return;
    }
    
    // Clean up previous connection if necessary
    await stopCall(); 

    // Reset state variables
    userStream = null;
    openaiSessionId = null;
    peerConnection = null;
    dataChannel = null;
    
    if (stopCallBtn) {
        stopCallBtn.style.display = 'inline-block';
    }

    console.log(`Starting ${callType} call (WebRTC)...`);
    callStatus.textContent = `Initializing ${callType} call...`;

    // 1. Get Supabase Auth Token (JWT)
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    if (sessionError || !session) {
        console.error('Error getting session or no active session:', sessionError);
        alert('Could not get authentication token. Please log in again.');
        callStatus.textContent = 'Auth error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return;
    }
    const accessToken = session.access_token;
    console.log('Got Supabase Access Token.');

    // 2. Fetch OpenAI Session Token (Ephemeral Key)
    let sessionData;
    let ephemeralKey;
    try {
        const sessionEndpointUrl = `${BACKEND_API_URL}/api/openai-session`;
        console.log(`Fetching OpenAI session token from ${sessionEndpointUrl}...`);
        callStatus.textContent = 'Requesting session token...';
        const response = await fetch(sessionEndpointUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ call_type: callType })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get OpenAI session token: ${response.status} ${errorText}`);
        }
        sessionData = await response.json();

        if (!sessionData.client_secret || !sessionData.client_secret.value || !sessionData.id) {
            throw new Error('Invalid session data received from backend.');
        }

        openaiSessionId = sessionData.id;
        ephemeralKey = sessionData.client_secret.value;
        console.log('Received OpenAI Session ID:', openaiSessionId);
        console.log('Received Ephemeral Key (Client Secret)');

    } catch (error) {
        console.error('Error fetching OpenAI session token:', error);
        alert(`Failed to start call: ${error.message}`);
        callStatus.textContent = 'Session token error.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return;
    }

    // 3. Request Microphone Access
    try {
        userStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                 // Try preferred settings, browser may adjust
                sampleRate: 24000, 
                channelCount: 1,
                echoCancellation: true, // Recommended for voice comms
                noiseSuppression: true // Recommended for voice comms
            } 
        });
        console.log('Microphone access granted.');
        // Log actual settings
        const audioTracks = userStream.getAudioTracks();
        if (audioTracks.length > 0) {
             console.log('Actual microphone settings:', audioTracks[0].getSettings());
        }
    } catch (err) {
        console.error('Error getting microphone access:', err);
        alert('Microphone access denied.');
        callStatus.textContent = 'Mic access denied.';
        if (stopCallBtn) stopCallBtn.style.display = 'none';
        return;
    }

    // 4. Initiate WebRTC Connection
    try {
        await connectOpenAIWebRTC(ephemeralKey, callType);
    } catch (error) {
         console.error('Error initiating WebRTC connection:', error);
         alert(`Failed to connect via WebRTC: ${error.message}`);
         callStatus.textContent = 'WebRTC Connection Error.';
         await stopCall(); // Ensure cleanup on failure
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
        console.log('Remote track received:', event.track, event.streams);
        if (event.streams && event.streams[0]) {
            if (!remoteAudioElement) {
                // Create an audio element if it doesn't exist
                remoteAudioElement = document.createElement('audio');
                remoteAudioElement.autoplay = true;
                // Optional: Append to body for debugging controls
                // document.body.appendChild(remoteAudioElement);
                console.log('Created <audio> element for remote stream.');
            }
            remoteAudioElement.srcObject = event.streams[0];
            console.log('Attached remote stream to audio element.');
        } else {
             console.warn("Received track event without stream data.");
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
        callStatus.textContent = `${callType} call ready. Speak now...`;
         // We can potentially send configuration messages here if needed by OpenAI via DataChannel
         // Example: sendDataChannelMessage({ type: 'session.config', ... });
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

            // Process messages similarly to WebSocket approach
            switch (message.type) {
                 case 'session.created': // Might not be sent over data channel, connection state implies readiness
                     console.log('OpenAI session confirmed via Data Channel (or inferred):', message);
                     break;
                 case 'response.text.delta':
                     callStatus.textContent = `Assistant: ${message.delta}`; // Simple update
                     console.log('Text delta:', message.delta); 
                     break;
                 // Audio is handled by ontrack, not data channel messages
                 // case 'response.audio.delta': break; 
                 case 'transcription.text.delta':
                     console.log('User transcription delta:', message.delta);
                     break;
                 case 'session.warning':
                     console.warn('OpenAI session warning:', message.message);
                     break;
                 case 'session.error':
                     console.error('OpenAI session error:', message.code, message.message);
                     callStatus.textContent = `OpenAI Error: ${message.message}`;
                     stopCall();
                     break;
                 case 'session.terminated':
                     console.log('OpenAI session terminated:', message);
                     callStatus.textContent = 'Call ended by server.';
                     stopCall();
                     break;
                 default:
                     console.log('Unhandled message type from Data Channel:', message.type, message);
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

// --- Remove old WebSocket functions ---
// function connectOpenAIWebSocket(...) { ... }
// function base64ToArrayBuffer(...) { ... }
// function playAudio(...) { ... }
// function playNextChunk() { ... }

// --- Update Stop Call function for WebRTC ---
async function stopCall() { // Make async if needed for future cleanup steps
    console.log("stopCall() initiated");

    if (peerConnection) {
        console.log("Closing RTCPeerConnection.");
        peerConnection.close();
        peerConnection = null;
    }
    if (dataChannel) {
        // Closing peerConnection usually closes dataChannel, but explicit check is ok
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

    // Reset variables (some already nulled above)
    openaiSessionId = null;

    // Hide stop call button
    if (stopCallBtn) {
        stopCallBtn.style.display = 'none';
    }
    
    // Set status only if not already set by connection state change
    if (callStatus.textContent !== 'WebRTC Call Ended.' && callStatus.textContent !== 'WebRTC Disconnected.') {
         callStatus.textContent = 'Call ended.';
    }
     console.log("stopCall cleanup finished.");
}

// Separate cleanup logic to be called by stopCall or onclose (REMOVED as stopCall handles it now)
// function stopCallCleanup() { ... }


// --- Remove MediaRecorder setup and related logic ---
// function setupMediaRecorder(stream) { ... }
// The mediaRecorder.ondataavailable logic is also removed implicitly

// --- ATTACH CALL BUTTON LISTENERS (AFTER FUNCTIONS ARE DEFINED) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded. Attaching call button listeners...'); // Log DOM loaded
    
    const morningCallBtn = document.getElementById('morning-call-button');
    const eveningCallBtn = document.getElementById('evening-call-button');
    stopCallBtn = document.getElementById('stop-call-button');

    // Log found elements
    console.log('Morning call button element:', morningCallBtn);
    console.log('Evening call button element:', eveningCallBtn);
    console.log('Stop call button element:', stopCallBtn);

    if (morningCallBtn) {
        morningCallBtn.addEventListener('click', () => {
            // Log inside the listener callback itself
            console.log('Morning Call Button Listener EXECUTED!'); 
            startCall('morning');
        });
        console.log('Morning call listener attached.');
    } else {
        console.error('Morning call button not found! Cannot attach listener.');
    }

    if (eveningCallBtn) {
        eveningCallBtn.addEventListener('click', () => {
            // Log inside the listener callback itself
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
});
