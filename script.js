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
let websocket = null; // Use simple websocket variable again
let mediaRecorder = null;
// let audioChunks = []; // Not needed if sending directly
// const WS_URL = 'wss://callstoactions.onrender.com'; // Now comes from config.js

async function startCall(callType) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }
    // Close previous connection if any
    if (websocket && websocket.readyState === WebSocket.OPEN) {
         alert('A call is already in progress.');
         // Optionally close old connection: websocket.close();
        return;
    }
    websocket = null;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    mediaRecorder = null;

    console.log(`Starting ${callType} call (Standard API)...`);
    callStatus.textContent = `Initializing ${callType} call...`;

    // 1. Get Supabase Auth Token (JWT)
    const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
    if (sessionError || !session) {
        console.error('Error getting session or no active session:', sessionError);
        alert('Could not get authentication token. Please log in again.');
        callStatus.textContent = 'Auth error.';
        return;
    }
    const accessToken = session.access_token;
    console.log('Got Supabase Access Token.');

     // Check for BACKEND_API_URL which contains the base URL for WS
     if (typeof BACKEND_API_URL === 'undefined') {
        console.error('BACKEND_API_URL is not defined in config.js');
        alert('Configuration error: Backend URL not set.');
        callStatus.textContent = 'Config error.';
        return;
    }
    // Construct WebSocket URL for OUR backend
    // Assumes BACKEND_API_URL is like https://... We need wss://...
    const backendBaseUrl = BACKEND_API_URL.replace(/^http/i, 'ws');
    const backendWsUrl = `${backendBaseUrl}?token=${accessToken}`;
    console.log(`Backend WebSocket URL: ${backendWsUrl}`);

    // 2. Request Microphone Access
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');
    } catch (err) {
         console.error('Error getting microphone access:', err);
         alert('Microphone access denied.');
         callStatus.textContent = 'Mic access denied.';
         return;
    }

    // 3. Establish WebSocket Connection to OUR Backend
    console.log(`Connecting to Backend WebSocket: ${backendWsUrl}`);
    callStatus.textContent = 'Connecting to server...';
    websocket = new WebSocket(backendWsUrl);

    // 4. Backend WebSocket Event Handlers
    websocket.onopen = () => {
        console.log('Backend WebSocket connection established.');
        callStatus.textContent = `${callType} call connected. Speak now...`;
        setupMediaRecorder(stream);
        mediaRecorder.start(1000); 
        console.log('MediaRecorder started.');
    };

    websocket.onmessage = (event) => {
        // Handle messages from OUR backend 
        try {
            const message = JSON.parse(event.data);
            console.log('Message received from server:', message);
            
            if (message.type === 'status') {
                callStatus.textContent = message.message;
            } else if (message.type === 'transcript') {
                // Display transcription received from backend for debugging
                callStatus.textContent = `Transcript: ${message.text}`; 
                // TODO: Later, feed this text into GPT, get TTS, play audio
            } else if (message.type === 'error') {
                console.error('Received error from backend:', message.message);
                callStatus.textContent = `Server Error: ${message.message}`;
            } else {
                 console.log('Unhandled message type from server:', message.type);
            }
        } catch (e) {
            console.error('Failed to parse incoming server message or handle event:', event.data, e);
            // Display raw message if not JSON
             callStatus.textContent = `Server: ${event.data}`;
        }
    };

    websocket.onerror = (error) => {
        console.error('Backend WebSocket error:', error);
        callStatus.textContent = 'Connection error.';
    };

    websocket.onclose = (event) => {
        console.log('Backend WebSocket connection closed:', event.code, event.reason);
        callStatus.textContent = 'Call disconnected.';
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        websocket = null;
        mediaRecorder = null;
    };
}

// --- Restore MediaRecorder setup to send Blob --- 

function setupMediaRecorder(stream) {
    const options = { mimeType: 'audio/webm;codecs=opus' }; 
     try {
         mediaRecorder = new MediaRecorder(stream, options);
     } catch (e) {
         console.warn('Preferred mimeType failed, trying default:', e);
         mediaRecorder = new MediaRecorder(stream);
     }
     console.log('Using mimeType:', mediaRecorder.mimeType);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && websocket && websocket.readyState === WebSocket.OPEN) {
            // Send audio blob directly to our backend
            // console.log(`Sending audio chunk: ${event.data.size} bytes`); 
            websocket.send(event.data); 
        } 
    };
    
     mediaRecorder.onstop = () => {
         console.log('Recording stopped.');
     };
     mediaRecorder.onerror = (event) => {
         console.error('MediaRecorder error:', event.error);
     };
}

// --- Remove Realtime API Audio Playback --- 
// let audioContext;
// let audioQueue = [];
// let isPlaying = false;
// function playAudio(...) { ... }
// function playNextChunk() { ... }

// function stopCall() { ... } // Keep placeholder

// --- Call Button Listeners (remain at end) ---
document.addEventListener('DOMContentLoaded', () => {
    // ... (listeners remain the same) ...
});
