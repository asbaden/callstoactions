// Ensure config.js is loaded first and contains SUPABASE_URL and SUPABASE_ANON_KEY

// Initialize Supabase client using the config object
const { createClient } = supabase;
const _supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
console.log('Supabase client instance:', _supabase);

console.log('Supabase Initialized');

// --- DOM Elements ---
// Auth elements
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const authSection = document.getElementById('auth-section');
const mainContent = document.getElementById('main-content');

// Header elements
const daysCount = document.getElementById('days-count');
const editDaysBtn = document.getElementById('edit-days-btn');
const historyBtn = document.getElementById('history-btn');
const settingsBtn = document.getElementById('settings-btn');
const panicModeBtn = document.getElementById('panic-mode-btn');

// Main views
const morningCheckinForm = document.getElementById('morning-checkin-form');
const morningCheckinView = document.getElementById('morning-checkin-view');
const eveningReview = document.getElementById('evening-review');
const journalView = document.getElementById('journal-view');
const profileView = document.getElementById('profile-view');
const panicModeView = document.getElementById('panic-mode-view');

// Morning form elements
const morningForm = document.getElementById('morning-form');
const gratitudeInput = document.getElementById('gratitude-input');
const addGratitudeBtn = document.getElementById('add-gratitude');
const gratitudeItems = document.getElementById('gratitude-items');
const generalPlan = document.getElementById('general-plan');
const moodButtons = document.querySelectorAll('.mood-button');
const customMood = document.getElementById('custom-mood');
const selectedMood = document.getElementById('selected-mood');
const watchForInput = document.getElementById('watch-for-input');
const addWatchForBtn = document.getElementById('add-watch-for');
const watchForItems = document.getElementById('watch-for-items');
const striveForInput = document.getElementById('strive-for-input');
const addStriveForBtn = document.getElementById('add-strive-for');
const striveForItems = document.getElementById('strive-for-items');
const completeMorningBtn = document.getElementById('complete-morning');

// View switching buttons
const switchToEveningBtn = document.getElementById('switch-to-evening');
const switchToEveningCompletedBtn = document.getElementById('switch-to-evening-completed');
const editCheckinBtn = document.getElementById('edit-checkin');

// Evening review elements
const dailyReviewTab = document.getElementById('daily-review-tab');
const tenthStepTab = document.getElementById('tenth-step-tab');
const dailyReviewContent = document.getElementById('daily-review-content');
const tenthStepContent = document.getElementById('tenth-step-content');
const continueToTenthStep = document.getElementById('continue-tenth-step');
const tenthStepForm = document.getElementById('tenth-step-form');
const completeTenthStepBtn = document.getElementById('complete-tenth-step');

// Toggle buttons
const toggleButtons = document.querySelectorAll('.toggle-button');

// Panic mode elements
const startPanicCallBtn = document.getElementById('start-panic-call');
const exitPanicModeBtn = document.getElementById('exit-panic-mode');

// Profile elements
const sobrietyDateInput = document.getElementById('sobriety-date');
const saveProfileButton = document.getElementById('save-profile-button');
const profileStatus = document.getElementById('profile-status');

// Journal elements
const journalEntriesContainer = document.getElementById('journal-entries');

// --- Global State Variables ---
let currentUser = null;
let userProfile = null;
let currentMorningCheckinId = null;
let currentEveningReviewId = null;
let todaysMorningCheckin = null;

// For panic mode
let panicCallActive = false;
let panicTranscript = "";

// --- Initialize Current Date ---
const today = new Date();
const formattedDate = today.toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
});

// --- Auth State Management ---
const updateUI = (user) => {
  currentUser = user;
  if (user) {
    // User is logged in
    authSection.style.display = 'none';
    mainContent.style.display = 'block';
    checkTodaysMorningCheckin(); // Check if user has completed morning check-in
    loadUserProfile(); // Load profile data including sobriety date
    console.log('UI Updated: User logged in:', user.email);
  } else {
    // User is logged out
    authSection.style.display = 'block';
    mainContent.style.display = 'none';
    if (sobrietyDateInput) sobrietyDateInput.value = ''; // Clear date input
    if (profileStatus) profileStatus.textContent = ''; // Clear profile status
    console.log('UI Updated: User logged out');
  }
};

// Listen for authentication state changes
console.log('Setting up onAuthStateChange listener...');
const { data: { subscription } } = _supabase.auth.onAuthStateChange((event, session) => {
  console.log(`onAuthStateChange event: ${event}`, session);
  if (event === 'SIGNED_IN' && session) {
    console.log('Session details from SIGNED_IN event:', session);
    _supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error('Error confirming user after SIGNED_IN event:', error);
        _supabase.auth.signOut(); 
      } else if (user) {
        console.log('User confirmed after SIGNED_IN event:', user);
        updateUI(user);
      } else {
        console.log('getUser() returned no user after SIGNED_IN');
      }
    });
  } else if (event === 'SIGNED_OUT') {
    updateUI(null);
  } else if (event === 'INITIAL_SESSION') {
    updateUI(session?.user ?? null);
  }
});

// --- View Management Functions ---
function showMorningForm() {
  morningCheckinForm.style.display = 'block';
  morningCheckinView.style.display = 'none';
  eveningReview.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  panicModeView.style.display = 'none';
}

function showMorningView() {
  morningCheckinForm.style.display = 'none';
  morningCheckinView.style.display = 'block';
  eveningReview.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  panicModeView.style.display = 'none';
}

function showEveningReview() {
  morningCheckinForm.style.display = 'none';
  morningCheckinView.style.display = 'none';
  eveningReview.style.display = 'block';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  panicModeView.style.display = 'none';
  loadDailyReviewData();
}

function showJournalView() {
  morningCheckinForm.style.display = 'none';
  morningCheckinView.style.display = 'none';
  eveningReview.style.display = 'none';
  journalView.style.display = 'block';
  profileView.style.display = 'none';
  panicModeView.style.display = 'none';
  loadJournalEntries();
}

function showProfileView() {
  morningCheckinForm.style.display = 'none';
  morningCheckinView.style.display = 'none';
  eveningReview.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'block';
  panicModeView.style.display = 'none';
}

function showPanicMode() {
  morningCheckinForm.style.display = 'none';
  morningCheckinView.style.display = 'none';
  eveningReview.style.display = 'none';
  journalView.style.display = 'none';
  profileView.style.display = 'none';
  panicModeView.style.display = 'block';
}

// --- Switching Between Daily Review and 10th Step Tabs ---
function showDailyReviewTab() {
  dailyReviewTab.classList.add('active');
  tenthStepTab.classList.remove('active');
  dailyReviewContent.style.display = 'block';
  tenthStepContent.style.display = 'none';
}

function showTenthStepTab() {
  dailyReviewTab.classList.remove('active');
  tenthStepTab.classList.add('active');
  dailyReviewContent.style.display = 'none';
  tenthStepContent.style.display = 'block';
}

// --- Check for Today's Morning Check-in ---
async function checkTodaysMorningCheckin() {
  if (!currentUser) return;
  
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data, error } = await _supabase
      .from('daily_check_ins')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) throw error;
    
    if (data) {
      // User has already completed a check-in today
      todaysMorningCheckin = data;
      currentMorningCheckinId = data.id;
      displayCompletedCheckin(data);
      showMorningView();
    } else {
      // No check-in today, show the form
      resetMorningForm();
      showMorningForm();
    }
  } catch (error) {
    console.error('Error checking for today\'s check-in:', error);
    showMorningForm(); // Default to showing the form on error
  }
}

// --- Morning Check-in Form Functionality ---
// Add gratitude item
function addGratitudeItem() {
  const gratitudeText = gratitudeInput.value.trim();
  if (!gratitudeText) return;
  
  const itemElement = document.createElement('div');
  itemElement.className = 'list-item';
  itemElement.innerHTML = `
    <span class="list-item-text">${gratitudeText}</span>
    <button class="remove-item" data-type="gratitude">×</button>
  `;
  gratitudeItems.appendChild(itemElement);
  gratitudeInput.value = '';
  gratitudeInput.focus();
}

