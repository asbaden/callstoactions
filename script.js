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
// let websocket = null; // Re-initialize inside startCall
// let mediaRecorder = null;
// let audioChunks = [];
// const WS_URL = '...'; // No longer needed here

async function startCall(callType) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }
    // Close previous connection if any
    if (window.openaiWebsocket && window.openaiWebsocket.readyState === WebSocket.OPEN) {
        window.openaiWebsocket.close();
    }
    window.openaiWebsocket = null;
    if (window.mediaRecorder && window.mediaRecorder.state === 'recording') {
        window.mediaRecorder.stop();
    }
    window.mediaRecorder = null;

    console.log(`Starting ${callType} call (Realtime API)...`);
    callStatus.textContent = `Initializing ${callType} call...`;

    // 1. Get Supabase Auth Token (might be needed for backend auth)
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    if (sessionError || !session) {
        console.error('Error getting session or no active session:', sessionError);
        alert('Could not get authentication token. Please log in again.');
        callStatus.textContent = 'Auth error.';
        return;
    }
    const supabaseAccessToken = session.access_token;
    console.log('Got Supabase Access Token.');

    // 2. Get Ephemeral OpenAI Session Token from our Backend
    let ephemeralToken;
    try {
        console.log('Requesting ephemeral token from backend...');
        // Ensure BACKEND_API_URL is defined from config.js
        if (typeof BACKEND_API_URL === 'undefined') {
            throw new Error('BACKEND_API_URL is not defined in config.js');
        }
        const apiUrl = `${BACKEND_API_URL}/api/create-realtime-session`; 
        console.log(`Fetching from: ${apiUrl}`);

        const response = await fetch(apiUrl, { // Use the full backend URL
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Include Supabase token if backend verifies it
                // 'Authorization': `Bearer ${supabaseAccessToken}` 
            },
            // body: JSON.stringify({}) // No body needed unless sending user ID etc.
        });

        const data = await response.json();

        if (!response.ok || !data.client_secret) {
            console.error('Error fetching ephemeral token:', response.status, data);
            alert(`Error initializing call: ${data.error || 'Failed to get session token'}`);
            callStatus.textContent = 'Init error.';
            return;
        }
        ephemeralToken = data.client_secret;
        console.log('Received ephemeral OpenAI token.');

    } catch (error) {
        console.error('Exception fetching ephemeral token:', error);
        alert('Error contacting server to initialize call.');
        callStatus.textContent = 'Server error.';
        return;
    }

    // 3. Request Microphone Access
    let stream;
    try {
        // Note: If backend expects pcm16 @ 24kHz, getUserMedia might not guarantee that.
        // Browser usually provides opus/webm. Backend's `input_audio_format` 
        // might need to match what browser provides, or transcoding needed.
        // For now, stick with default audio constraints.
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');
    } catch (err) {
        console.error('Error getting microphone access:', err);
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        callStatus.textContent = 'Mic access denied.';
        return;
    }

    // 4. Establish WebSocket Connection to OpenAI Realtime API
    const openaiWsUrl = 'wss://api.openai.com/v1/realtime'; // Base URL
    const connectionUrl = `${openaiWsUrl}?token=${ephemeralToken}`; // <-- Try adding token as query param
    console.log(`Connecting to OpenAI WebSocket: ${connectionUrl}`);
    callStatus.textContent = 'Connecting to OpenAI...';

    // Use the ephemeral token for Authorization
    // Remove the invalid subprotocol attempt
    window.openaiWebsocket = new WebSocket(connectionUrl);
    
    // If the above fails, maybe the token goes in the URL? (Less secure)
    // window.openaiWebsocket = new WebSocket(`${openaiWsUrl}?token=${ephemeralToken}`);


    // 5. OpenAI WebSocket Event Handlers (New Implementation Needed)
    window.openaiWebsocket.onopen = () => {
        console.log('OpenAI WebSocket connection established.');
        callStatus.textContent = 'Connected to AI. Speak now...';
        // Start recording and sending audio (Needs modification for Base64 & JSON format)
        setupMediaRecorder(stream); 
        mediaRecorder.start(1000); 
        console.log('MediaRecorder started (Realtime API).');
        // Send session update if needed? Configuration might be done via REST.
    };

    window.openaiWebsocket.onmessage = (event) => {
        // Handle REALTIME API specific messages (JSON)
        try {
            const message = JSON.parse(event.data);
            console.log('Received OpenAI message:', message.type, message);
            
            switch(message.type) {
                case 'session.created':
                    // Handle session confirmation
                    console.log('OpenAI session created:', message.session);
                    break;
                case 'conversation.item.input_audio_transcription.completed':
                    // Display transcription for debugging/info
                    console.log('Transcription received:', message.transcript);
                    // Don't necessarily display this to user, it's just Whisper's view
                    // callStatus.textContent = `You said: ${message.transcript}`; // Example display
                    break;
                 case 'response.text.delta':
                    // Append text deltas to UI (for text responses)
                    // TODO: Add a specific UI element for text responses
                    console.log('Text delta:', message.delta);
                     callStatus.textContent += message.delta;
                    break;
                 case 'response.audio.delta':
                    // Decode Base64 audio chunk and queue for playback
                    if (message.delta) {
                        playAudio(message.delta); // Pass Base64 chunk to playback function
                    }
                    break;
                 case 'response.done':
                    console.log('AI Response finished.');
                    callStatus.textContent = 'AI finished speaking.'; // Reset status
                    // Potentially re-enable mic or wait for user input
                    break;
                 case 'error':
                    console.error('OpenAI Realtime API Error:', message.error);
                    callStatus.textContent = `Error: ${message.error?.message || 'Unknown error'}`;
                    break;
                 // Handle other events like session.updated, conversation items, etc.
                 default:
                    console.log('Unhandled message type:', message.type);
            }
        } catch (e) {
            console.error('Failed to parse incoming message or handle event:', event.data, e);
        }
    };

    window.openaiWebsocket.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        callStatus.textContent = 'AI connection error.';
        // Clean up
    };

    window.openaiWebsocket.onclose = (event) => {
        console.log('OpenAI WebSocket connection closed:', event.code, event.reason);
        callStatus.textContent = 'Call disconnected from AI.';
        if (window.mediaRecorder && window.mediaRecorder.state === 'recording') {
            window.mediaRecorder.stop();
        }
        // Clean up stream tracks
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        window.openaiWebsocket = null;
        window.mediaRecorder = null;
    };
}

