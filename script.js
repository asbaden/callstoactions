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

// Profile elements
const sobrietyDateInput = document.getElementById('sobriety-date');
const saveProfileButton = document.getElementById('save-profile-button');
const profileStatus = document.getElementById('profile-status');

// --- Authentication State ---
let currentUser = null;
let userProfile = null; // To store fetched profile data

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
let assistantTranscript = ""; // Variable to accumulate AI transcript

// Variables for transcript logging
let currentCallType = null; 
let currentCallTranscript = "";
let currentJournalEntryId = null;

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
    currentJournalEntryId = null;
    // --- End reset ---

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
    let dynamicInstructionsData = {}; // Object to hold dynamic data for backend

    // Pre-fetch user name from auth metadata (fallback)
    dynamicInstructionsData.userName = currentUser.user_metadata?.full_name || currentUser.email;

    // Fetch latest profile data before starting call
    // Use the locally cached userProfile if available, otherwise fetch again
    let currentProfile = userProfile;
    if (!currentProfile) {
        console.log("No cached profile, fetching before call...");
        try {
            const { data, error } = await _supabase
                .from('profiles')
                .select(`sobriety_date`)
                .eq('user_id', currentUser.id)
                .maybeSingle();
            if (error && status !== 406) throw error;
            currentProfile = data; // Update local cache
        } catch (error) {
             console.error('Error fetching profile before call:', error);
             // Proceed without profile data if fetch fails
             currentProfile = null;
        }
    }

    // Calculate days sober if date exists
    if (currentProfile?.sobriety_date) {
        try {
            const sobrietyDate = new Date(currentProfile.sobriety_date);
            const today = new Date();
            // Reset time part to compare dates only
            sobrietyDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            if (!isNaN(sobrietyDate)) {
                const diffTime = Math.abs(today - sobrietyDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                // Include day 1, so add 1 if date is not today OR if it IS today
                dynamicInstructionsData.daysSober = diffDays >= 0 ? diffDays + 1 : 0; 
                console.log(`Calculated days sober: ${dynamicInstructionsData.daysSober}`);
            }
        } catch (e) {
             console.error("Error calculating days sober:", e);
        }
    }

    // Fetch session token and pass dynamic data
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
            // Send call type and dynamic data (userName, daysSober)
            body: JSON.stringify({ 
                call_type: callType, 
                user_name: dynamicInstructionsData.userName,
                days_sober: dynamicInstructionsData.daysSober // Will be undefined if not calculated
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get OpenAI session token: ${response.status} ${errorText}`);
        }
        const sessionData = await response.json();

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

    // --- Create Initial Journal Entry ---
    try {
        console.log("Creating initial journal entry...");
        const { data: newEntry, error: insertError } = await _supabase
            .from('journal_entries')
            .insert({ 
                user_id: currentUser.id,
                call_type: currentCallType 
                // Other fields like intentions, summary, transcript will be updated later
            })
            .select('id') // Select the ID of the newly created row
            .single(); // Expect only one row back

        if (insertError) {
            throw insertError;
        }

        if (!newEntry || !newEntry.id) {
            throw new Error("Failed to get ID for new journal entry.");
        }

        currentJournalEntryId = newEntry.id;
        console.log(`Initial journal entry created with ID: ${currentJournalEntryId}`);

    } catch (error) {
         console.error('Error creating initial journal entry:', error);
         alert(`Failed to create journal entry: ${error.message}\nCall cannot proceed.`);
         callStatus.textContent = 'Journal entry error.';
         if (stopCallBtn) stopCallBtn.style.display = 'none';
         // Reset critical state if entry creation fails
         currentCallType = null;
         return; 
    }
    // --- End Create Initial Journal Entry ---
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
        console.log(`Track details - Kind: ${event.track.kind}, ID: ${event.track.id}, Enabled: ${event.track.enabled}, Muted: ${event.track.muted}, ReadyState: ${event.track.readyState}`);
        
        // Attempt to ensure the track is enabled (might not be necessary, but good practice)
        event.track.enabled = true;
        
        if (event.streams && event.streams[0]) {
            if (!remoteAudioElement) {
                // Create an audio element if it doesn't exist
                remoteAudioElement = document.createElement('audio');
                remoteAudioElement.autoplay = true;
                // remoteAudioElement.controls = true; // Remove controls
                // document.body.appendChild(remoteAudioElement); // Don't append to body
                console.log('Created <audio> element for remote stream.');
            }
            remoteAudioElement.srcObject = event.streams[0];
            console.log('Attached remote stream to audio element.');
            
            // --- Attempt to unmute and play --- 
            remoteAudioElement.muted = false; 
            // Try playing explicitly after a short delay, sometimes needed
            setTimeout(() => {
                remoteAudioElement.play().then(() => {
                    console.log('Remote audio element playback initiated.');
                }).catch(error => {
                    console.error('Error trying to play remote audio element:', error);
                    // Autoplay might be blocked, user might need to click the element's play button
                });
            }, 100);
            // --- End unmute/play attempt ---
            
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

            // Process messages similarly to WebSocket approach
            switch (message.type) {
                 case 'session.created': // Might not be sent over data channel, connection state implies readiness
                     console.log('OpenAI session confirmed via Data Channel (or inferred):', message);
                     // Check if session data provides useful info
                     break;
                 case 'response.text.delta':
                     callStatus.textContent = `Assistant: ${message.delta}`; // Simple update
                     console.log('Text delta:', message.delta); 
                     break;
                 // Audio is handled by ontrack, not data channel messages
                 // case 'response.audio.delta': break; 
                 case 'transcription.text.delta':
                     console.log('User transcription delta:', message.delta);
                     // Accumulate deltas in a temporary variable or directly update UI if needed
                     // For now, we'll wait for the completed message.
                     break;
                 case 'session.warning':
                     console.warn('OpenAI session warning:', message.message);
                     break;
                 case 'session.error':
                     console.error('OpenAI session error:', message.code, message.message);
                     // Log the detailed error object if present
                     if(message.error) {
                         console.error('Detailed error object from session.error:', message.error);
                     }
                     callStatus.textContent = `OpenAI Error: ${message.message}`;
                     stopCall();
                     break;
                 case 'session.terminated':
                     console.log('OpenAI session terminated by server:', message);
                     callStatus.textContent = 'Call ended by server.';
                     stopCall();
                     break;
                 // --- Add cases for observed unhandled messages ---
                 case 'response.audio_transcript.delta':
                      // Accumulate the AI transcript delta
                      assistantTranscript += message.delta;
                      // Also add to the full transcript log
                      currentCallTranscript += message.delta; 
                      // Update UI with the accumulated transcript - REMOVED as requested
                      // callStatus.textContent = `Assistant: ${assistantTranscript}`;
                      break;
                 case 'rate_limits.updated':
                 case 'response.output_item.added':
                 case 'response.content_part.added':
                 case 'output_audio_buffer.started':
                 case 'output_audio_buffer.cleared':
                 case 'response.audio.done':
                 case 'response.audio_transcript.done':
                 case 'response.content_part.done':
                 case 'response.output_item.done':
                 case 'conversation.item.truncated':
                 case 'input_audio_buffer.speech_started':
                 case 'input_audio_buffer.speech_stopped':
                 case 'input_audio_buffer.committed':
                 case 'conversation.item.created':
                 case 'response.created':
                     // Clear the transcript accumulator when a new response starts
                     assistantTranscript = ""; 
                     console.log('Cleared assistant transcript accumulator.');
                 case 'response.done':
                      // Log the full response object when done
                      if (message.type === 'response.done' && message.response) {
                          console.log("Full response object on 'response.done':", message.response);
                          // Log the specific reason for failure if status is 'failed'
                          if (message.response.status === 'failed' && message.response.status_details) {
                              console.error("Response generation failed. Details:", message.response.status_details);
                          }
                      }
                 case 'conversation.item.input_audio_transcription.delta':
                      // Log delta, but update UI on completion
                      console.log(`Received Data Channel Event: ${message.type}`, message);
                      break;
                 case 'conversation.item.input_audio_transcription.completed':
                      // Just log these types for now to understand the flow
                      console.log(`Received Data Channel Event: ${message.type}`, message);
                      // Append completed user transcript to log
                      if (message.transcript) {
                         const userLine = `User: ${message.transcript.trim()}\n`;
                         currentCallTranscript += userLine;
                         // Display the final transcript (currently in callStatus)
                         callStatus.textContent = userLine; // Overwrite status with latest user line
                      }
                      break;
                 default:
                     // Check if it's the generic error type
                     if (message.type === 'error' && message.error) {
                          console.error('Received generic OpenAI error message:', message.error);
                          callStatus.textContent = `OpenAI Error: ${message.error.message || 'Unknown error'}`;
                          stopCall(); // Stop on generic errors too
                          break;
                     }
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

    // Attempt to save transcript after cleanup
    await saveTranscriptToJournal(); 
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

    // Add listener for the profile save button
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', saveUserProfile);
        console.log("Profile save button listener attached.");
    } else {
         console.error('Save profile button not found!');
    }
});

// --- NEW: Function to load user profile ---
async function loadUserProfile() {
    if (!currentUser) return;

    console.log("Loading user profile...");
    profileStatus.textContent = 'Loading profile...';
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
                profileStatus.textContent = 'Profile loaded.';
            } else {
                 profileStatus.textContent = 'Set your recovery start date.';
            }
        } else {
            console.log("No profile found for user.");
            userProfile = null;
             profileStatus.textContent = 'Set your recovery start date.';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        profileStatus.textContent = 'Error loading profile.';
        userProfile = null;
    }
}

// --- NEW: Function to save user profile ---
async function saveUserProfile() {
    if (!currentUser || !sobrietyDateInput) return;

    const sobrietyDate = sobrietyDateInput.value;
    // Basic validation: Check if it's a valid date string
    if (!sobrietyDate || isNaN(new Date(sobrietyDate))) {
        profileStatus.textContent = 'Please enter a valid date.';
        return;
    }

    console.log(`Saving sobriety date: ${sobrietyDate} for user: ${currentUser.id}`);
    profileStatus.textContent = 'Saving...';

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
        profileStatus.textContent = 'Date saved successfully!';
        // Optionally reload profile data immediately
        await loadUserProfile(); 

    } catch (error) {
        console.error('Error saving user profile:', error);
        profileStatus.textContent = 'Error saving date.';
    }
}

async function saveTranscriptToJournal() {
    if (!currentJournalEntryId || !currentCallTranscript) {
        console.log("No journal entry ID or transcript content to save.");
        return;
    }

    console.log(`Saving transcript to journal entry ID: ${currentJournalEntryId}`);
    try {
        const { error } = await _supabase
            .from('journal_entries')
            .update({ 
                full_transcript: currentCallTranscript.trim(),
                // Optionally set an ended_at timestamp here if you add the column
                // ended_at: new Date()
             }) 
            .eq('id', currentJournalEntryId)
            .eq('user_id', currentUser.id); // Ensure user can only update their own

        if (error) {
            throw error;
        }
        console.log("Transcript saved successfully to journal entry.");
        // Refresh journal entries displayed on the page
        loadJournalEntries();

    } catch(error) {
        console.error("Error saving transcript to journal:", error);
        // Inform user? Maybe just log for now.
    }
    // Reset after attempt
    currentJournalEntryId = null;
    currentCallTranscript = "";
}