// Add watch-for item
function addWatchForItem() {
  const watchForText = watchForInput.value.trim();
  if (!watchForText) return;
  
  const itemElement = document.createElement('div');
  itemElement.className = 'list-item';
  itemElement.innerHTML = `
    <span class="list-item-text">${watchForText}</span>
    <button class="remove-item" data-type="watch-for">×</button>
  `;
  watchForItems.appendChild(itemElement);
  watchForInput.value = '';
  watchForInput.focus();
}

// Add strive-for item
function addStriveForItem() {
  const striveForText = striveForInput.value.trim();
  if (!striveForText) return;
  
  const itemElement = document.createElement('div');
  itemElement.className = 'list-item';
  itemElement.innerHTML = `
    <span class="list-item-text">${striveForText}</span>
    <button class="remove-item" data-type="strive-for">×</button>
  `;
  striveForItems.appendChild(itemElement);
  striveForInput.value = '';
  striveForInput.focus();
}

// Reset morning form
function resetMorningForm() {
  gratitudeItems.innerHTML = '';
  generalPlan.value = '';
  moodButtons.forEach(btn => btn.classList.remove('selected'));
  selectedMood.value = '';
  customMood.value = '';
  watchForItems.innerHTML = '';
  striveForItems.innerHTML = '';
}

// Handle mood selection
function handleMoodSelection(event) {
  const button = event.target;
  const mood = button.dataset.mood;
  
  // Clear previous selection
  moodButtons.forEach(btn => btn.classList.remove('selected'));
  
  // Apply new selection
  button.classList.add('selected');
  selectedMood.value = mood;
  customMood.value = '';
}

// Handle custom mood input
function handleCustomMood() {
  if (customMood.value) {
    moodButtons.forEach(btn => btn.classList.remove('selected'));
    selectedMood.value = customMood.value;
  }
}

// Submit morning check-in
async function submitMorningCheckin(event) {
  event.preventDefault();
  
  // Collect gratitude items
  const gratitudeList = [];
  gratitudeItems.querySelectorAll('.list-item-text').forEach(item => {
    gratitudeList.push(item.textContent);
  });
  
  // Get general plan
  const generalPlanText = generalPlan.value.trim();
  
  // Get mood
  const mood = selectedMood.value || customMood.value || 'Not specified';
  
  // Collect watch-for items
  const watchForList = [];
  watchForItems.querySelectorAll('.list-item-text').forEach(item => {
    watchForList.push(item.textContent);
  });
  
  // Collect strive-for items
  const striveForList = [];
  striveForItems.querySelectorAll('.list-item-text').forEach(item => {
    striveForList.push(item.textContent);
  });
  
  try {
    const { data, error } = await _supabase
      .from('daily_check_ins')
      .insert({
        user_id: currentUser.id,
        date: today.toISOString().split('T')[0],
        gratitude_list: gratitudeList,
        general_plan: generalPlanText,
        current_mood: mood,
        watch_for_items: watchForList,
        strive_for_items: striveForList
      })
      .select()
      .single();
      
    if (error) throw error;
    
    console.log('Morning check-in saved:', data);
    todaysMorningCheckin = data;
    currentMorningCheckinId = data.id;
    displayCompletedCheckin(data);
    showMorningView();
    
  } catch (error) {
    console.error('Error saving morning check-in:', error);
    alert('There was an error saving your check-in. Please try again.');
  }
}

// --- Display Completed Check-in ---
function displayCompletedCheckin(checkin) {
  // Populate the view-only sections
  const viewGratitudeList = document.getElementById('view-gratitude-list');
  const viewGeneralPlan = document.getElementById('view-general-plan');
  const viewCurrentMood = document.getElementById('view-current-mood');
  const viewWatchFor = document.getElementById('view-watch-for');
  const viewStriveFor = document.getElementById('view-strive-for');
  
  // Clear previous content
  viewGratitudeList.innerHTML = '';
  viewGeneralPlan.textContent = '';
  viewCurrentMood.textContent = '';
  viewWatchFor.innerHTML = '';
  viewStriveFor.innerHTML = '';
  
  // Populate gratitude list
  if (checkin.gratitude_list && checkin.gratitude_list.length > 0) {
    checkin.gratitude_list.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      viewGratitudeList.appendChild(itemElement);
    });
  } else {
    viewGratitudeList.innerHTML = '<p class="empty-message">No gratitude items added.</p>';
  }
  
  // Populate general plan
  viewGeneralPlan.textContent = checkin.general_plan || 'No general plan specified.';
  
  // Populate mood
  viewCurrentMood.textContent = checkin.current_mood || 'Not specified';
  
  // Populate watch-for items
  if (checkin.watch_for_items && checkin.watch_for_items.length > 0) {
    checkin.watch_for_items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      viewWatchFor.appendChild(itemElement);
    });
  } else {
    viewWatchFor.innerHTML = '<p class="empty-message">No watch-for items added.</p>';
  }
  
  // Populate strive-for items
  if (checkin.strive_for_items && checkin.strive_for_items.length > 0) {
    checkin.strive_for_items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      viewStriveFor.appendChild(itemElement);
    });
  } else {
    viewStriveFor.innerHTML = '<p class="empty-message">No strive-for items added.</p>';
  }
}

// --- Load Daily Review Data ---
function loadDailyReviewData() {
  if (!todaysMorningCheckin) {
    console.error('No morning check-in data available for review');
    return;
  }
  
  // Populate the review sections
  const reviewGratitudeList = document.getElementById('review-gratitude-list');
  const reviewGeneralPlan = document.getElementById('review-general-plan');
  const reviewMorningMood = document.getElementById('review-morning-mood');
  const reviewWatchFor = document.getElementById('review-watch-for');
  const reviewStriveFor = document.getElementById('review-strive-for');
  const actionItemsList = document.getElementById('action-items-list');
  const actionItemsContainer = document.getElementById('action-items-container');
  const emptyMessage = actionItemsContainer.querySelector('.empty-message');
  
  // Clear previous content
  reviewGratitudeList.innerHTML = '';
  reviewGeneralPlan.textContent = '';
  reviewMorningMood.textContent = '';
  reviewWatchFor.innerHTML = '';
  reviewStriveFor.innerHTML = '';
  actionItemsList.innerHTML = '';
  
  // Populate gratitude list
  if (todaysMorningCheckin.gratitude_list && todaysMorningCheckin.gratitude_list.length > 0) {
    todaysMorningCheckin.gratitude_list.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      reviewGratitudeList.appendChild(itemElement);
    });
  } else {
    reviewGratitudeList.innerHTML = '<p class="empty-message">No gratitude items added.</p>';
  }
  
  // Populate general plan
  reviewGeneralPlan.textContent = todaysMorningCheckin.general_plan || 'No general plan specified.';
  
  // Populate mood
  reviewMorningMood.textContent = todaysMorningCheckin.current_mood || 'Not specified';
  
  // Populate watch-for items
  if (todaysMorningCheckin.watch_for_items && todaysMorningCheckin.watch_for_items.length > 0) {
    todaysMorningCheckin.watch_for_items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      reviewWatchFor.appendChild(itemElement);
    });
  } else {
    reviewWatchFor.innerHTML = '<p class="empty-message">No watch-for items added.</p>';
  }
  
  // Populate strive-for items
  if (todaysMorningCheckin.strive_for_items && todaysMorningCheckin.strive_for_items.length > 0) {
    todaysMorningCheckin.strive_for_items.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'list-item';
      itemElement.innerHTML = `<span class="list-item-text">${item}</span>`;
      reviewStriveFor.appendChild(itemElement);
    });
  } else {
    reviewStriveFor.innerHTML = '<p class="empty-message">No strive-for items added.</p>';
  }
  
  // Parse general plan into action items for completion tracking
  if (todaysMorningCheckin.general_plan && todaysMorningCheckin.general_plan.trim() !== '') {
    // Show action items for completion tracking
    if (emptyMessage) emptyMessage.style.display = 'none';
    
    // Split the general plan into items (by commas, semicolons, or line breaks)
    const generalPlanItems = todaysMorningCheckin.general_plan
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    if (generalPlanItems.length > 0) {
      generalPlanItems.forEach((item, index) => {
        // For completion tracking
        const actionItem = document.createElement('div');
        actionItem.className = 'action-item';
        actionItem.innerHTML = `
          <input type="checkbox" id="action-${index}" class="action-checkbox">
          <label for="action-${index}">${item}</label>
        `;
        actionItemsList.appendChild(actionItem);
      });
    } else {
      // If the general plan couldn't be split into items
      if (emptyMessage) emptyMessage.style.display = 'block';
    }
  } else {
    // Keep the empty message for action items
    if (emptyMessage) emptyMessage.style.display = 'block';
  }
  
  // Start on the Daily Review tab
  showDailyReviewTab();
}

