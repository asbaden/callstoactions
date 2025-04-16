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
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5
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
        
        // Initialize audio buffer for the fallback approach
        ws.audioBuffer = [];

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
                    input_audio_transcription: {
                        model: "whisper-1"
                    },
                    turn_detection: {
                        type: "server_vad",
                        threshold: 0.5
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API returned ${response.status}: ${JSON.stringify(errorData)}`);
            }

            const session = await response.json();
            
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
                        input_audio_format: "pcm16",
                        output_audio_format: "pcm16",
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
                
                // Fall back to standard transcription on error
                console.log(`Falling back to standard transcription for ${user.email}`);
                ws.send(JSON.stringify({ 
                    type: 'status', 
                    message: 'Connection successful. Using standard transcription. Ready for audio.'
                }));
            });

            openaiWs.on('close', () => {
                console.log(`OpenAI WebSocket closed for ${user.email}`);
                openaiConnections.delete(ws.userId);
            });

        } catch (sessionError) {
            console.error('Error creating OpenAI Realtime session:', sessionError);
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: 'Failed to create OpenAI Realtime session. Using standard transcription.'
            }));
            
            // Notify client that we're using the fallback approach
            ws.send(JSON.stringify({ 
                type: 'status', 
                message: 'Connection successful. Using standard transcription. Ready for audio.'
            }));
        }

        // Handle incoming audio from client
        ws.on('message', async (message) => {
            if (message instanceof Buffer || message instanceof ArrayBuffer || typeof message === 'object') {
                const openaiWs = openaiConnections.get(ws.userId);
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    // Send audio to OpenAI Realtime API
                    const audioAppendEvent = {
                        type: "input_audio_buffer.append",
                        audio: Buffer.from(message).toString('base64')
                    };
                    openaiWs.send(JSON.stringify(audioAppendEvent));
                } else {
                    // Fallback approach: collect audio chunks
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
                            console.log(`Attempting transcription for ${ws.userEmail} (${completeBuffer.length} bytes)`);
                            
                            // Create a temporary file with the correct extension
                            const tempDir = os.tmpdir();
                            const tempFile = path.join(tempDir, `audio_${ws.userId}_${Date.now()}.webm`);
                            
                            // Write buffer to file with the correct format extension
                            fs.writeFileSync(tempFile, completeBuffer);
                            console.log(`Written audio to temporary file: ${tempFile}`);
                            
                            // Make direct text-only transcription request
                            try {
                                // Use file for transcription
                                const transcription = await openai.audio.transcriptions.create({
                                    file: fs.createReadStream(tempFile),
                                    model: 'whisper-1',
                                    response_format: 'json'
                                });
                                
                                // Clean up temp file
                                fs.unlinkSync(tempFile);
                                console.log(`Deleted temporary file: ${tempFile}`);

                                const transcriptText = transcription.text;
                                console.log(`Transcription result for ${ws.userEmail}:`, transcriptText);
                                ws.send(JSON.stringify({ type: 'transcript', text: transcriptText }));

                                // Try to send a response using the OpenAI API
                                try {
                                    const completion = await openai.chat.completions.create({
                                        model: "gpt-4o",
                                        messages: [
                                            {
                                                role: "system",
                                                content: "You are CallsToAction, a helpful voice assistant. Keep responses short and conversational."
                                            },
                                            { 
                                                role: "user", 
                                                content: transcriptText 
                                            }
                                        ]
                                    });
                                    
                                    // Send text response back to client
                                    const responseText = completion.choices[0].message.content;
                                    ws.send(JSON.stringify({ 
                                        type: 'response.text.delta', 
                                        delta: responseText 
                                    }));
                                    
                                    // Generate speech from text
                                    try {
                                        const speechResponse = await openai.audio.speech.create({
                                            model: "tts-1",
                                            voice: "echo",
                                            input: responseText
                                        });
                                        
                                        // Convert to Buffer
                                        const buffer = Buffer.from(await speechResponse.arrayBuffer());
                                        
                                        // Send audio in chunks to match Realtime API format
                                        const chunkSize = 16000; // Approximate 1-second chunk at 16kHz
                                        for (let i = 0; i < buffer.length; i += chunkSize) {
                                            const chunk = buffer.slice(i, Math.min(i + chunkSize, buffer.length));
                                            ws.send(JSON.stringify({ 
                                                type: 'response.audio.delta', 
                                                delta: chunk.toString('base64') 
                                            }));
                                            
                                            // Small delay to simulate streaming
                                            await new Promise(resolve => setTimeout(resolve, 50));
                                        }
                                    } catch (speechError) {
                                        console.error('Error generating speech:', speechError);
                                    }
                                    
                                } catch (completionError) {
                                    console.error('Error generating response:', completionError);
                                }
                            } catch (transcriptionError) {
                                console.error(`Error during transcription for ${ws.userEmail}:`, transcriptionError);
                                
                                // Try again with a different format if the first attempt failed
                                try {
                                    console.log("First transcription attempt failed, trying with mp3 conversion...");
                                    
                                    // Try to use speech API directly for transcription as a backup
                                    const transcription = await openai.audio.transcriptions.create({
                                        file: fs.createReadStream(tempFile),
                                        model: 'whisper-1',
                                        response_format: 'json',
                                        temperature: 0.2  // Lower temperature for better accuracy
                                    });
                                    
                                    const transcriptText = transcription.text;
                                    console.log(`Transcription result from backup method for ${ws.userEmail}:`, transcriptText);
                                    ws.send(JSON.stringify({ type: 'transcript', text: transcriptText }));
                                    
                                    // Process response same as above
                                    const completion = await openai.chat.completions.create({
                                        model: "gpt-4o",
                                        messages: [
                                            {
                                                role: "system",
                                                content: "You are CallsToAction, a helpful voice assistant. Keep responses short and conversational."
                                            },
                                            { 
                                                role: "user", 
                                                content: transcriptText 
                                            }
                                        ]
                                    });
                                    
                                    // Same response processing as above
                                    const responseText = completion.choices[0].message.content;
                                    ws.send(JSON.stringify({ type: 'response.text.delta', delta: responseText }));
                                    
                                    // Generate and send speech
                                    const speechResponse = await openai.audio.speech.create({
                                        model: "tts-1",
                                        voice: "echo",
                                        input: responseText
                                    });
                                    
                                    const buffer = Buffer.from(await speechResponse.arrayBuffer());
                                    ws.send(JSON.stringify({ type: 'response.audio.delta', delta: buffer.toString('base64') }));
                                    
                                } catch (backupError) {
                                    console.error('Backup transcription also failed:', backupError);
                                    
                                    // If all else fails, just send a simple response to keep the interaction going
                                    const genericText = "I couldn't hear that clearly. Could you please repeat?";
                                    ws.send(JSON.stringify({ type: 'response.text.delta', delta: genericText }));
                                    
                                    try {
                                        const speechResponse = await openai.audio.speech.create({
                                            model: "tts-1",
                                            voice: "echo",
                                            input: genericText
                                        });
                                        
                                        const buffer = Buffer.from(await speechResponse.arrayBuffer());
                                        ws.send(JSON.stringify({ type: 'response.audio.delta', delta: buffer.toString('base64') }));
                                        
                                    } catch (speechError) {
                                        console.error('Error generating speech for generic response:', speechError);
                                    }
                                } finally {
                                    // Clean up temp file
                                    if (fs.existsSync(tempFile)) {
                                        fs.unlinkSync(tempFile);
                                        console.log(`Deleted temporary file in finally block: ${tempFile}`);
                                    }
                                }
                            }
                        } catch (generalError) {
                            console.error(`General error in audio processing:`, generalError);
                            ws.send(JSON.stringify({ type: 'error', message: 'Processing failed.' }));
                        }
                    }
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