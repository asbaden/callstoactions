require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
const WebSocket = require('ws'); // Restore WebSocket library
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const url = require('url'); // Restore URL parsing
const OpenAI = require('openai'); // OpenAI library
const FormData = require('form-data'); // Restore form-data library
const axios = require('axios'); // Require axios
const fs = require('fs'); // For file system operations
const path = require('path'); // For path manipulations
const os = require('os'); // For temp directory

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

// --- Remove Realtime Session Endpoint --- 
// app.post('/api/create-realtime-session', ...) // Removed

// --- Restore WebSocket Server Logic ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); 
console.log('WebSocket server setup complete.');

wss.on('connection', async (ws, req) => {
    console.log('Incoming WebSocket connection attempt...');
    const queryParams = url.parse(req.url, true).query;
    const token = queryParams.token;
    if (!token) {
        console.error('Connection rejected: No token.');
        ws.terminate(); 
        return;
    }

    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            console.error('Connection rejected: Invalid token.', error?.message);
            ws.terminate();
            return;
        }
        console.log(`WebSocket client connected: ${user.email}`);
        ws.userId = user.id;
        ws.userEmail = user.email;
        ws.audioBuffer = [];

        ws.send(JSON.stringify({ type: 'status', message: 'Connection successful. Ready for audio.' }));

        ws.on('message', async (message) => {
            if (message instanceof Buffer || message instanceof ArrayBuffer || typeof message === 'object') {
                console.log(`Received audio chunk from ${ws.userEmail}: ${message.length} bytes`);
                ws.audioBuffer.push(Buffer.from(message));
                const totalBufferSize = ws.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
                console.log(`Current buffer size: ${totalBufferSize} bytes`);

                const TRANSCRIPTION_THRESHOLD_BYTES = 100000; 
                if (totalBufferSize > TRANSCRIPTION_THRESHOLD_BYTES) {
                    console.log(`Buffer threshold reached (${totalBufferSize} bytes). Sending for transcription...`);
                    const completeBuffer = Buffer.concat(ws.audioBuffer);
                    ws.audioBuffer = []; // Clear buffer after sending

                    try {
                        console.log(`Attempting direct buffer transcription for ${ws.userEmail} (${completeBuffer.length} bytes)`);
                        
                        const transcription = await openai.audio.transcriptions.create({
                            file: completeBuffer,
                            model: 'whisper-1',
                            file_name: `audio_${ws.userId}_${Date.now()}.webm` // Just for identification
                        });

                        const transcriptText = transcription.text;
                        console.log(`Transcription result for ${ws.userEmail}:`, transcriptText);
                        ws.send(JSON.stringify({ type: 'transcript', text: transcriptText }));

                    } catch (transcriptionError) {
                        console.error(`Error during transcription for ${ws.userEmail}:`, transcriptionError);
                        
                        // Log more details about the error
                        if (transcriptionError.response) {
                            console.error('API Error Status:', transcriptionError.response.status);
                            console.error('API Error Data:', transcriptionError.response.data);
                        } else {
                            console.error('Detailed error:', transcriptionError);
                        }
                        
                        console.error(`Failed to transcribe buffer of size: ${completeBuffer?.length || 'N/A'}`);
                        ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed.' }));
                    }
                }
            } else {
                console.log(`Received text/control message from ${ws.userEmail}: ${message}`);
            }
        });

        ws.on('close', () => console.log(`WebSocket client disconnected: ${ws.userEmail}`));
        ws.on('error', (error) => console.error(`WebSocket error for ${ws.userEmail}:`, error));

    } catch (verificationError) {
        console.error('Exception during token verification:', verificationError);
        ws.terminate();
    }
});

// --- Start the HTTP Server (including WebSocket) ---
server.listen(port, () => {
    console.log(`Backend server (HTTP + WebSocket) listening on port ${port}`);
}); 