// --- Toggle Buttons for 10th Step ---
function handleToggleButton(event) {
  const button = event.target;
  if (!button.classList.contains('toggle-button')) return;
  
  const question = button.dataset.question;
  const value = button.dataset.value;
  const isYes = value === 'yes';
  
  // Find the other button in the same group
  const parentDiv = button.closest('.toggle-buttons');
  const siblingButton = isYes 
    ? parentDiv.querySelector('.toggle-button.no') 
    : parentDiv.querySelector('.toggle-button.yes');
  
  // Update active state
  button.classList.add('active');
  siblingButton.classList.remove('active');
  
  // Show/hide reflection area
  const reflectionAreaId = `${question}-reflection-area`;
  const reflectionArea = document.getElementById(reflectionAreaId) || 
                          document.getElementById(`${question.split('_')[0]}-reflection-area`);
  
  if (reflectionArea) {
    reflectionArea.style.display = isYes ? 'block' : 'none';
  }
}

// --- Submit Evening Review ---
async function submitEveningReview(event) {
  event.preventDefault();
  
  if (!currentMorningCheckinId) {
    console.error('No morning check-in ID found');
    alert('Please complete a morning check-in first.');
    return;
  }
  
  // Collect completed action items
  const completedActions = [];
  document.querySelectorAll('.action-checkbox:checked').forEach((checkbox) => {
    const label = checkbox.nextElementSibling.textContent;
    completedActions.push(label);
  });
  
  // Collect 10th step responses
  const tenthStepData = {};
  const questions = ['harm_anyone', 'resentment', 'fear_anxiety', 'selfish', 'apology'];
  
  questions.forEach(question => {
    const yesButton = document.querySelector(`.toggle-button.yes[data-question="${question}"]`);
    const isYes = yesButton && yesButton.classList.contains('active');
    
    // Get reflection text if answered yes
    let reflectionText = '';
    if (isYes) {
      const reflectionId = `${question}-reflection` || `${question.split('_')[0]}-reflection`;
      const reflectionTextarea = document.getElementById(reflectionId);
      reflectionText = reflectionTextarea ? reflectionTextarea.value.trim() : '';
    }
    
    tenthStepData[question] = {
      answer: isYes,
      reflection: isYes ? reflectionText : null
    };
  });
  
  try {
    const { data, error } = await _supabase
      .from('evening_reviews')
      .insert({
        user_id: currentUser.id,
        daily_check_in_id: currentMorningCheckinId,
        date: today.toISOString().split('T')[0],
        completed_actions: completedActions,
        tenth_step: tenthStepData
      })
      .select()
      .single();
      
    if (error) throw error;
    
    console.log('Evening review saved:', data);
    currentEveningReviewId = data.id;
    
    // Show completion message or redirect
    alert('Your evening review has been saved successfully!');
    showJournalView(); // Redirect to journal view
    
  } catch (error) {
    console.error('Error saving evening review:', error);
    alert('There was an error saving your evening review. Please try again.');
  }
}

