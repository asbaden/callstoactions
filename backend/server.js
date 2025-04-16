require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');

// Initialize Supabase and OpenAI clients here later

const app = express();
const port = process.env.PORT || 3001; // Use Render's port or 3001 locally

// Middleware
app.use(cors()); // Enable CORS for requests from your frontend
app.use(express.json()); // Parse JSON request bodies

// Basic test route
app.get('/', (req, res) => {
  res.send('CallToAction Backend is running!');
});

// Placeholder for WebSocket setup (we'll add this later)
// const server = require('http').createServer(app);
// const WebSocket = require('ws');
// const wss = new WebSocket.Server({ server });

// wss.on('connection', (ws) => {
//   console.log('Client connected via WebSocket');
//   // Handle WebSocket messages here
//   ws.on('message', (message) => {
//     console.log('received: %s', message);
//   });
//   ws.send('Connected to WebSocket server!');
// });

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Use this if integrating WebSocket server later
// server.listen(port, () => {
//   console.log(`Server with WebSocket listening on port ${port}`);
// }); 