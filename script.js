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
let websocket = null;
let mediaRecorder = null;
let audioContext = null;
let audioQueue = []; // Queue for incoming audio chunks (ArrayBuffers)
let isPlaying = false;
let stopCallBtn = null; // Reference to stop call button
let userStream = null; // Store the user's media stream
let openaiSessionId = null; // Store the OpenAI session ID
let outputAudioFormat = 'pcm16'; // Default or fetched from session response

// Placeholder for the backend endpoint that provides OpenAI session tokens
const OPENAI_SESSION_ENDPOINT = '/api/openai-session';

async function startCall(callType) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        alert('A call is already in progress.');
        return;
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    if (userStream) {
        userStream.getTracks().forEach(track => track.stop());
    }
    websocket = null;
    mediaRecorder = null;
    userStream = null;
    openaiSessionId = null;

    audioQueue = [];
    isPlaying = false;

    if (stopCallBtn) {
        stopCallBtn.style.display = 'inline-block';
    }

    if (!audioContext) {
        try {
             audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000 // Match OpenAI's expected output rate for PCM
             });
             console.log('AudioContext created with 24kHz sample rate.');
        } catch (e) {
             console.error("Failed to create AudioContext, trying without specific sample rate:", e);
             audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
       
    } else if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    console.log(`Starting ${callType} call (OpenAI Realtime API)...`);
    callStatus.textContent = `Initializing ${callType} call...`;

    // 1. Get Supabase Auth Token (JWT) - Still needed for backend authentication
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

    // 2. Fetch OpenAI Session Token from *our* backend
    let sessionData;
    try {
        console.log(`Fetching OpenAI session token from ${OPENAI_SESSION_ENDPOINT}...`);
        callStatus.textContent = 'Requesting session token...';
        const response = await fetch(OPENAI_SESSION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            // Send call type or other relevant info if needed by backend
            body: JSON.stringify({ call_type: callType }) 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get OpenAI session token: ${response.status} ${errorText}`);
        }
        sessionData = await response.json();
        
        if (!sessionData.client_secret || !sessionData.id) {
             throw new Error('Invalid session data received from backend.');
        }
        
        openaiSessionId = sessionData.id;
        outputAudioFormat = sessionData.output_audio_format || 'pcm16'; // Store actual format
        console.log('Received OpenAI Session ID:', openaiSessionId);
        console.log('Using output audio format:', outputAudioFormat);

    } catch (error) {
        console.error('Error fetching OpenAI session token:', error);
        alert(`Failed to start call: ${error.message}`);
        callStatus.textContent = 'Session token error.';
         if (stopCallBtn) stopCallBtn.style.display = 'none';
        return;
    }

    // 3. Request Microphone Access
    try {
        // Request 24kHz if possible, but browser might ignore it
        userStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                sampleRate: 24000, // Ideal for OpenAI
                channelCount: 1    // Mono
            } 
        });
        console.log('Microphone access granted.');
         // Check actual sample rate
         const audioTracks = userStream.getAudioTracks();
         if (audioTracks.length > 0) {
             const settings = audioTracks[0].getSettings();
             console.log('Actual microphone settings:', settings);
             if(settings.sampleRate !== 24000) {
                 console.warn(`Microphone using sample rate ${settings.sampleRate}, not 24000. Resampling may be needed (Not implemented).`);
                 // TODO: Implement resampling using Web Audio API if needed
             }
         }
    } catch (err) {
        console.error('Error getting microphone access:', err);
        alert('Microphone access denied.');
        callStatus.textContent = 'Mic access denied.';
         if (stopCallBtn) stopCallBtn.style.display = 'none';
        return;
    }

    // 4. Establish WebSocket Connection to OpenAI
    connectOpenAIWebSocket(sessionData.id, sessionData.client_secret.value, callType);
}

// --- Function to connect to OpenAI WebSocket ---
function connectOpenAIWebSocket(sessionId, clientSecret, callType) {
    const openaiWsUrl = `wss://api.openai.com/v1/realtime/sessions/${sessionId}/connect?client_secret=${clientSecret}`;
    console.log(`Connecting to OpenAI WebSocket: ${openaiWsUrl}`);
    callStatus.textContent = 'Connecting to OpenAI...';
    
    websocket = new WebSocket(openaiWsUrl);

    websocket.onopen = () => {
        console.log('OpenAI WebSocket connection established.');
        callStatus.textContent = `${callType} call connected. Speak now...`;
        
        // Configure and start MediaRecorder *after* WebSocket is open
        setupMediaRecorder(userStream); 
        if (mediaRecorder) {
             // Start sending audio chunks frequently
             mediaRecorder.start(250); // Send data every 250ms 
             console.log('MediaRecorder started, sending data.');
        } else {
             console.error("MediaRecorder setup failed, cannot send audio.");
             callStatus.textContent = 'Error: Cannot record audio.';
             stopCall(); // Abort the call
        }
    };

    websocket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            // console.debug('Message received from OpenAI:', message); // Use debug level

            switch (message.type) {
                case 'session.created':
                    console.log('OpenAI session created:', message);
                    // Can verify settings here if needed
                    break;
                case 'response.text.delta':
                    // Append text delta to UI element (create one if needed)
                    callStatus.textContent = `Assistant: ${message.delta}`; // Simple update for now
                    console.log('Text delta:', message.delta); 
                    break;
                 case 'response.audio.delta':
                    // Decode Base64 audio chunk and queue for playback
                    const audioChunk = base64ToArrayBuffer(message.delta);
                    // console.debug("Queueing audio chunk, size:", audioChunk.byteLength);
                    audioQueue.push(audioChunk);
                    if (!isPlaying) {
                        playNextChunk();
                    }
                    break;
                case 'transcription.text.delta':
                     // Update UI with user transcription (optional)
                     console.log('User transcription delta:', message.delta);
                     // Example: document.getElementById('user-transcript').textContent += message.delta;
                     break;
                case 'session.warning':
                     console.warn('OpenAI session warning:', message.message);
                     break;
                case 'session.error':
                    console.error('OpenAI session error:', message.code, message.message);
                    callStatus.textContent = `OpenAI Error: ${message.message}`;
                    stopCall(); // End call on critical error
                    break;
                case 'session.terminated':
                     console.log('OpenAI session terminated:', message);
                     callStatus.textContent = 'Call ended by server.';
                     stopCall(); // Clean up client-side too
                     break;
                default:
                    console.log('Unhandled message type from OpenAI:', message.type, message);
            }
        } catch (e) {
            console.error('Failed to parse incoming OpenAI message or handle event:', event.data, e);
        }
    };

    websocket.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        callStatus.textContent = 'Connection error.';
        stopCall();
    };

    websocket.onclose = (event) => {
        console.log('OpenAI WebSocket connection closed:', event.code, event.reason);
        // Avoid setting status if stopCall already did
        if (callStatus.textContent !== 'Call ended.') {
             callStatus.textContent = 'Call disconnected.';
        }
        // Ensure cleanup happens even if close wasn't initiated by stopCall()
        stopCallCleanup(); 
    };
}

