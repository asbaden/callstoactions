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

        // Extract data sent from the client
        const { call_type, user_name, days_sober } = req.body;

        // --- Construct dynamic instructions ---
        let userName = user_name || "there"; // Fallback name
        let greeting = `Hello ${userName}.`;

        // Add sobriety congratulations for morning calls if data is valid
        if (call_type === 'morning' && typeof days_sober === 'number' && days_sober >= 0) {
            // Handle pluralization correctly
            const dayWord = days_sober === 1 ? "day" : "days";
             greeting += ` Congratulations on ${days_sober} ${dayWord} of recovery!`;
        }

        let baseInstructions = `You are CallsToAction, an empathetic AI voice assistant helping users with addiction recovery check-ins. Your tone should be supportive, non-judgmental, and encouraging. Keep conversational turns relatively concise. Start the call by greeting the user.`;
        let specificInstructions = "";

        if (call_type === 'morning') {
            specificInstructions = " This is a morning check-in. Guide the user to set positive intentions and briefly plan their day with recovery in mind.";
        } else if (call_type === 'evening') {
            specificInstructions = " This is an evening check-in. Guide the user to reflect on their day, focusing on challenges, successes, and gratitude related to their recovery.";
            // TODO: Later, add logic here to incorporate recalled intentions if sent from client
        }

        // Combine instructions
        const finalInstructions = `${baseInstructions} Your first sentence should be: "${greeting}". ${specificInstructions}`;
        console.log("Generated Instructions:", finalInstructions); // Log for debugging
        // --- End dynamic instructions ---

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
                instructions: finalInstructions,
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

// --- NEW Endpoint to Generate Action Items from Transcript ---
app.post('/api/generate-action-items', async (req, res) => {
    console.log("Received request for /api/generate-action-items");
    const token = req.headers.authorization?.split(' ')[1];
    const { journal_entry_id } = req.body;

    if (!token) {
        console.log("Rejected: No token provided.");
        return res.status(401).json({ error: 'Authentication required: No token provided.' });
    }
    if (!journal_entry_id) {
        console.log("Rejected: Missing journal_entry_id in request body.");
        return res.status(400).json({ error: 'Bad Request: Missing journal_entry_id.' });
    }

    try {
        // 1. Verify Supabase JWT and get user ID
        console.log("Verifying Supabase token...");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            console.error('Authentication failed:', authError?.message || 'Invalid token or user not found.');
            return res.status(401).json({ error: 'Authentication failed.', details: authError?.message });
        }
        console.log(`Authenticated user: ${user.email} for journal entry ${journal_entry_id}`);

        // 2. Fetch the full_transcript from Supabase
        console.log(`Fetching transcript for journal entry ID: ${journal_entry_id}`);
        const { data: entryData, error: fetchError } = await supabaseAdmin
            .from('journal_entries')
            .select('full_transcript')
            .eq('id', journal_entry_id)
            .eq('user_id', user.id) // Ensure the entry belongs to the authenticated user
            .single();

        if (fetchError) {
            console.error('Error fetching journal entry:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch journal entry.', details: fetchError.message });
        }
        if (!entryData || !entryData.full_transcript) {
            console.warn(`No transcript found for journal entry ID: ${journal_entry_id}`);
            return res.status(404).json({ error: 'Transcript not found for this entry.' });
        }
        const transcript = entryData.full_transcript;
        console.log(`Transcript fetched successfully (length: ${transcript.length})`);

        // 3. Call OpenAI API (GPT-4.1 nano) to extract action items
        console.log("Calling OpenAI (gpt-4-1106-preview) to extract action items..."); // Using gpt-4-turbo-preview temporarily
        const prompt = `Analyze the following conversation transcript between a user ("Me:") and an AI assistant ("Actions:"). Extract a list of specific, actionable tasks or commitments the user mentioned they would do. Focus only on concrete actions the user intends to take. Format the output as a JSON array of strings. If no specific actions are mentioned, return an empty array [].

Transcript:
---
${transcript}
---

JSON Array of Actions:`;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4-turbo-preview", // Use gpt-4-1106-preview or similar if nano isn't available/working yet
                messages: [
                    { role: "system", content: "You are an assistant that extracts actionable tasks from transcripts and outputs them as a JSON array." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }, // Ensure JSON output
                temperature: 0.2, // Lower temperature for more deterministic output
            });

            let actionItems = [];
            const responseContent = completion.choices[0]?.message?.content;
            if (responseContent) {
                console.log("Raw OpenAI response content:", responseContent);
                try {
                    // The model is instructed to return a JSON object containing the array.
                    // We need to parse the string and potentially access a key within it.
                    const parsedJson = JSON.parse(responseContent);
                    // ASSUMPTION: The model returns an object like { "actions": [...] } or directly the array.
                    // Adjust this based on actual model output.
                    if (Array.isArray(parsedJson)) {
                        actionItems = parsedJson;
                    } else if (parsedJson.actions && Array.isArray(parsedJson.actions)) {
                        actionItems = parsedJson.actions;
                    } else if (parsedJson.action_items && Array.isArray(parsedJson.action_items)) {
                         actionItems = parsedJson.action_items;
                    } else {
                         console.warn("Parsed JSON from OpenAI does not contain an expected array key ('actions' or 'action_items'). Using empty array.");
                         // Log the unexpected structure for debugging
                         console.log("Unexpected JSON structure:", parsedJson);
                    }
                    // Filter out any non-string items just in case
                    actionItems = actionItems.filter(item => typeof item === 'string');

                    console.log("Extracted action items:", actionItems);
                } catch (parseError) {
                    console.error('Error parsing JSON response from OpenAI:', parseError);
                    console.error('Raw response that failed parsing:', responseContent);
                    // Don't save if parsing fails, keep action_items as []
                }
            } else {
                console.warn('No content received from OpenAI completion.');
            }

            // 4. Update the journal entry in Supabase with the action items
            console.log(`Updating journal entry ${journal_entry_id} with action items...`);
            const { error: updateError } = await supabaseAdmin
                .from('journal_entries')
                .update({ action_items: actionItems })
                .eq('id', journal_entry_id)
                .eq('user_id', user.id);

            if (updateError) {
                console.error('Error updating journal entry with action items:', updateError);
                // Still return success to the client, but log the update error
                return res.status(200).json({ message: 'Action items generated but failed to save.', items: actionItems });
            }

            console.log(`Successfully updated journal entry ${journal_entry_id}`);
            res.status(200).json({ message: 'Action items generated and saved successfully.', items: actionItems });

        } catch (openaiError) {
            console.error('Error calling OpenAI API:', openaiError);
            res.status(500).json({ error: 'Failed to generate action items from OpenAI.', details: openaiError.message });
        }

    } catch (error) {
        // Catch any unexpected errors (e.g., from auth or initial fetch)
        console.error('Error processing /api/generate-action-items:', error);
        res.status(500).json({ 
            error: 'Internal server error processing action items request.',
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