require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
const WebSocket = require('ws'); // WebSocket library
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const url = require('url'); // To parse URL query parameters
const OpenAI = require('openai'); // OpenAI library
const { Readable } = require('stream'); // Import Readable stream
const FormData = require('form-data'); // Require form-data library

// --- Initialize Supabase Admin Client (using Service Role Key) ---
// Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are in your .env file or Render env vars
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.');
    console.error('WebSocket connections will likely fail authentication.');
    // Optionally exit: process.exit(1);
}
// This admin client is used for privileged operations like verifying JWTs
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// --- Initialize OpenAI Client ---
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
    console.error('Error: Missing OPENAI_API_KEY in environment variables.');
    console.error('Audio processing will fail.');
    // Optionally exit: process.exit(1);
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

// --- HTTP Server Creation ---
const server = http.createServer(app);

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server }); // Attach WebSocket server to HTTP server

console.log('WebSocket server setup complete.');

wss.on('connection', async (ws, req) => {
    console.log('Incoming WebSocket connection attempt...');

    // 1. Extract Token from URL
    const queryParams = url.parse(req.url, true).query;
    const token = queryParams.token;

    if (!token) {
        console.error('Connection attempt rejected: No token provided.');
        ws.terminate(); // Close connection immediately
        return;
    }

    // 2. Verify JWT using Supabase Admin Client
    try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            console.error('Connection attempt rejected: Invalid token or failed user lookup.', error?.message || 'No user found');
            ws.terminate();
            return;
        }

        // 3. Token is valid - Connection Accepted
        console.log(`WebSocket client connected successfully. User ID: ${user.id}, Email: ${user.email}`);
        ws.isAlive = true; // For heartbeat/ping mechanism later if needed
        ws.userId = user.id; // Store user ID on the connection object
        ws.userEmail = user.email; // Store email for logging
        ws.audioBuffer = []; // Initialize buffer for this client

        // Send a welcome message (optional)
        ws.send(JSON.stringify({ type: 'status', message: 'Connection successful. Ready for audio.' }));

        // 4. Handle Messages from this Client
        ws.on('message', async (message) => {
            // Check if the message is audio data (binary Blob)
            if (message instanceof Buffer || message instanceof ArrayBuffer || typeof message === 'object') {
                console.log(`Received audio chunk from ${ws.userEmail}: ${message.length} bytes`);
                ws.audioBuffer.push(Buffer.from(message)); // Add chunk to buffer

                // Simple threshold for transcription (e.g., after ~5 seconds of audio at 1 chunk/sec)
                // A more robust solution would use silence detection or fixed time intervals
                const totalBufferSize = ws.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
                console.log(`Current buffer size: ${totalBufferSize} bytes`);

                // Adjust this threshold as needed
                const TRANSCRIPTION_THRESHOLD_BYTES = 100000; // Example: ~100KB

                if (totalBufferSize > TRANSCRIPTION_THRESHOLD_BYTES) {
                    console.log(`Buffer threshold reached (${totalBufferSize} bytes). Sending for transcription...`);
                    const completeBuffer = Buffer.concat(ws.audioBuffer);
                    ws.audioBuffer = []; // Clear buffer after sending

                    let filename = `audio_${ws.userId}_${Date.now()}.webm`;
                    try {
                        // --- Manually construct FormData and use fetch --- 
                        const formData = new FormData();
                        formData.append('file', completeBuffer, { filename: filename, contentType: 'audio/webm' });
                        formData.append('model', 'whisper-1');

                        console.log(`Attempting transcription via fetch with FormData (filename: ${filename}, size: ${completeBuffer.length})`);

                        const whisperUrl = 'https://api.openai.com/v1/audio/transcriptions';
                        
                        const response = await fetch(whisperUrl, {
                            method: 'POST',
                            headers: {
                                ...formData.getHeaders(), // Include boundary and content-type
                                'Authorization': `Bearer ${openaiApiKey}`,
                            },
                            body: formData, // Pass FormData object directly
                        });

                        const responseData = await response.json();

                        if (!response.ok) {
                             // Throw an error to be caught by the catch block
                             // Include details from the response if possible
                             const errorPayload = {
                                 status: response.status,
                                 statusText: response.statusText,
                                 message: `API request failed: ${response.statusText}`,
                                 responseBody: responseData
                             };
                             console.error('Whisper API Error Response:', errorPayload);
                             throw new Error(responseData.error?.message || `HTTP error! status: ${response.status}`);
                        }
                        
                        if (!responseData || !responseData.text) {
                            console.error('Invalid transcription response format:', responseData);
                            throw new Error('Invalid response format from transcription API');
                        }

                        const transcriptText = responseData.text;
                        console.log(`Transcription result for ${ws.userEmail}:`, transcriptText);
                        ws.send(JSON.stringify({ type: 'transcript', text: transcriptText }));

                    } catch (transcriptionError) {
                        console.error(`Error during transcription fetch for ${ws.userEmail} (Filename: ${filename}):`, transcriptionError);
                        // Log additional details if it came from our thrown error
                        if(transcriptionError.responseBody){
                             console.error('API Response Body on Error:', transcriptionError.responseBody);
                        }
                        console.error(`Failed to transcribe buffer of size: ${completeBuffer?.length || 'N/A'}`);
                        // Detailed logging of specific OpenAI API errors might be less direct here,
                        // rely on the logged response body
                        ws.send(JSON.stringify({ type: 'error', message: 'Transcription failed.' }));
                    }
                }
            } else {
                // Handle non-binary messages if needed (e.g., control messages)
                console.log(`Received text/control message from ${ws.userEmail}: ${message}`);
            }
        });

        // 5. Handle Client Disconnect
        ws.on('close', () => {
            console.log(`WebSocket client disconnected: ${ws.userEmail} (User ID: ${ws.userId})`);
            // Clean up any resources associated with this client if needed
        });

        // 6. Handle Errors for this Client
        ws.on('error', (error) => {
            console.error(`WebSocket error for user ${ws.userEmail} (User ID: ${ws.userId}):`, error);
        });

    } catch (verificationError) {
        console.error('Exception during token verification:', verificationError);
        ws.terminate();
    }
});

// Optional: Heartbeat mechanism to detect broken connections
// setInterval(() => {
//     wss.clients.forEach((ws) => {
//         if (!ws.isAlive) return ws.terminate();
//         ws.isAlive = false;
//         ws.ping(() => {}); // Send ping
//     });
// }, 30000); // Check every 30 seconds

// --- Start the HTTP Server (which includes the WebSocket server) ---
server.listen(port, () => {
    console.log(`Backend server (HTTP + WebSocket) listening on port ${port}`);
}); 