// Helper function to convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
    try {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (e) {
        console.error("Error decoding base64 string:", e, "String:", base64.substring(0, 50) + "...");
        return new ArrayBuffer(0); // Return empty buffer on error
    }
}

// --- Audio playback function for Realtime API (handles PCM) ---
function playAudio(base64Audio) {
    // This function is now less direct, playback happens via playNextChunk
    const audioChunk = base64ToArrayBuffer(base64Audio);
    audioQueue.push(audioChunk);
    if (!isPlaying) {
        playNextChunk();
    }
}

function playNextChunk() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const pcmData = audioQueue.shift(); // Get ArrayBuffer (raw PCM data)

    if (pcmData.byteLength === 0) {
        console.warn("Skipping empty audio chunk");
        playNextChunk();
        return;
    }

    // Assume PCM16 data (2 bytes per sample)
    const samples = pcmData.byteLength / 2; 
    // Create an AudioBuffer: 1 channel (mono), correct number of samples, 24kHz rate
    try {
        const audioBuffer = audioContext.createBuffer(1, samples, audioContext.sampleRate); 
        
        // Get the channel data buffer (Float32)
        const outputBuffer = audioBuffer.getChannelData(0);
        
        // Manually convert PCM16 (Int16) to Float32 range [-1.0, 1.0]
        const pcm16View = new Int16Array(pcmData);
        for (let i = 0; i < samples; i++) {
            outputBuffer[i] = pcm16View[i] / 32768.0; // Convert Int16 to Float32
        }

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = playNextChunk; // Play next chunk when this one finishes
        source.start();
        // console.debug(`Playing audio chunk: ${samples} samples`);

    } catch (err) {
         console.error('Error creating or playing audio buffer:', err, `Chunk Size: ${pcmData.byteLength}, Samples: ${samples}, Sample Rate: ${audioContext.sampleRate}`);
         playNextChunk(); // Skip failed chunk
    }
}


// --- Stop call function ---
function stopCall() {
    console.log("stopCall() initiated");
    // Send termination message if connected
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log("Closing WebSocket connection.");
        // OpenAI doesn't have a specific client "close" message, just close the socket.
        websocket.close(1000, "Client stopping call"); 
    } else {
         console.log("WebSocket not open or already closed.");
    }
    // Perform cleanup immediately
    stopCallCleanup();
}