// --- Modify setupMediaRecorder and add Base64 conversion ---
// ... (loadJournalEntries remains the same) ...

// --- Implement Audio Playback --- 
let audioContext;
let audioQueue = [];
let isPlaying = false;

function playAudio(base64AudioChunk) {
    try {
        // Decode Base64 string to ArrayBuffer
        const byteString = atob(base64AudioChunk);
        const len = byteString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = byteString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        // Queue the ArrayBuffer
        audioQueue.push(arrayBuffer);
        // Start playback if not already playing
        if (!isPlaying) {
            playNextChunk();
        }
    } catch (e) {
        console.error("Error decoding or queueing audio chunk:", e);
    }
}

async function playNextChunk() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return; // No more chunks to play
    }
    isPlaying = true;

    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            alert("Audio playback not supported in this browser.");
            isPlaying = false;
            audioQueue = []; // Clear queue if context fails
            return;
        }
    }
    // Resume context if needed (e.g., after user interaction)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const arrayBuffer = audioQueue.shift(); // Get the next chunk

    try {
        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = playNextChunk; // Play the next chunk when this one finishes
        source.start(0); // Play immediately
    } catch (e) {
        console.error("Error decoding or playing audio data:", e);
        // Skip this chunk and try the next one
        playNextChunk(); 
    }
}

// function stopCall() { ... } // Keep placeholder

// --- ATTACH CALL BUTTON LISTENERS ... (rest of file remains the same) ...

// Placeholder functions for MediaRecorder/Audio (keep them defined here)
function setupMediaRecorder(stream) {
    // ... (Try preferred mimeType, fallback) ...
    const options = { mimeType: 'audio/webm;codecs=opus' }; 
     try {
         window.mediaRecorder = new MediaRecorder(stream, options);
     } catch (e) {
         console.warn('Preferred mimeType failed, trying default:', e);
         window.mediaRecorder = new MediaRecorder(stream);
     }
     console.log('Using mimeType:', window.mediaRecorder.mimeType);

    window.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && window.openaiWebsocket && window.openaiWebsocket.readyState === WebSocket.OPEN) {
            // --- Convert Blob to Base64 --- 
            const reader = new FileReader();
            reader.onloadend = () => {
                // Result contains data:audio/webm;base64,...... 
                // Extract base64 part
                const base64Audio = reader.result.split(',')[1];
                if (base64Audio) {
                    // Send JSON message with base64 audio
                    const message = {
                        type: "input_audio_buffer.append",
                        audio: base64Audio
                        // event_id: `evt_${Date.now()}` // Optional event ID
                    };
                    // console.log('Sending audio buffer append message...'); // Verbose
                    window.openaiWebsocket.send(JSON.stringify(message));
                } else {
                    console.error('Failed to extract Base64 data from audio blob.');
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
            };
            reader.readAsDataURL(event.data);
        } else {
            // console.log('Audio chunk not sent (size 0 or WebSocket closed).');
        }
    };
    // ... (onstop, onerror remain similar) ...
     window.mediaRecorder.onstop = () => {
         console.log('Recording stopped.');
         // Send commit message if VAD is off? Check Realtime API docs if needed.
         // if (window.openaiWebsocket && window.openaiWebsocket.readyState === WebSocket.OPEN) {
         //     window.openaiWebsocket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
         // }
     };
     window.mediaRecorder.onerror = (event) => {
         console.error('MediaRecorder error:', event.error);
     };
}

// --- ATTACH CALL BUTTON LISTENERS (AFTER FUNCTIONS ARE DEFINED) ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure DOM is fully loaded before attaching listeners to buttons
    const morningCallBtn = document.getElementById('morning-call-button');
    const eveningCallBtn = document.getElementById('evening-call-button');

    if (morningCallBtn) {
        morningCallBtn.addEventListener('click', () => {
            console.log('Morning Call Button Clicked!');
            startCall('morning');
        });
    } else {
        console.error('Morning call button not found!');
    }

    if (eveningCallBtn) {
        eveningCallBtn.addEventListener('click', () => {
            console.log('Evening Call Button Clicked!');
            startCall('evening');
        });
    } else {
        console.error('Evening call button not found!');
    }
});
