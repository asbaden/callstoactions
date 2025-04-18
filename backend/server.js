require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
const WebSocket = require('ws'); // WebSocket library
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const url = require('url'); // For URL parsing
const OpenAI = require('openai'); // OpenAI library
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });
console.log('OpenAI client initialized.');

// Check if Realtime API is available
const hasRealtimeAPI = typeof openai.realtime !== 'undefined' && typeof openai.realtime.sessions !== 'undefined';
console.log(`OpenAI Realtime API ${hasRealtimeAPI ? 'is' : 'is NOT'} available.`);
if (!hasRealtimeAPI) {
    console.log('Using fallback transcription approach.');
}

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

// --- NEW Authenticated OpenAI Realtime Session Endpoint ---
app.post('/api/openai-session', async (req, res) => {
    console.log("Received request for /api/openai-session");
    const token = req.headers.authorization?.split(' ')[1]; // Extract Bearer token

    if (!token) {
        console.log("Rejected: No token provided.");
        return res.status(401).json({ error: 'Authentication required: No token provided.' });
    }

    try {
        // 1. Verify Supabase JWT
        console.log("Verifying Supabase token...");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error('Authentication failed:', authError?.message || 'Invalid token or user not found.');
            return res.status(401).json({ error: 'Authentication failed.', details: authError?.message });
        }
        console.log(`Authenticated user: ${user.email}`);

        // Optional: Extract call type from request body if needed for instructions
        const { call_type } = req.body; 
        let instructions = "You are CallsToAction, a helpful voice assistant for addiction recovery check-ins. Be empathetic, supportive, and guide the user through their check-in process. Keep responses relatively concise.";
        if (call_type === 'morning') {
             instructions += " Focus on setting intentions and planning the day positively.";
        } else if (call_type === 'evening') {
             instructions += " Focus on reflection, gratitude, and winding down.";
        }

        // 2. Create OpenAI Realtime Session using node-fetch
        console.log("Requesting OpenAI Realtime session...");
        const openaiSessionUrl = 'https://api.openai.com/v1/realtime/sessions';
        const openaiResponse = await fetch(openaiSessionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview",
                modalities: ["audio", "text"],
                instructions: instructions,
                voice: "echo",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                turn_detection: { 
                    type: "server_vad",
                    threshold: 0.5,
                    silence_duration_ms: 700
                },
                input_audio_transcription: {
                    model: "whisper-1"
                }
            })
        });

        const responseBody = await openaiResponse.text(); // Read body once

        if (!openaiResponse.ok) {
            console.error(`OpenAI API error: ${openaiResponse.status}`, responseBody);
             let errorDetails = responseBody;
             try {
                 errorDetails = JSON.parse(responseBody); // Try parsing JSON error
             } catch (e) { /* Ignore if not JSON */ }
            throw new Error(`OpenAI API returned ${openaiResponse.status}: ${JSON.stringify(errorDetails)}`);
        }

        const sessionData = JSON.parse(responseBody); // Parse successful response
        console.log("OpenAI session created successfully:", sessionData.id);
        // Also log the client secret value for debugging/testing
        if (sessionData.client_secret && sessionData.client_secret.value) {
             console.log("Client Secret Value:", sessionData.client_secret.value);
        } else {
             console.warn("Client secret structure unexpected or missing in OpenAI response:", sessionData.client_secret);
        }

        // 3. Return necessary data to the client
        res.json({ 
            id: sessionData.id, 
            client_secret: sessionData.client_secret,
            // Also return the format we requested, so client knows what to expect
            output_audio_format: sessionData.output_audio_format || 'pcm16' 
        });

    } catch (error) {
        console.error('Error processing /api/openai-session:', error);
        res.status(500).json({ 
            error: 'Failed to create OpenAI session',
            details: error.message 
        });
    }
});

// --- Create Realtime Session API Route ---
app.post('/api/create-realtime-session', async (req, res) => {
    try {
        // Create a Realtime session with direct HTTP request
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview",
                modalities: ["audio", "text"],
                voice: "echo",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                turn_detection: { 
                    type: "server_vad",
                    threshold: 0.5,
                    silence_duration_ms: 700
                },
                input_audio_transcription: {
                    model: "whisper-1"
                }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API returned ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const session = await response.json();
        res.json({ sessionId: session.id, clientSecret: session.client_secret });
    } catch (error) {
        console.error('Error creating Realtime session:', error);
        res.status(500).json({ 
            error: 'Failed to create Realtime session',
            details: error.message
        });
    }
});

// --- WebSocket Server Logic ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 
console.log('WebSocket server setup complete.');

// Track OpenAI connections for each user
// const openaiConnections = new Map(); // No longer needed here

// wss.on('connection', async (ws, req) => { ... entire block removed ... });

// --- Start the HTTP Server (including WebSocket) ---
server.listen(port, () => {
    console.log(`Backend server (HTTP + WebSocket) listening on port ${port}`);
}); 