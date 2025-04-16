require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
// const WebSocket = require('ws'); // No longer handling WS connections here
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
// const url = require('url'); // No longer parsing WS URL here
const OpenAI = require('openai'); // OpenAI library
// const { Readable } = require('stream'); // Not needed for this approach
// const FormData = require('form-data'); // Not needed for this approach

// --- Initialize Supabase Admin Client (using Service Role Key) ---
// Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are in your .env file or Render env vars
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Required if adding protected backend routes later.');
}
// This admin client is used for privileged operations like verifying JWTs
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- Initialize OpenAI Client ---
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
    console.error('Error: Missing OPENAI_API_KEY in environment variables.');
    process.exit(1); // Exit if key is missing, as it's essential now
}

const openai = new OpenAI({ apiKey: openaiApiKey });
console.log('OpenAI client initialized.');

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3001; // Use Render's port or 3001 locally

// Middleware
app.use(cors()); // Enable CORS for requests from your frontend (though less relevant for WS)
app.use(express.json()); // Parse JSON request bodies for potential future REST endpoints

// Basic test route (still useful for checking if HTTP server is up)
app.get('/', (req, res) => {
    res.send('CallToAction Backend (HTTP) is running!');
});

// --- REST Endpoint to Create Realtime Session Token ---
app.post('/api/create-realtime-session', async (req, res) => {
    console.log('Received request to create realtime session...');
    // Optional: Verify user authentication if needed (e.g., via Supabase JWT in Authorization header)
    // const authHeader = req.headers.authorization;
    // if (!authHeader || !authHeader.startsWith('Bearer ')) { ... return 401 ... }
    // const token = authHeader.split(' ')[1];
    // const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    // if (error || !user) { ... return 401 ... }
    // console.log('Authenticated user:', user.id);

    try {
        // Define desired session configuration
        const sessionConfig = {
            model: "gpt-4o-realtime-preview", // Or another suitable realtime model
            modalities: ["audio", "text"], // Allow both audio input/output
            instructions: "You are a friendly, supportive accountability buddy for recovery. Guide the user through their morning intention setting or evening reflection based on the 10th step principles. Keep responses concise and encouraging.", // Add your system prompt
            // Add other parameters like voice, language, turn_detection as needed based on docs
             voice: "alloy", // Example voice
             // Align input format with what browser MediaRecorder likely sends (Opus)
             input_audio_format: "opus", // <-- CHANGED FROM pcm16
             output_audio_format: "pcm16",
             input_audio_transcription: { // Enable transcription for user input
                model: "whisper-1" // Or "gpt-4o-transcribe"
             },
             turn_detection: null // Let frontend control turns for now
        };
        
        console.log('Requesting OpenAI realtime session with config:', sessionConfig);

        // Use fetch to call OpenAI REST endpoint
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionConfig)
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('Error creating OpenAI realtime session:', response.status, response.statusText, responseData);
            return res.status(response.status || 500).json({ error: responseData.error?.message || 'Failed to create OpenAI session' });
        }

        if (!responseData.client_secret || !responseData.client_secret.value) {
            console.error('Invalid response format from OpenAI session creation:', responseData);
            return res.status(500).json({ error: 'Invalid response from OpenAI session API' });
        }

        console.log('Successfully created OpenAI realtime session. Returning client_secret.');
        // Return only the necessary ephemeral token value to the client
        res.json({ client_secret: responseData.client_secret.value });

    } catch (error) {
        console.error('Exception creating OpenAI realtime session:', error);
        res.status(500).json({ error: 'Internal server error creating session' });
    }
});

// --- Remove or Comment Out Old WebSocket Server Logic ---
/*
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 
console.log('WebSocket server setup complete.');
wss.on('connection', async (ws, req) => {
    // ... old connection, auth, message handling logic ...
});
*/

// --- Start the HTTP Server ONLY ---
// Make sure to use app.listen, not server.listen if wss is removed/commented out
app.listen(port, () => {
    console.log(`Backend server (HTTP only) listening on port ${port}`);
}); 