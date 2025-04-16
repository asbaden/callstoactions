require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for WebSocket server
const WebSocket = require('ws'); // WebSocket library
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const url = require('url'); // For URL parsing
const OpenAI = require('openai'); // OpenAI library

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

// --- Create Realtime Session API Route ---
app.post('/api/create-realtime-session', async (req, res) => {
    try {
        // Create a Realtime session with OpenAI
        const session = await openai.realtime.sessions.create({
            model: "gpt-4o-realtime-preview",
            modalities: ["audio", "text"],
            voice: "echo",
            input_audio_format: "webm",
            output_audio_format: "webm",
            input_audio_transcription: {
                model: "whisper-1"
            },
            turn_detection: {
                type: "server_vad",
                threshold: 0.5
            }
        });
        
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
const openaiConnections = new Map();

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

        // Create a new Realtime session for this user
        try {
            const session = await openai.realtime.sessions.create({
                model: "gpt-4o-realtime-preview",
                modalities: ["audio", "text"],
                voice: "echo",
                input_audio_format: "webm",
                output_audio_format: "webm",
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5
                }
            });
            
            // Connect to OpenAI Realtime WebSocket
            const openaiWs = new WebSocket(
                `wss://api.openai.com/v1/realtime/ws?session_id=${session.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.client_secret.value}`
                    }
                }
            );

            openaiWs.on('open', () => {
                console.log(`OpenAI Realtime WebSocket connected for ${user.email}`);
                
                // Initialize session
                const sessionUpdate = {
                    type: "session.update",
                    session: {
                        turn_detection: { type: "server_vad" },
                        input_audio_format: "webm",
                        output_audio_format: "webm",
                        input_audio_transcription: {
                            model: "whisper-1"
                        },
                        voice: "echo",
                        instructions: "You are CallsToAction, a helpful voice assistant.",
                        modalities: ["text", "audio"],
                        temperature: 0.8,
                    }
                };
                openaiWs.send(JSON.stringify(sessionUpdate));
                
                // Store the OpenAI WebSocket connection
                openaiConnections.set(ws.userId, openaiWs);
                
                // Notify client that we're ready
                ws.send(JSON.stringify({ type: 'status', message: 'Connection successful. Ready for audio.' }));
            });

            openaiWs.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    console.log(`OpenAI message received:`, data.type);
                    
                    // Handle transcription events
                    if (data.type === 'conversation.item.input_audio_transcription.completed') {
                        console.log(`Transcription result for ${ws.userEmail}:`, data.transcript);
                        ws.send(JSON.stringify({ 
                            type: 'transcript', 
                            text: data.transcript 
                        }));
                    }
                    
                    // Forward other relevant messages to client
                    if (data.type === 'response.text.delta' || 
                        data.type === 'response.audio.delta' ||
                        data.type === 'error') {
                        ws.send(JSON.stringify(data));
                    }
                } catch (error) {
                    console.error('Error parsing OpenAI message:', error);
                }
            });

            openaiWs.on('error', (error) => {
                console.error(`OpenAI WebSocket error for ${user.email}:`, error);
                ws.send(JSON.stringify({ type: 'error', message: 'OpenAI connection error' }));
            });

            openaiWs.on('close', () => {
                console.log(`OpenAI WebSocket closed for ${user.email}`);
                openaiConnections.delete(ws.userId);
            });

        } catch (sessionError) {
            console.error('Error creating OpenAI Realtime session:', sessionError);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Failed to create OpenAI Realtime session'
            }));
            return;
        }

        // Handle incoming audio from client
        ws.on('message', async (message) => {
            if (message instanceof Buffer || message instanceof ArrayBuffer || typeof message === 'object') {
                const openaiWs = openaiConnections.get(ws.userId);
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    // Send audio to OpenAI
                    const audioAppendEvent = {
                        type: "input_audio_buffer.append",
                        audio: Buffer.from(message).toString('base64')
                    };
                    openaiWs.send(JSON.stringify(audioAppendEvent));
                } else {
                    console.error(`OpenAI WebSocket not available for ${ws.userEmail}`);
                    ws.send(JSON.stringify({ type: 'error', message: 'OpenAI connection not available' }));
                }
            } else {
                // Handle control messages from client
                console.log(`Received text/control message from ${ws.userEmail}: ${message}`);
            }
        });

        ws.on('close', () => {
            console.log(`WebSocket client disconnected: ${ws.userEmail}`);
            // Close OpenAI connection when client disconnects
            const openaiWs = openaiConnections.get(ws.userId);
            if (openaiWs) {
                openaiWs.close();
                openaiConnections.delete(ws.userId);
            }
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for ${ws.userEmail}:`, error);
        });

    } catch (verificationError) {
        console.error('Exception during token verification:', verificationError);
        ws.terminate();
    }
});

// --- Start the HTTP Server (including WebSocket) ---
server.listen(port, () => {
    console.log(`Backend server (HTTP + WebSocket) listening on port ${port}`);
}); 