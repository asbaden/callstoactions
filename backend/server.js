require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { createClient } = require('@supabase/supabase-js'); // Supabase JS library
const OpenAI = require('openai'); // OpenAI library
const fetch = require('node-fetch');

// --- Initialize Supabase Admin Client (using Service Role Key) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
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

// --- Express App Setup ---
const app = express();
const port = process.env.PORT || 3001; // Use Render's port or 3001 locally

// Middleware
app.use(cors()); // Enable CORS for requests from your frontend
app.use(express.json()); // Parse JSON request bodies

// Basic test route (useful for checking if HTTP server is up)
app.get('/', (req, res) => {
    res.send('CallToAction Backend (HTTP) is running!');
});

// --- Text-Based AI Sponsor Chat Endpoint ---
app.post('/api/chat-sponsor', async (req, res) => {
    console.log("Received request for /api/chat-sponsor");
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
        const { message, conversation_history, user_name, days_sober } = req.body;
        console.log("Received chat message:", message);
        
        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        // Format conversation history for the API
        const messages = [];
        
        // Start with system message
        let systemPrompt = "You are a compassionate and understanding AI sponsor for someone in recovery from addiction. " +
            "Your name is Actions and you're here to provide support, guidance, and accountability. " +
            "Your responses should be empathetic, non-judgmental, and focused on recovery principles. " +
            "Keep responses concise but meaningful. " +
            "Encourage the person to be honest with themselves and others. " +
            "Remind them that recovery is a journey and setbacks are opportunities for growth. ";
        
        // Add sobriety information if available
        if (typeof days_sober === 'number' && days_sober > 0) {
            const dayWord = days_sober === 1 ? "day" : "days";
            systemPrompt += `The person you're supporting has ${days_sober} ${dayWord} of sobriety. Acknowledge this achievement appropriately. `;
        }
        
        // Add user name if available
        const userName = user_name || "friend";
        systemPrompt += `Address the person as ${userName}. `;

        // Add crisis response guidance
        systemPrompt += "\nIf the person appears to be in crisis, prioritize safety and offer specific grounding techniques such as: " +
            "\n- Deep breathing: 4-count inhale, hold for 4, 6-count exhale" +
            "\n- The 5-4-3-2-1 grounding technique" +
            "\n- HALT check: Are they Hungry, Angry, Lonely, or Tired?" +
            "\n- Urge surfing for cravings" +
            "\n\nRemember that your support could be instrumental in helping them maintain their sobriety.";

        messages.push({ role: "system", content: systemPrompt });
        
        // Add conversation history if available
        if (conversation_history && Array.isArray(conversation_history)) {
            conversation_history.forEach(msg => {
                if (msg.role && msg.content && 
                    (msg.role === 'user' || msg.role === 'assistant') && 
                    typeof msg.content === 'string') {
                    messages.push(msg);
                }
            });
        }
        
        // Add current message
        messages.push({ role: "user", content: message });
        
        console.log("Calling OpenAI Chat API with gpt-4o-mini...");
        
        // Call OpenAI Chat Completions API
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: 0.7,
            max_tokens: 500
        });
        
        // Log token usage
        if (completion.usage) {
            console.log("AI Sponsor Chat Token Usage:", completion.usage);
        }
        
        // Get the response content
        const responseContent = completion.choices[0]?.message?.content || "I'm sorry, I'm having trouble responding right now.";
        
        // Save the interaction to the database if needed
        try {
            const { data, error } = await supabaseAdmin
                .from('sponsor_chat_logs')
                .insert({
                    user_id: user.id,
                    created_at: new Date().toISOString(),
                    user_message: message,
                    ai_response: responseContent
                });
                
            if (error) {
                console.error('Error logging sponsor chat:', error);
            }
        } catch (logError) {
            console.error('Exception logging sponsor chat:', logError);
        }
        
        // Return the AI's response
        res.json({ 
            response: responseContent,
            role: "assistant"
        });

    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({ 
            error: 'Failed to process chat request',
            details: error.message 
        });
    }
});

// --- Start the HTTP Server ---
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
}); 