// --- Panic Mode Functions ---
async function startPanicCall() {
  if (panicCallActive) return;
  
  panicCallActive = true;
  panicTranscript = "";
  const panicCallStatus = document.getElementById('panic-call-status');
  
  if (panicCallStatus) {
    panicCallStatus.style.display = 'block';
    panicCallStatus.innerHTML = '<p>Connecting to Actions support...</p>';
    
    try {
      // Get the user's authentication token
      const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      if (!session || !session.access_token) {
        throw new Error('Authentication required. Please log in again.');
      }
      
      // Calculate sobriety days if available
      let daysSober = 0;
      let userName = '';
      
      if (userProfile) {
        // Get user's display name if available
        userName = userProfile.display_name || userProfile.full_name || '';
        
        // Calculate sobriety days
        if (userProfile.sobriety_date) {
          const sobrietyDate = new Date(userProfile.sobriety_date);
          const today = new Date();
          sobrietyDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);

          if (!isNaN(sobrietyDate)) {
            const diffTime = Math.abs(today - sobrietyDate);
            daysSober = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
        }
      }
      
      // Determine API URL based on environment
      // For production, use relative URL; for development, use localhost with port
      const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
      const apiUrl = `${BASE_URL}/api/openai-session`;
      
      console.log('Connecting to API at:', apiUrl);
      
      // Request microphone permission before making the API request
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately, we just needed the permission
        stream.getTracks().forEach(track => track.stop());
        console.log('Microphone permission granted');
      } catch (micError) {
        throw new Error('Microphone access denied. Please allow microphone access to use this feature.');
      }
      
      // Show connecting indicator
      panicCallStatus.innerHTML += '<p>Preparing secure connection...</p>';
      
      // Request a session from our backend
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          call_type: 'panic', // Specify "panic" as the call type
          user_name: userName || 'friend',
          days_sober: daysSober
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Server error: ${errorData.error || response.statusText}`);
      }
      
      const sessionData = await response.json();
      console.log('OpenAI session created:', sessionData);
      
      // Update status to show connection established
      panicCallStatus.innerHTML = '<p>Connected with Actions support.</p>';
      
      // Create transcript container
      const transcriptContainer = document.createElement('div');
      transcriptContainer.className = 'transcript-container';
      panicCallStatus.appendChild(transcriptContainer);
      
      // Display connecting message in transcript
      const connectingMessage = document.createElement('div');
      connectingMessage.className = 'system-message';
      connectingMessage.textContent = 'Starting conversation with Actions support...';
      transcriptContainer.appendChild(connectingMessage);
      
      // Set up WebRTC and audio streaming
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      let mediaStream = null;
      
      // Request microphone access
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone activated for streaming');
      
      // Create and configure audio processor
      // Note: ScriptProcessor is deprecated but still widely compatible
      // In a future update, consider using AudioWorklet instead
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Set up WebSocket connection to OpenAI using the session data
      const wsUrl = new URL('wss://api.openai.com/v1/realtime/sessions');
      wsUrl.searchParams.append('id', sessionData.id);
      wsUrl.searchParams.append('client_secret', sessionData.client_secret);
      
      const ws = new WebSocket(wsUrl.toString());
      
      // Set up chat transcript container
      let currentSpeaker = null;
      let currentMessage = '';
      
      // WebSocket message handling
      ws.onopen = () => {
        console.log('WebSocket connection established');
        
        // Remove connecting message once WebSocket is open
        if (connectingMessage.parentNode) {
          connectingMessage.parentNode.removeChild(connectingMessage);
        }
        
        // Add "listening" indicator
        const listeningIndicator = document.createElement('div');
        listeningIndicator.className = 'listening-indicator';
        listeningIndicator.textContent = 'Listening...';
        transcriptContainer.appendChild(listeningIndicator);
        
        // Send audio from microphone to OpenAI
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && panicCallActive) {
            try {
              const inputData = e.inputBuffer.getChannelData(0);
              const audioData = new Float32Array(inputData);
              const dataToSend = {
                type: 'audio',
                data: Array.from(audioData)
              };
              ws.send(JSON.stringify(dataToSend));
            } catch (audioError) {
              console.error('Error sending audio data:', audioError);
              // Don't throw - continue trying to send audio
            }
          }
        };
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received message:', data);
          
          // Remove listening indicator when first message is received
          const listeningIndicator = transcriptContainer.querySelector('.listening-indicator');
          if (listeningIndicator && (data.type === 'response.audio_transcript.delta' || 
                                    data.type === 'response.output_item.delta')) {
            listeningIndicator.parentNode.removeChild(listeningIndicator);
          }
          
          // Handle different types of messages from OpenAI
          if (data.type === 'response.audio_transcript.delta') {
            // User's speech transcript
            if (data.delta && data.delta.text) {
              if (currentSpeaker !== 'Me') {
                currentSpeaker = 'Me';
                currentMessage = '';
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message user-message';
                messageDiv.innerHTML = `<strong>Me:</strong> <span class="message-content"></span>`;
                transcriptContainer.appendChild(messageDiv);
              }
              
              currentMessage += data.delta.text;
              const lastMessage = transcriptContainer.lastChild;
              if (lastMessage) {
                const messageContent = lastMessage.querySelector('.message-content');
                if (messageContent) messageContent.textContent = currentMessage;
              }
              
              // Save to transcript
              panicTranscript += `Me: ${data.delta.text}\n`;
              
              // Scroll to bottom
              transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
            }
          } else if (data.type === 'response.audio_transcript.done') {
            // User's speech is complete
            currentSpeaker = null;
            panicTranscript += '\n';
          } else if (data.type === 'response.output_item.delta') {
            // AI's response
            if (data.output_item && data.output_item.content && data.output_item.content.text) {
              if (currentSpeaker !== 'AI') {
                currentSpeaker = 'AI';
                currentMessage = '';
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ai-message';
                messageDiv.innerHTML = `<strong>Actions:</strong> <span class="message-content"></span>`;
                transcriptContainer.appendChild(messageDiv);
                
                // Add to transcript with a new line
                panicTranscript += 'Actions: ';
              }
              
              currentMessage += data.output_item.content.text;
              const lastMessage = transcriptContainer.lastChild;
              if (lastMessage) {
                const messageContent = lastMessage.querySelector('.message-content');
                if (messageContent) messageContent.textContent = currentMessage;
              }
              
              // Save to transcript
              panicTranscript += data.output_item.content.text;
              
              // Scroll to bottom
              transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
            }
          } else if (data.type === 'response.output_item.done') {
            // AI's turn is complete
            currentSpeaker = null;
            panicTranscript += '\n\n';
          } else if (data.type === 'response.session.done') {
            // Session has ended
            endPanicCall(ws, mediaStream, processor);
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError, event.data);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = 'Connection error. Please try again later.';
        transcriptContainer.appendChild(errorMsg);
        endPanicCall(ws, mediaStream, processor);
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
        // Only handle unexpected closures
        if (event.code !== 1000) {
          const closeMsg = document.createElement('div');
          closeMsg.className = 'system-message';
          closeMsg.textContent = 'Connection ended unexpectedly. You can try again later.';
          transcriptContainer.appendChild(closeMsg);
        }
        endPanicCall(ws, mediaStream, processor);
      };
      
      // Add an end call button
      const endCallButton = document.createElement('button');
      endCallButton.textContent = 'End Call';
      endCallButton.className = 'button button-secondary';
      endCallButton.onclick = () => {
        endPanicCall(ws, mediaStream, processor);
      };
      panicCallStatus.appendChild(endCallButton);
      
    } catch (error) {
      console.error('Error in panic call:', error);
      panicCallStatus.innerHTML += `<p class="error">Error: ${error.message}</p>`;
      panicCallActive = false;
    }
  }
}

// Helper function to end the panic call
async function endPanicCall(websocket, mediaStream, audioProcessor) {
  if (!panicCallActive) return;
  
  panicCallActive = false;
  
  try {
    // Close WebSocket if it's open
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      // Send a clean close message
      websocket.close(1000, "User ended call");
    }
    
    // Stop the audio processor
    if (audioProcessor) {
      try {
        audioProcessor.disconnect();
      } catch (e) {
        console.warn('Error disconnecting audio processor:', e);
      }
    }
    
    // Stop all media tracks
    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn('Error stopping media tracks:', e);
      }
    }
    
    const panicCallStatus = document.getElementById('panic-call-status');
    if (panicCallStatus) {
      const endMessage = document.createElement('div');
      endMessage.className = 'end-call-message';
      endMessage.innerHTML = '<p>Call ended. Remember you have the strength within you. We\'re here whenever you need us.</p>';
      panicCallStatus.appendChild(endMessage);
    }
    
    // Save panic session to database if we have a transcript
    if (panicTranscript.trim()) {
      try {
        const { data, error } = await _supabase
          .from('panic_sessions')
          .insert({
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
            transcript: panicTranscript.trim()
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error saving panic session to database:', error);
        } else {
          console.log('Actions support session saved:', data);
        }
      } catch (err) {
        console.error('Exception saving Actions support session:', err);
      }
    } else {
      console.log('No transcript to save - call likely ended before conversation started');
    }
    
  } catch (finalError) {
    console.error('Error during panic call cleanup:', finalError);
  }
}

function exitPanicMode() {
  if (panicCallActive) {
    if (!confirm('Are you sure you want to end the emergency call?')) {
      return;
    }
    panicCallActive = false;
  }
  
  // Return to previous view or default to journal
  showJournalView();
}

// --- Load User Profile ---
async function loadUserProfile() {
  if (!currentUser) return;

  console.log("Loading user profile...");
  if (profileStatus) profileStatus.textContent = 'Loading profile...';
  if (sobrietyDateInput) sobrietyDateInput.value = ''; 
  userProfile = null;

  try {
    const { data, error, status } = await _supabase
      .from('profiles')
      .select(`sobriety_date`)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error && status !== 406) {
      throw error;
    }

    if (data) {
      console.log("Profile data received:", data);
      userProfile = data;
      
      if (data.sobriety_date) {
        if (sobrietyDateInput) {
          sobrietyDateInput.value = data.sobriety_date;
        }
        
        // Calculate days sober
        const sobrietyDate = new Date(data.sobriety_date);
        const today = new Date();
        sobrietyDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (!isNaN(sobrietyDate)) {
          const diffTime = Math.abs(today - sobrietyDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const daysText = `${diffDays} days`;
          
          // Update all day counters
          if (daysCount) daysCount.textContent = daysText;
          document.querySelectorAll('[id$="days-count"]').forEach(el => {
            if (el) el.textContent = daysText;
          });
        }
        
        if (profileStatus) profileStatus.textContent = 'Profile loaded.';
      } else {
        if (profileStatus) profileStatus.textContent = 'Set your recovery start date.';
      }
    } else {
      console.log("No profile found for user.");
      if (profileStatus) profileStatus.textContent = 'Set your recovery start date.';
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
    if (profileStatus) profileStatus.textContent = 'Error loading profile.';
    userProfile = null;
  }
}

// --- Save User Profile ---
async function saveUserProfile() {
  if (!currentUser || !sobrietyDateInput) return;

  const sobrietyDate = sobrietyDateInput.value;
  if (!sobrietyDate || isNaN(new Date(sobrietyDate))) {
    if(profileStatus) profileStatus.textContent = 'Please enter a valid date.';
    return;
  }

  console.log(`Saving sobriety date: ${sobrietyDate} for user: ${currentUser.id}`);
  if(profileStatus) profileStatus.textContent = 'Saving...';

  try {
    const { error } = await _supabase
      .from('profiles')
      .upsert({ 
        user_id: currentUser.id,
        sobriety_date: sobrietyDate,
        updated_at: new Date()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
    }

    console.log("Profile saved successfully.");
    if(profileStatus) profileStatus.textContent = 'Date saved successfully!';
    await loadUserProfile(); 

  } catch (error) {
    console.error('Error saving user profile:', error);
    if(profileStatus) profileStatus.textContent = 'Error saving date.';
  }
}

// --- Journal Entries ---
async function loadJournalEntries() {
  if (!currentUser) {
    console.error('User not logged in');
    return;
  }
  
  // Clear existing entries
  const journalList = document.getElementById('journalList');
  journalList.innerHTML = '';
  
  try {
    // Fetch morning check-ins
    const { data: morningCheckins, error: morningError } = await _supabase
      .from('daily_check_ins')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (morningError) throw morningError;
    
    // Fetch evening reviews
    const { data: eveningReviews, error: eveningError } = await _supabase
      .from('evening_reviews')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (eveningError) throw eveningError;
    
    // Fetch panic sessions
    const { data: panicSessions, error: panicError } = await _supabase
      .from('panic_sessions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (panicError) throw panicError;
    
    if ((!morningCheckins || morningCheckins.length === 0) && 
        (!eveningReviews || eveningReviews.length === 0) && 
        (!panicSessions || panicSessions.length === 0)) {
      journalList.innerHTML = '<div class="empty-list">No journal entries yet. Complete your daily check-ins to see them here.</div>';
      return;
    }
    
    // Group entries by date
    const entriesByDate = {};
    
    // Process morning check-ins
    if (morningCheckins && morningCheckins.length > 0) {
      morningCheckins.forEach(entry => {
        // Extract date part only (without time)
        const entryDate = (entry.date) ? 
          entry.date : 
          new Date(entry.created_at).toISOString().split('T')[0];
        
        if (!entriesByDate[entryDate]) {
          entriesByDate[entryDate] = {
            journal: {
              morning: null,
              evening: null
            },
            panicSessions: []
          };
        }
        
        // Store as morning entry
        entriesByDate[entryDate].journal.morning = entry;
      });
    }
    
    // Process evening reviews
    if (eveningReviews && eveningReviews.length > 0) {
      eveningReviews.forEach(entry => {
        // Extract date part only (without time)
        const entryDate = (entry.date) ? 
          entry.date : 
          new Date(entry.created_at).toISOString().split('T')[0];
        
        if (!entriesByDate[entryDate]) {
          entriesByDate[entryDate] = {
            journal: {
              morning: null,
              evening: null
            },
            panicSessions: []
          };
        }
        
        entriesByDate[entryDate].journal.evening = entry;
      });
    }
    
    // Process panic sessions
    if (panicSessions && panicSessions.length > 0) {
      panicSessions.forEach(session => {
        // Extract date part only (without time)
        const entryDate = new Date(session.created_at).toISOString().split('T')[0];
        
        if (!entriesByDate[entryDate]) {
          entriesByDate[entryDate] = {
            journal: {
              morning: null,
              evening: null
            },
            panicSessions: []
          };
        }
        
        entriesByDate[entryDate].panicSessions.push(session);
      });
    }
    
    // Create HTML elements for each date's entries
    Object.keys(entriesByDate).sort().reverse().forEach(date => {
      const dateData = entriesByDate[date];
      const entryDate = new Date(date);
      
      // Format the date like "April 21, 2025"
      const formattedDate = entryDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      
      // Create the journal item container
      const journalItem = document.createElement('div');
      journalItem.className = 'journal-item';
      
      // Create date header
      const dateHeader = document.createElement('div');
      dateHeader.className = 'date-header';
      dateHeader.textContent = formattedDate;
      journalItem.appendChild(dateHeader);
      
      // Create a single content container for the entire day
      const entryContent = document.createElement('div');
      entryContent.className = 'entry-content';
      
      // Add morning check-in content if available
      if (dateData.journal.morning) {
        const morningEntry = createMorningEntry(dateData.journal.morning);
        if (morningEntry) {
          entryContent.appendChild(morningEntry);
        }
      }
      
      // Add evening review content if available
      if (dateData.journal.evening) {
        const eveningEntry = createEveningEntry(dateData.journal.evening, dateData.journal.morning);
        if (eveningEntry) {
          entryContent.appendChild(eveningEntry);
        }
      }
      
      // Add panic sessions if any exist for this date
      if (dateData.panicSessions && dateData.panicSessions.length > 0) {
        const panicSection = createPanicSection(dateData.panicSessions);
        if (panicSection) {
          entryContent.appendChild(panicSection);
        }
      }
      
      journalItem.appendChild(entryContent);
      
      // Add delete button
      const entryActions = document.createElement('div');
      entryActions.className = 'entry-actions';
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-entry-button';
      deleteButton.textContent = 'Delete Entry';
      deleteButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) {
          try {
            // Delete morning check-in if it exists
            if (dateData.journal.morning) {
              const { error: morningDeleteError } = await _supabase
                .from('daily_check_ins')
                .delete()
                .eq('id', dateData.journal.morning.id);
              
              if (morningDeleteError) throw morningDeleteError;
            }
            
            // Delete evening review if it exists
            if (dateData.journal.evening) {
              const { error: eveningDeleteError } = await _supabase
                .from('evening_reviews')
                .delete()
                .eq('id', dateData.journal.evening.id);
              
              if (eveningDeleteError) throw eveningDeleteError;
            }
            
            // Delete panic sessions for the date if they exist
            const panicSessionIds = dateData.panicSessions.map(session => session.id);
            if (panicSessionIds.length > 0) {
              const { error: panicDeleteError } = await _supabase
                .from('panic_sessions')
                .delete()
                .in('id', panicSessionIds);
              
              if (panicDeleteError) throw panicDeleteError;
            }
            
            // Remove from the DOM after successful deletion
            journalItem.remove();
            showMessage('Journal entry deleted successfully');
          } catch (error) {
            console.error('Error deleting journal entry:', error);
            showMessage('Failed to delete journal entry', 'error');
          }
        }
      });
      
      entryActions.appendChild(deleteButton);
      journalItem.appendChild(entryActions);
      
      // Add the journal item to the list
      journalList.appendChild(journalItem);
    });
  } catch (error) {
    console.error('Error loading journal entries:', error);
    showMessage('Failed to load journal entries', 'error');
  }
}

// Helper function to create morning entry section
function createMorningEntry(morningData) {
  if (!morningData) return null;
  
  const morningSection = document.createElement('div');
  morningSection.className = 'journal-section morning-section collapsible collapsed';
  
  // Morning header with sun icon and time
  const morningHeader = document.createElement('div');
  morningHeader.className = 'section-time';
  const morningTime = new Date(morningData.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  
  // Create span for icon and text to ensure they align properly
  const iconTextSpan = document.createElement('span');
  iconTextSpan.className = 'icon-text-wrapper';
  iconTextSpan.innerHTML = `<span class="section-icon">☀️</span><span class="section-title">Morning Check-in</span>`;
  
  // Add all elements to header
  morningHeader.appendChild(iconTextSpan);
  
  const collapseToggle = document.createElement('span');
  collapseToggle.className = 'collapse-toggle';
  collapseToggle.textContent = '▼';
  morningHeader.appendChild(collapseToggle);
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = morningTime;
  morningHeader.appendChild(timeSpan);
  
  morningSection.appendChild(morningHeader);
  
  // Create morning content container
  const morningContent = document.createElement('div');
  morningContent.className = 'section-content';
  
  // Add mood if it exists
  if (morningData.current_mood) {
    const moodElement = document.createElement('div');
    moodElement.className = 'mood-entry';
    
    // Determine mood category and color
    const moodCategory = getMoodCategory(morningData.current_mood);
    const moodIndicator = document.createElement('span');
    moodIndicator.className = `mood-indicator mood-${moodCategory}`;
    
    moodElement.innerHTML = `
      <span class="mood-label">Mood:</span>
      <span class="mood-value">
        ${moodIndicator.outerHTML}
        ${morningData.current_mood}
      </span>
    `;
    morningContent.appendChild(moodElement);
  }
  
  // Add gratitude list if it exists
  if (morningData.gratitude_list && morningData.gratitude_list.length > 0) {
    const gratitudeSection = document.createElement('div');
    gratitudeSection.className = 'journal-subsection';
    
    const gratitudeTitle = document.createElement('div');
    gratitudeTitle.className = 'subsection-title';
    gratitudeTitle.innerHTML = '<span class="subsection-icon">💖</span> Gratitude';
    gratitudeSection.appendChild(gratitudeTitle);
    
    const gratitudeList = document.createElement('ul');
    gratitudeList.className = 'gratitude-list';
    
    morningData.gratitude_list.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      gratitudeList.appendChild(listItem);
    });
    
    gratitudeSection.appendChild(gratitudeList);
    morningContent.appendChild(gratitudeSection);
  }
  
  // Add general plan
  if (morningData.general_plan) {
    const planSection = document.createElement('div');
    planSection.className = 'journal-subsection';
    
    const planTitle = document.createElement('div');
    planTitle.className = 'subsection-title';
    planTitle.innerHTML = '<span class="subsection-icon">📝</span> Plan';
    planSection.appendChild(planTitle);
    
    const planText = document.createElement('div');
    planText.className = 'plan-text';
    planText.textContent = morningData.general_plan;
    planSection.appendChild(planText);
    
    morningContent.appendChild(planSection);
  }
  
  // Add watch-for items
  if (morningData.watch_for_items && morningData.watch_for_items.length > 0) {
    const watchForSection = document.createElement('div');
    watchForSection.className = 'journal-subsection';
    
    const watchForTitle = document.createElement('div');
    watchForTitle.className = 'subsection-title';
    watchForTitle.innerHTML = '<span class="subsection-icon">👀</span> Watch For';
    watchForSection.appendChild(watchForTitle);
    
    const watchForList = document.createElement('ul');
    watchForList.className = 'watch-for-list';
    
    morningData.watch_for_items.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      watchForList.appendChild(listItem);
    });
    
    watchForSection.appendChild(watchForList);
    morningContent.appendChild(watchForSection);
  }
  
  // Add strive-for items
  if (morningData.strive_for_items && morningData.strive_for_items.length > 0) {
    const striveForSection = document.createElement('div');
    striveForSection.className = 'journal-subsection';
    
    const striveForTitle = document.createElement('div');
    striveForTitle.className = 'subsection-title';
    striveForTitle.innerHTML = '<span class="subsection-icon">⭐</span> Strive For';
    striveForSection.appendChild(striveForTitle);
    
    const striveForList = document.createElement('ul');
    striveForList.className = 'strive-for-list';
    
    morningData.strive_for_items.forEach(item => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      striveForList.appendChild(listItem);
    });
    
    striveForSection.appendChild(striveForList);
    morningContent.appendChild(striveForSection);
  }
  
  morningSection.appendChild(morningContent);
  
  // Update click event handler to reference the toggle in the new location
  morningSection.addEventListener('click', function(e) {
    // Don't collapse if clicking on a link or interactive element
    if (e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    
    // Toggle collapsed class if clicking on header or toggle
    if (e.target === morningSection || e.target === morningHeader || 
        e.target.closest('.section-time') || e.target.classList.contains('section-icon') ||
        e.target.classList.contains('collapse-toggle') || e.target.classList.contains('section-title') ||
        e.target.closest('.icon-text-wrapper')) {
      morningSection.classList.toggle('collapsed');
      e.stopPropagation();
    }
  });
  
  return morningSection;
}

// Helper function to create evening entry section
function createEveningEntry(eveningData, morningData) {
  if (!eveningData) return null;
  
  const eveningSection = document.createElement('div');
  eveningSection.className = 'journal-section evening-section collapsible collapsed';
  
  // Evening header with moon icon and time
  const eveningHeader = document.createElement('div');
  eveningHeader.className = 'section-time';
  const eveningTime = new Date(eveningData.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  
  // Create span for icon and text to ensure they align properly
  const iconTextSpan = document.createElement('span');
  iconTextSpan.className = 'icon-text-wrapper';
  iconTextSpan.innerHTML = `<span class="section-icon">🌙</span><span class="section-title">Evening Check-in</span>`;
  
  // Add all elements to header
  eveningHeader.appendChild(iconTextSpan);
  
  const collapseToggle = document.createElement('span');
  collapseToggle.className = 'collapse-toggle';
  collapseToggle.textContent = '▼';
  eveningHeader.appendChild(collapseToggle);
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = eveningTime;
  eveningHeader.appendChild(timeSpan);
  
  eveningSection.appendChild(eveningHeader);
  
  // Create evening content container
  const eveningContent = document.createElement('div');
  eveningContent.className = 'section-content';
  
  // Add 10th step if it exists
  if (eveningData.tenth_step) {
    const tenthStepSection = document.createElement('div');
    tenthStepSection.className = 'journal-subsection';
    
    const tenthStepTitle = document.createElement('div');
    tenthStepTitle.className = 'subsection-title';
    tenthStepTitle.textContent = '10th Step Inventory';
    tenthStepSection.appendChild(tenthStepTitle);
    
    const tenthStepData = eveningData.tenth_step;
    
    // Create an inventory list
    const inventoryList = document.createElement('div');
    inventoryList.className = 'inventory-list';
    
    // Handle harm_anyone question
    if (tenthStepData.harm_anyone) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      
      const icon = document.createElement('span');
      icon.className = tenthStepData.harm_anyone.answer ? 'inventory-icon negative' : 'inventory-icon positive';
      icon.innerHTML = tenthStepData.harm_anyone.answer ? 'Yes' : 'No';
      
      const question = document.createElement('div');
      question.className = 'inventory-question';
      question.textContent = 'Did I harm anyone today?';
      
      item.appendChild(icon);
      item.appendChild(question);
      inventoryList.appendChild(item);
      
      // Add notes if available
      if (tenthStepData.harm_anyone.answer && tenthStepData.harm_anyone.reflection) {
        const notes = document.createElement('div');
        notes.className = 'inventory-notes';
        notes.innerHTML = `<span class="notes-label">Notes:</span> ${tenthStepData.harm_anyone.reflection}`;
        inventoryList.appendChild(notes);
      }
    }
    
    // Handle resentment question
    if (tenthStepData.resentment) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      
      const icon = document.createElement('span');
      icon.className = tenthStepData.resentment.answer ? 'inventory-icon negative' : 'inventory-icon positive';
      icon.innerHTML = tenthStepData.resentment.answer ? 'Yes' : 'No';
      
      const question = document.createElement('div');
      question.className = 'inventory-question';
      question.textContent = 'Did I experience resentment today?';
      
      item.appendChild(icon);
      item.appendChild(question);
      inventoryList.appendChild(item);
      
      // Add notes if available
      if (tenthStepData.resentment.answer && tenthStepData.resentment.reflection) {
        const notes = document.createElement('div');
        notes.className = 'inventory-notes';
        notes.innerHTML = `<span class="notes-label">Notes:</span> ${tenthStepData.resentment.reflection}`;
        inventoryList.appendChild(notes);
      }
    }
    
    // Handle fear_anxiety question
    if (tenthStepData.fear_anxiety) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      
      const icon = document.createElement('span');
      icon.className = tenthStepData.fear_anxiety.answer ? 'inventory-icon negative' : 'inventory-icon positive';
      icon.innerHTML = tenthStepData.fear_anxiety.answer ? 'Yes' : 'No';
      
      const question = document.createElement('div');
      question.className = 'inventory-question';
      question.textContent = 'Did I experience fear or anxiety today?';
      
      item.appendChild(icon);
      item.appendChild(question);
      inventoryList.appendChild(item);
      
      // Add notes if available
      if (tenthStepData.fear_anxiety.answer && tenthStepData.fear_anxiety.reflection) {
        const notes = document.createElement('div');
        notes.className = 'inventory-notes';
        notes.innerHTML = `<span class="notes-label">Notes:</span> ${tenthStepData.fear_anxiety.reflection}`;
        inventoryList.appendChild(notes);
      }
    }
    
    // Handle selfish question
    if (tenthStepData.selfish) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      
      const icon = document.createElement('span');
      icon.className = tenthStepData.selfish.answer ? 'inventory-icon negative' : 'inventory-icon positive';
      icon.innerHTML = tenthStepData.selfish.answer ? 'Yes' : 'No';
      
      const question = document.createElement('div');
      question.className = 'inventory-question';
      question.textContent = 'Did I act selfishly today?';
      
      item.appendChild(icon);
      item.appendChild(question);
      inventoryList.appendChild(item);
      
      // Add notes if available
      if (tenthStepData.selfish.answer && tenthStepData.selfish.reflection) {
        const notes = document.createElement('div');
        notes.className = 'inventory-notes';
        notes.innerHTML = `<span class="notes-label">Notes:</span> ${tenthStepData.selfish.reflection}`;
        inventoryList.appendChild(notes);
      }
    }
    
    // Handle apology question
    if (tenthStepData.apology) {
      const item = document.createElement('div');
      item.className = 'inventory-item';
      
      const icon = document.createElement('span');
      icon.className = tenthStepData.apology.answer ? 'inventory-icon negative' : 'inventory-icon positive';
      icon.innerHTML = tenthStepData.apology.answer ? 'Yes' : 'No';
      
      const question = document.createElement('div');
      question.className = 'inventory-question';
      question.textContent = 'Do I owe anyone an apology?';
      
      item.appendChild(icon);
      item.appendChild(question);
      inventoryList.appendChild(item);
      
      // Add notes if available
      if (tenthStepData.apology.answer && tenthStepData.apology.reflection) {
        const notes = document.createElement('div');
        notes.className = 'inventory-notes';
        notes.innerHTML = `<span class="notes-label">Notes:</span> ${tenthStepData.apology.reflection}`;
        inventoryList.appendChild(notes);
      }
    }
    
    tenthStepSection.appendChild(inventoryList);
    eveningContent.appendChild(tenthStepSection);
  }
  
  // Add action items review if they exist
  if (morningData && (
      (morningData.watch_for_items && morningData.watch_for_items.length > 0) || 
      (morningData.strive_for_items && morningData.strive_for_items.length > 0)
    )) {
    
    const actionItemsSection = document.createElement('div');
    actionItemsSection.className = 'journal-subsection';
    
    const actionItemsTitle = document.createElement('div');
    actionItemsTitle.className = 'subsection-title';
    actionItemsTitle.innerHTML = '<span class="subsection-icon">📋</span> Action Items Review';
    actionItemsSection.appendChild(actionItemsTitle);
    
    // Collect all action items
    const allItems = [];
    
    if (morningData.watch_for_items) {
      morningData.watch_for_items.forEach(item => {
        allItems.push({
          text: item,
          type: 'watch-for',
          completed: false
        });
      });
    }
    
    if (morningData.strive_for_items) {
      morningData.strive_for_items.forEach(item => {
        allItems.push({
          text: item,
          type: 'strive-for',
          completed: false
        });
      });
    }
    
    // Mark items as completed if they're in the completed_actions list
    if (eveningData.completed_actions && eveningData.completed_actions.length > 0) {
      allItems.forEach(item => {
        if (eveningData.completed_actions.includes(item.text)) {
          item.completed = true;
        }
      });
    }
    
    // Calculate completion percentage
    const totalItems = allItems.length;
    const completedItems = allItems.filter(item => item.completed).length;
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    
    // Add progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.dataset.entryId = eveningData.id;
    
    const progressLabel = document.createElement('div');
    progressLabel.className = 'progress-label';
    progressLabel.innerHTML = `
      <span>Completed: <span class="completed-count">${completedItems}</span>/${totalItems}</span>
      <span class="completion-percentage">${completionPercentage}%</span>
    `;
    progressContainer.appendChild(progressLabel);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = `${completionPercentage}%`;
    progressBar.appendChild(progressFill);
    
    progressContainer.appendChild(progressBar);
    actionItemsSection.appendChild(progressContainer);
    
    // Create list items
    const actionItemsList = document.createElement('div');
    actionItemsList.className = 'action-items-list';
    
    allItems.forEach(item => {
      const actionItem = document.createElement('div');
      actionItem.className = 'action-item-review';
      actionItem.dataset.text = item.text;
      actionItem.dataset.entryId = eveningData.id;
      
      const itemIcon = document.createElement('span');
      if (item.completed) {
        itemIcon.className = 'action-icon completed';
        itemIcon.innerHTML = '●';
      } else {
        itemIcon.className = 'action-icon not-completed';
        itemIcon.innerHTML = '○';
      }
      
      const itemText = document.createElement('div');
      itemText.className = 'action-text';
      itemText.textContent = item.text;
      
      actionItem.appendChild(itemIcon);
      actionItem.appendChild(itemText);
      
      // Make the action item clickable to toggle completion
      actionItem.addEventListener('click', async function() {
        // Get the current completion state
        const isCompleted = itemIcon.classList.contains('completed');
        
        // Toggle the visual state first for immediate feedback
        if (isCompleted) {
          itemIcon.className = 'action-icon not-completed';
          itemIcon.innerHTML = '○';
        } else {
          itemIcon.className = 'action-icon completed';
          itemIcon.innerHTML = '●';
        }
        
        try {
          // Fetch the current evening review
          const { data: reviewData, error: fetchError } = await _supabase
            .from('evening_reviews')
            .select('completed_actions')
            .eq('id', eveningData.id)
            .single();
            
          if (fetchError) throw fetchError;
          
          // Update the completed_actions array
          let completedActions = reviewData.completed_actions || [];
          
          if (isCompleted) {
            // If it was completed, now we're removing it
            completedActions = completedActions.filter(action => action !== item.text);
          } else {
            // If it wasn't completed, now we're adding it
            if (!completedActions.includes(item.text)) {
              completedActions.push(item.text);
            }
          }
          
          // Update the database
          const { error: updateError } = await _supabase
            .from('evening_reviews')
            .update({ completed_actions: completedActions })
            .eq('id', eveningData.id);
            
          if (updateError) throw updateError;
          
          // Update the progress counter
          const newCompletedCount = completedActions.length;
          const newPercentage = Math.round((newCompletedCount / totalItems) * 100);
          
          const progressEl = actionItem.closest('.journal-subsection').querySelector('.progress-container');
          progressEl.querySelector('.completed-count').textContent = newCompletedCount;
          progressEl.querySelector('.completion-percentage').textContent = newPercentage + '%';
          progressEl.querySelector('.progress-fill').style.width = `${newPercentage}%`;
          
        } catch (error) {
          console.error('Error updating action item:', error);
          // Revert the visual change if there was an error
          if (isCompleted) {
            itemIcon.className = 'action-icon completed';
            itemIcon.innerHTML = '●';
          } else {
            itemIcon.className = 'action-icon not-completed';
            itemIcon.innerHTML = '○';
          }
        }
      });
      
      actionItemsList.appendChild(actionItem);
    });
    
    actionItemsSection.appendChild(actionItemsList);
    eveningContent.appendChild(actionItemsSection);
  }
  
  eveningSection.appendChild(eveningContent);
  
  // Update click event handler to reference the toggle in the new location
  eveningSection.addEventListener('click', function(e) {
    // Don't collapse if clicking on a link or interactive element
    if (e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('input') || 
        e.target.closest('.action-item-review')) {
      return;
    }
    
    // Toggle collapsed class if clicking on header or toggle
    if (e.target === eveningSection || e.target === eveningHeader || 
        e.target.closest('.section-time') || e.target.classList.contains('section-icon') ||
        e.target.classList.contains('collapse-toggle') || e.target.classList.contains('section-title') ||
        e.target.closest('.icon-text-wrapper')) {
      eveningSection.classList.toggle('collapsed');
      e.stopPropagation();
    }
  });
  
  return eveningSection;
}

// Helper function to determine mood category based on text
function getMoodCategory(mood) {
  if (!mood) return 'neutral';
  
  mood = mood.toLowerCase();
  
  // Positive moods
  if (mood.includes('grateful') || 
      mood.includes('happy') || 
      mood.includes('peace') || 
      mood.includes('content') || 
      mood.includes('hopeful')) {
    return 'positive';
  }
  
  // Negative moods
  if (mood.includes('anxious') || 
      mood.includes('frustrated') || 
      mood.includes('worried') || 
      mood.includes('overwhelmed') || 
      mood.includes('angry')) {
    return 'negative';
  }
  
  // Calm moods
  if (mood.includes('calm') || 
      mood.includes('relaxed') || 
      mood.includes('at peace')) {
    return 'calm';
  }
  
  // Energetic moods
  if (mood.includes('energetic') || 
      mood.includes('motivated') || 
      mood.includes('excited')) {
    return 'energetic';
  }
  
  // Default
  return 'neutral';
}

// Helper function to create panic session section
function createPanicSection(panicSessions) {
  if (!panicSessions || panicSessions.length === 0) return null;
  
  const panicSection = document.createElement('div');
  panicSection.className = 'journal-section panic-section collapsible collapsed';
  
  // Panic header with warning icon
  const panicHeader = document.createElement('div');
  panicHeader.className = 'section-header';
  
  // Create span for icon and text to ensure they align properly
  const iconTextSpan = document.createElement('span');
  iconTextSpan.className = 'icon-text-wrapper';
  iconTextSpan.innerHTML = `<span class="section-icon">⚠️</span><span class="section-title">Panic Mode Sessions</span>`;
  
  // Add all elements to header
  panicHeader.appendChild(iconTextSpan);
  
  const collapseToggle = document.createElement('span');
  collapseToggle.className = 'collapse-toggle';
  collapseToggle.textContent = '▼';
  panicHeader.appendChild(collapseToggle);
  
  panicSection.appendChild(panicHeader);
  
  // Create panic content container
  const panicContent = document.createElement('div');
  panicContent.className = 'section-content';
  
  panicSessions.forEach((session, index) => {
    const panicEntry = document.createElement('div');
    panicEntry.className = 'panic-entry';
    
    const panicTime = new Date(session.created_at).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    
    const panicTitle = document.createElement('div');
    panicTitle.className = 'panic-title';
    panicTitle.textContent = `Session ${index + 1} - ${panicTime}`;
    panicEntry.appendChild(panicTitle);
    
    if (session.transcript) {
      const transcript = document.createElement('div');
      transcript.className = 'journal-transcript';
      transcript.textContent = session.transcript;
      panicEntry.appendChild(transcript);
    }
    
    panicContent.appendChild(panicEntry);
  });
  
  panicSection.appendChild(panicContent);
  
  // Add click event for collapsing/expanding
  panicSection.addEventListener('click', function(e) {
    // Don't collapse if clicking on a link or interactive element
    if (e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    
    // Toggle collapsed class if clicking on header or toggle
    if (e.target === panicSection || e.target === panicHeader || 
        e.target.closest('.section-header') || e.target.classList.contains('section-icon') ||
        e.target.classList.contains('collapse-toggle') || e.target.classList.contains('section-title') ||
        e.target.closest('.icon-text-wrapper')) {
      panicSection.classList.toggle('collapsed');
      e.stopPropagation();
    }
  });
  
  return panicSection;
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded. Attaching event listeners...');
  
  // Auth Listeners
  if (loginButton) {
    loginButton.addEventListener('click', async () => {
      console.log('Login button clicked');
      const { data, error } = await _supabase.auth.signInWithOAuth({ 
        provider: 'google'
      });
      if (error) {
        console.error('Error starting Google sign-in:', error);
        alert('Error starting sign-in: ' + error.message);
      }
    });
  }
  
  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      console.log('Logout button clicked');
      const { error } = await _supabase.auth.signOut();
      if (error) {
        console.error('Error logging out:', error);
        alert('Error logging out: ' + error.message);
      } else {
        console.log('SignOut command sent successfully.');
      }
    });
  }
  
  // Navigation
  if (historyBtn) {
    historyBtn.addEventListener('click', showJournalView);
  }
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showProfileView);
  }
  
  if (editDaysBtn) {
    editDaysBtn.addEventListener('click', showProfileView);
  }
  
  if (panicModeBtn) {
    panicModeBtn.addEventListener('click', showPanicMode);
  }
  
  // Morning Check-in Form
  if (addGratitudeBtn) {
    addGratitudeBtn.addEventListener('click', addGratitudeItem);
  }
  
  if (gratitudeInput) {
    gratitudeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addGratitudeItem();
      }
    });
  }
  
  if (addWatchForBtn) {
    addWatchForBtn.addEventListener('click', addWatchForItem);
  }
  
  if (watchForInput) {
    watchForInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWatchForItem();
      }
    });
  }
  
  if (addStriveForBtn) {
    addStriveForBtn.addEventListener('click', addStriveForItem);
  }
  
  if (striveForInput) {
    striveForInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addStriveForItem();
      }
    });
  }
  
  // Remove items
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-item')) {
      e.target.closest('.list-item').remove();
    }
  });
  
  // Mood selection
  moodButtons.forEach(button => {
    button.addEventListener('click', handleMoodSelection);
  });
  
  if (customMood) {
    customMood.addEventListener('input', handleCustomMood);
  }
  
  // Form submission
  if (morningForm) {
    morningForm.addEventListener('submit', submitMorningCheckin);
  }
  
  // View switching
  if (switchToEveningBtn) {
    switchToEveningBtn.addEventListener('click', showEveningReview);
  }
  
  if (switchToEveningCompletedBtn) {
    switchToEveningCompletedBtn.addEventListener('click', showEveningReview);
  }
  
  if (editCheckinBtn) {
    editCheckinBtn.addEventListener('click', showMorningForm);
  }
  
  // Tab switching
  if (dailyReviewTab) {
    dailyReviewTab.addEventListener('click', showDailyReviewTab);
  }
  
  if (tenthStepTab) {
    tenthStepTab.addEventListener('click', showTenthStepTab);
  }
  
  if (continueToTenthStep) {
    continueToTenthStep.addEventListener('click', showTenthStepTab);
  }
  
  // 10th Step Toggle Buttons
  toggleButtons.forEach(button => {
    button.addEventListener('click', handleToggleButton);
  });
  
  // 10th Step Form Submission
  if (tenthStepForm) {
    tenthStepForm.addEventListener('submit', submitEveningReview);
  }
  
  // Panic Mode
  if (startPanicCallBtn) {
    startPanicCallBtn.addEventListener('click', startPanicCall);
  }
  
  if (exitPanicModeBtn) {
    exitPanicModeBtn.addEventListener('click', exitPanicMode);
  }
  
  // Profile
  if (saveProfileButton) {
    saveProfileButton.addEventListener('click', saveUserProfile);
  }
  
  // Journal Entry Deletion and Toggle
  if (journalEntriesContainer) {
    journalEntriesContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-entry-button')) {
        const entryId = e.target.dataset.entryId;
        const entryType = e.target.dataset.entryType || 'morning';
        deleteJournalEntry(entryId, entryType);
      } else if (e.target.closest('.journal-item') && !e.target.closest('.delete-entry-button')) {
        // Handle entry click for expanding/viewing details
        const entryItem = e.target.closest('.journal-item');
        // Toggle active class for styling
        entryItem.classList.toggle('active');
        
        // You could implement showing more details here
      }
    });
  }
});
