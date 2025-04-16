require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
const WebSocket = require('ws'); // WebSocket library
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const url = require('url'); // To parse URL query parameters

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

        // Send a welcome message (optional)
        ws.send(JSON.stringify({ type: 'status', message: 'Connection successful. Ready for audio.' }));

        // 4. Handle Messages from this Client
        ws.on('message', (message) => {
            // Here we will receive audio chunks from the client
            console.log(`Received message from ${ws.userEmail} (User ID: ${ws.userId}): ${message.length} bytes`);
            // TODO: Process the received audio data (e.g., send to Whisper API)
            // Example: processAudioChunk(ws, message);
            
            // Placeholder: Echo back for testing
            // ws.send(JSON.stringify({ type: 'debug', receivedBytes: message.length }));
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