// Separate cleanup logic to be called by stopCall or onclose
function stopCallCleanup() {
     console.log("Running stopCallCleanup...");
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        console.log("Stopping MediaRecorder.");
        mediaRecorder.stop();
    }
     if (userStream) {
        console.log("Stopping media stream tracks.");
        userStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear audio playback queue and state
    audioQueue = [];
    isPlaying = false;
    
     // Maybe stop the audio context source if one is active? Often handled by onended.

    // Reset variables
    websocket = null;
    mediaRecorder = null;
    userStream = null;
    openaiSessionId = null;

    // Hide stop call button
    if (stopCallBtn) {
        stopCallBtn.style.display = 'none';
    }
    
    // Set status only if not already set by server termination/error
    if (callStatus.textContent !== 'Call ended by server.' && !callStatus.textContent.startsWith('OpenAI Error:')) {
         callStatus.textContent = 'Call ended.';
    }
     console.log("stopCallCleanup finished.");
}


// --- Updated MediaRecorder setup --- 
function setupMediaRecorder(stream) {
    let options = {};
    const preferredType = 'audio/pcm'; // OpenAI wants PCM16
    const fallbackType = 'audio/webm;codecs=opus'; // Common fallback

    // OpenAI Realtime expects PCM 16-bit, 24kHz, mono, little-endian.
    // MediaRecorder might not directly support this reliably across browsers.
    // 'audio/pcm' or 'audio/wav' *might* work but are often unstandardized.
    // Using WebM/Opus might require server-side transcoding OR using a different API if direct PCM isn't feasible client-side.
    // We'll TRY PCM/WAV first, but Web Audio API is the robust solution for raw PCM capture.

    if (MediaRecorder.isTypeSupported(preferredType)) {
        options = { mimeType: preferredType };
         console.log(`Attempting to use preferred mimeType: ${preferredType}`);
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
         options = { mimeType: 'audio/wav' }; // WAV might contain PCM
         console.log(`Attempting to use fallback mimeType: audio/wav`);
    } else if (MediaRecorder.isTypeSupported(fallbackType)) {
        options = { mimeType: fallbackType };
        console.warn(`Using fallback mimeType: ${fallbackType}. This will likely NOT work with OpenAI Realtime API without transcoding.`);
    } else {
         console.error("No supported mimeType found for MediaRecorder (tried pcm, wav, webm/opus). Cannot record audio.");
         mediaRecorder = null; // Explicitly nullify
         return; // Exit if no suitable format found
    }

    // Add audioBitsPerSecond if attempting Opus, though it might not guarantee PCM quality needed.
    // if (options.mimeType?.includes('opus')) {
    //     options.audioBitsPerSecond = 128000; // Example bitrate
    // }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
        console.log('MediaRecorder created with options:', options);
        console.log('Actual mimeType being used:', mediaRecorder.mimeType);
    } catch (e) {
        console.error('Failed to create MediaRecorder with options:', options, e);
         // Try with default options as a last resort
         try {
             console.log("Trying MediaRecorder with default options...");
             mediaRecorder = new MediaRecorder(stream);
             console.warn('Using default MediaRecorder mimeType:', mediaRecorder.mimeType, ". This may not work.");
         } catch (e2) {
             console.error('Failed to create MediaRecorder even with default options:', e2);
             mediaRecorder = null; // Ensure it's null if creation fails
             return;
         }
    }
     
     // If recorder was created, set up handlers
     if(mediaRecorder) {
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
                // Convert Blob to Base64 and send in OpenAI format
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Result contains 'data:audio/xxx;base64,....' - we need only the base64 part
                    const base64Audio = reader.result.split(',')[1]; 
                    if (base64Audio) {
                        const message = {
                            type: 'input.audio.chunk',
                            chunk: base64Audio
                        };
                        // console.debug("Sending audio chunk, size:", event.data.size);
                        websocket.send(JSON.stringify(message));
                    } else {
                         console.warn("Could not extract base64 data from FileReader result.");
                    }
                };
                reader.onerror = (err) => {
                     console.error("FileReader error converting blob to Base64:", err);
                };
                reader.readAsDataURL(event.data);
            } 
        };
        
        mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped.');
            // Optionally send an 'end of input audio' message if API supports it
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            callStatus.textContent = "Recording error.";
            stopCall(); // Stop call on recorder error
        };
    }
}

// --- Remove old playback functions if they conflict ---
// (Keep playAudio/playNextChunk as they are redefined above for PCM)

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
