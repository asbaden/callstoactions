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
let audioChunks = [];
// NOTE: Use WS_URL from config.js (Make sure config.js is loaded before script.js)
// const WS_URL = 'ws://localhost:3001'; // Example, actual value comes from config.js

async function startCall(callType) {
    if (!currentUser) {
        alert('Please log in first.');
        return;
    }
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        alert('A call is already in progress.');
        return;
    }

    console.log(`Starting ${callType} call...`);
    callStatus.textContent = `Connecting for ${callType} call...`;

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

    // 2. Request Microphone Access
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');
    } catch (err) {
        console.error('Error getting microphone access:', err);
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
        callStatus.textContent = 'Mic access denied.';
        return;
    }

    // 3. Establish WebSocket Connection (Send token for auth)
    // Make sure WS_URL is defined (should be from config.js)
    if (typeof WS_URL === 'undefined') {
        console.error('WS_URL is not defined. Make sure config.js is loaded and defines it.');
        alert('Configuration error: WebSocket URL not set.');
        callStatus.textContent = 'Config error.';
        return;
    }
    websocket = new WebSocket(`${WS_URL}?token=${accessToken}`);

    // 4. WebSocket Event Handlers
    websocket.onopen = () => {
        console.log('WebSocket connection established.');
        callStatus.textContent = `${callType} call connected. Speak now...`;
        // Start recording and sending audio (TODO)
        // setupMediaRecorder(stream);
        // mediaRecorder.start(1000); // Send chunks every 1 second (adjust as needed)
    };

    websocket.onmessage = (event) => {
        // Handle messages from the server (e.g., AI audio responses)
        console.log('Message received from server:', event.data);
        // TODO: Process received audio data and play it back
        if (event.data instanceof Blob) {
            // Assuming server sends audio blobs
            // playAudio(event.data);
        } else {
            // Handle text messages if any (e.g., status updates, welcome message)
            try {
                 const parsedMessage = JSON.parse(event.data);
                 if(parsedMessage.type === 'status') {
                    callStatus.textContent = parsedMessage.message;
                 } else {
                    callStatus.textContent = `AI: ${event.data}`; // Fallback for non-JSON or unknown type
                 }
            } catch(e) {
                 callStatus.textContent = `AI: ${event.data}`; // Display as raw text if not JSON
            }
        }
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        callStatus.textContent = 'Connection error.';
        // Clean up resources
        // stopCall(); 
    };

    websocket.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        callStatus.textContent = 'Call disconnected.';
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        // Clean up stream tracks
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        websocket = null;
        mediaRecorder = null;
        audioChunks = [];
    };

    // TODO: Add MediaRecorder setup
    // TODO: Add Audio Playback setup
}

// Placeholder functions for MediaRecorder/Audio (keep them defined here)
// function setupMediaRecorder(stream) { ... }
// function playAudio(audioBlob) { ... }
// function stopCall() { ... }

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
