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
  const authSection = document.getElementById('auth-section');
  const mainContent = document.getElementById('main-content');
  const progressSection = document.getElementById('progress-section');
  const userNameDisplay = document.getElementById('user-name');

  if (user) {
    // User is signed in
    if (authSection) authSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (progressSection) progressSection.style.display = 'block';
    if (userNameDisplay) userNameDisplay.textContent = user.displayName || user.email;
    
    // Hide all content views by default - let the user choose what to view
    document.getElementById('morning-checkin-form').style.display = 'none';
    document.getElementById('tenth-step-view').style.display = 'none';
    document.getElementById('journal-view').style.display = 'none';
    document.getElementById('profile-view').style.display = 'none';
    document.getElementById('panic-mode-view').style.display = 'none';
    
    // Update sobriety days display
    updateSobrietyDaysDisplay();
    
    // Load user profile
    loadUserProfile();
  } else {
    // No user is signed in
    if (authSection) authSection.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (progressSection) progressSection.style.display = 'none';
    if (userNameDisplay) userNameDisplay.textContent = '';
    
    // Clear any input fields or status messages
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
      if (input.type !== 'button' && input.type !== 'submit') {
        input.value = '';
      }
    });
    
    document.querySelectorAll('textarea').forEach(textarea => {
      textarea.value = '';
    });
    
    document.querySelectorAll('.status-message').forEach(message => {
      message.textContent = '';
    });
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
  console.log("submitMorningCheckin called");
  
  // Get form data
  const gratitudeItems = Array.from(document.getElementById('gratitude-items').children).map(item => item.querySelector('.list-item-text').textContent.trim());
  const generalPlan = document.getElementById('general-plan').value;
  const mood = document.getElementById('selected-mood').value;
  const watchForItems = Array.from(document.getElementById('watch-for-items').children).map(item => item.querySelector('.list-item-text').textContent.trim());
  const striveForItems = Array.from(document.getElementById('strive-for-items').children).map(item => item.querySelector('.list-item-text').textContent.trim());
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get current user
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      throw new Error('You need to be logged in');
    }
    
    // Check if entry already exists
    const { data: existingEntry } = await _supabase
      .from('daily_check_ins')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    
    let resultMessage = "";
    
    if (existingEntry) {
      // Update existing entry
      const { error } = await _supabase
        .from('daily_check_ins')
        .update({
          gratitude_list: gratitudeItems,
          general_plan: generalPlan,
          current_mood: mood,
          watch_for_items: watchForItems,
          strive_for_items: striveForItems
          // Removed updated_at as it's not in the schema
        })
        .eq('id', existingEntry.id);
      
      if (error) throw error;
      resultMessage = 'Morning check-in updated!';
    } else {
      // Create new entry
      const { error } = await _supabase
        .from('daily_check_ins')
        .insert({
          user_id: user.id,
          date: today,
          gratitude_list: gratitudeItems,
          general_plan: generalPlan,
          current_mood: mood,
          watch_for_items: watchForItems,
          strive_for_items: striveForItems
        });
      
      if (error) throw error;
      resultMessage = 'Morning check-in saved!';
    }
    
    // Show only one notification
    console.log("Showing notification:", resultMessage);
    showNotification(resultMessage, 'success');
    
    // Update progress
    updateProgressAfterMorningCheckIn();
    
    // Close the modal
    closeModal('morning-checkin-modal');
  } catch (error) {
    console.error('Error saving morning check-in:', error);
    alert('Error saving check-in: ' + error.message);
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
    panicCallStatus.innerHTML = '<h3>AI Sponsor Chat</h3><p>Connecting to your AI sponsor...</p>';
    
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
      
      // Create chat container
      const chatContainer = document.createElement('div');
      chatContainer.className = 'chat-container';
      panicCallStatus.innerHTML = '';
      panicCallStatus.appendChild(chatContainer);
      
      // Create chat header
      const chatHeader = document.createElement('div');
      chatHeader.className = 'chat-header';
      chatHeader.innerHTML = '<h3>AI Sponsor Chat</h3>';
      chatContainer.appendChild(chatHeader);
      
      // Create messages container
      const messagesContainer = document.createElement('div');
      messagesContainer.className = 'messages-container';
      chatContainer.appendChild(messagesContainer);
      
      // Create input container
      const inputContainer = document.createElement('div');
      inputContainer.className = 'chat-input-container';
      
      // Create text input and send button
      inputContainer.innerHTML = `
        <textarea id="sponsor-chat-input" placeholder="Type your message here..."></textarea>
        <button id="send-chat-message" class="button button-primary">Send</button>
      `;
      chatContainer.appendChild(inputContainer);
      
      // Add end chat button
      const endChatButton = document.createElement('button');
      endChatButton.textContent = 'End Chat';
      endChatButton.className = 'button button-secondary';
      endChatButton.style.marginTop = '10px';
      chatContainer.appendChild(endChatButton);
      
      // Get references to the newly created elements
      const chatInput = document.getElementById('sponsor-chat-input');
      const sendButton = document.getElementById('send-chat-message');
      
      if (!chatInput || !sendButton) {
        console.error('Failed to find chat input or send button elements');
        throw new Error('Chat interface elements not found');
      }
      
      // Store conversation history
      const conversationHistory = [];
      
      // Add event listeners for input - direct element references instead of getting by ID again
      sendButton.onclick = () => {
        const message = chatInput.value.trim();
        if (message) {
          sendMessage(message);
        }
      };
      
      chatInput.onkeypress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const message = chatInput.value.trim();
          if (message) {
            sendMessage(message);
          }
        }
      };
      
      endChatButton.onclick = () => {
        endSponsorChat();
      };
      
      // Function to send message to AI sponsor
      async function sendMessage(message) {
        if (!message || !panicCallActive) return;
        
        // Disable input while processing
        chatInput.disabled = true;
        sendButton.disabled = true;
        
        // Add user message to UI
        addMessageToUI('user', message);
        
        // Add to transcript for saving later
        panicTranscript += `Me: ${message}\n\n`;
        
        // Add to conversation history
        conversationHistory.push({
          role: 'user',
          content: message
        });
        
        // Determine API URL based on environment
        // Force using the production server instead of localhost
        const BASE_URL = 'https://callstoactions.onrender.com';
        const apiUrl = `${BASE_URL}/api/chat-sponsor`;
        
        console.log('Sending message to API:', apiUrl);
        
        try {
          // Show typing indicator
          const typingIndicator = document.createElement('div');
          typingIndicator.className = 'typing-indicator';
          typingIndicator.textContent = 'AI Sponsor is typing...';
          messagesContainer.appendChild(typingIndicator);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          // Send request to server
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              message: message,
              conversation_history: conversationHistory,
              user_name: userName || 'friend',
              days_sober: daysSober
            })
          });
          
          // Remove typing indicator
          if (typingIndicator.parentNode) {
            messagesContainer.removeChild(typingIndicator);
          }
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
          }
          
          const data = await response.json();
          console.log('Received response:', data);
          
          // Add AI response to UI
          addMessageToUI('assistant', data.response);
          
          // Add to transcript for saving later
          panicTranscript += `AI Sponsor: ${data.response}\n\n`;
          
          // Add to conversation history
          conversationHistory.push({
            role: 'assistant',
            content: data.response
          });
          
        } catch (error) {
          console.error('Error sending message:', error);
          
          // Show error in UI
          const errorMessage = document.createElement('div');
          errorMessage.className = 'error-message';
          errorMessage.textContent = `Error: ${error.message}`;
          messagesContainer.appendChild(errorMessage);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // Re-enable input
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.value = '';
        chatInput.focus();
      }
      
      // Function to add message to UI
      function addMessageToUI(role, content) {
        const messageElement = document.createElement('div');
        messageElement.className = role === 'user' ? 'user-message' : 'ai-message';
        
        const nameLabel = document.createElement('div');
        nameLabel.className = 'message-name';
        nameLabel.textContent = role === 'user' ? 'Me' : 'AI Sponsor';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageElement.appendChild(nameLabel);
        messageElement.appendChild(messageContent);
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      
      // Send initial welcome message
      setTimeout(() => {
        addMessageToUI('assistant', 'Hello, I\'m your AI Sponsor. I\'m here to support you in your recovery journey. How can I help you today?');
        
        panicTranscript += `AI Sponsor: Hello, I'm your AI Sponsor. I'm here to support you in your recovery journey. How can I help you today?\n\n`;
        
        conversationHistory.push({
          role: 'assistant',
          content: "Hello, I'm your AI Sponsor. I'm here to support you in your recovery journey. How can I help you today?"
        });
        
        // Focus input after welcome message
        chatInput.focus();
      }, 500);
      
    } catch (error) {
      console.error('Error starting AI sponsor chat:', error);
      panicCallStatus.innerHTML += `<p class="error">Error: ${error.message}</p>`;
      panicCallActive = false;
    }
  }
}

// Function to end sponsor chat
async function endSponsorChat() {
  if (!panicCallActive) return;
  
  panicCallActive = false;
  
  const panicCallStatus = document.getElementById('panic-call-status');
  if (panicCallStatus) {
    // Add end message
    const endMessage = document.createElement('div');
    endMessage.className = 'end-chat-message';
    endMessage.innerHTML = '<p>Chat ended. Remember you have the strength within you. We\'re here whenever you need us.</p>';
    panicCallStatus.appendChild(endMessage);
    
    // Disable input
    const chatInput = document.getElementById('sponsor-chat-input');
    const sendButton = document.getElementById('send-chat-message');
    
    if (chatInput) chatInput.disabled = true;
    if (sendButton) sendButton.disabled = true;
  }
  
  // Save chat transcript to database if we have content
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
        console.error('Error saving sponsor chat to database:', error);
      } else {
        console.log('AI sponsor chat saved:', data);
      }
    } catch (err) {
      console.error('Exception saving sponsor chat:', err);
    }
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
  console.log("loadUserProfile called");
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await _supabase.auth.getUser();
    if (userError) throw userError;
    
    if (user) {
      console.log("Found user:", user.id);
      
      // Fetch user profile data
      const { data, error } = await _supabase
        .from('profiles')
        .select('sobriety_date')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }
      
      console.log("Profile data:", data);
      
      // If we have a profile, show the sobriety date in the input
      if (data) {
        const sobrietyDateInput = document.getElementById('sobriety-date');
        if (data.sobriety_date && sobrietyDateInput) {
          sobrietyDateInput.value = data.sobriety_date;
          console.log(`Setting sobriety date input to ${data.sobriety_date}`);
        }
        
        // Always update sobriety days display
        await updateSobrietyDaysDisplay();
      } else {
        console.log("No profile found for user, creating one");
        // Create an empty profile if none exists
        const { error: createError } = await _supabase
          .from('profiles')
          .insert({
            user_id: user.id
            // Removed updated_at
          });
          
        if (createError) {
          console.error('Error creating profile:', createError);
        }
      }
    } else {
      console.log("No user found in loadUserProfile");
    }
  } catch (error) {
    console.error('Error in loadUserProfile:', error);
  }
}

// --- Save User Profile ---
async function saveUserProfile() {
  if (!sobrietyDateInput) return;

  const sobrietyDate = sobrietyDateInput.value;
  if (!sobrietyDate || isNaN(new Date(sobrietyDate))) {
    if(profileStatus) profileStatus.textContent = 'Please enter a valid date.';
    return;
  }

  console.log(`Saving sobriety date: ${sobrietyDate}`);
  if(profileStatus) profileStatus.textContent = 'Saving...';

  try {
    // Get current user
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      throw new Error('You need to be logged in');
    }
    
    const { error } = await _supabase
      .from('profiles')
      .upsert({ 
        user_id: user.id,
        sobriety_date: sobrietyDate
        // Removed updated_at as it's not in the schema
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
    }

    console.log("Profile saved successfully.");
    if(profileStatus) profileStatus.textContent = 'Date saved successfully!';
    
    // Update the sobriety days display
    updateSobrietyDaysDisplay();

  } catch (error) {
    console.error('Error saving user profile:', error);
    if(profileStatus) profileStatus.textContent = 'Error saving date: ' + error.message;
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
  
  // Show welcome view after login
  _supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      // Wait a bit for user profile to load
      setTimeout(() => {
        showWelcomeView();
      }, 1000);
    }
  });
  
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
  
  // Form submission with progress tracking
  if (morningForm) {
    const originalSubmit = morningForm.onsubmit;
    morningForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      await submitMorningCheckin(event);
      
      // Update progress after submission completes successfully
      setTimeout(() => {
        updateProgressAfterMorningCheckIn();
      }, 500);
    });
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
  
  // 10th Step Form Submission with progress tracking
  if (tenthStepForm) {
    const originalSubmit = tenthStepForm.onsubmit;
    tenthStepForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      await submitEveningReview(event);
      
      // Update progress after submission completes successfully
      setTimeout(() => {
        updateProgressAfterEveningReview();
      }, 500);
    });
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
      }
    });
  }

  // Initialize progress tracking when user is authenticated
  _supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      // Wait a bit for user profile to load
      setTimeout(() => {
        if (currentUser) {
          console.log('Initializing progress tracking...');
          initProgressTracking();
        }
      }, 1000);
    }
  });
  
  // Check if user is already signed in
  _supabase.auth.getSession().then(({ data: { session }}) => {
    if (session) {
      // Wait a bit for user profile to load
      setTimeout(() => {
        if (currentUser) {
          console.log('User already signed in, initializing progress tracking...');
          initProgressTracking();
        }
      }, 1000);
    }
  });
});

// --- Progress Tracking Variables and Functions ---
let weekStartDate = null;
let todayProgress = 0; // 0%, 50%, or 100%
let weekProgress = {}; // Map of dates to progress values

// Function to initialize the progress tracking
function initProgressTracking() {
  // Calculate the start of the current week (Sunday)
  const today = new Date();
  const day = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
  const weekStartDate = new Date(today);
  weekStartDate.setDate(today.getDate() - day);
  
  // Render the week view
  renderWeekView(weekStartDate);
  
  // Check weekly progress
  checkWeekProgress();
  
  // Update sobriety days display
  updateSobrietyDaysDisplay();
  
  // Show progress section
  const progressSection = document.getElementById('progress-section');
  if (progressSection) {
    progressSection.style.display = 'block';
  }
}

// Function to render the week view
function renderWeekView(weekStartDate) {
    const weekView = document.querySelector('.week-view');
    if (!weekView) return;
    
    weekView.innerHTML = '';
    
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];
    
    // Create 7 day circles for the week
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStartDate);
        date.setDate(weekStartDate.getDate() + i);
        
        const dateString = date.toISOString().split('T')[0];
        const dayElement = createDayElement(date, dateString);
        
        // Highlight today
        if (dateString === today) {
            dayElement.classList.add('today');
        }
        
        weekView.appendChild(dayElement);
    }
}

// Function to create a single day element
function createDayElement(date, dateString) {
  const dayCircle = document.createElement('div');
  dayCircle.className = 'day-circle';
  dayCircle.dataset.date = dateString;
  
  // Check if current day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const isToday = date.getTime() === today.getTime();
  
  if (isToday) {
    dayCircle.classList.add('current');
  }
  
  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = date.getDate();
  
  const dayProgress = document.createElement('div');
  dayProgress.className = 'day-progress empty';
  
  // Add flame icon
  const flameIcon = document.createElement('div');
  flameIcon.className = 'flame-icon';
  flameIcon.innerHTML = '🔥';
  dayProgress.appendChild(flameIcon);
  
  // Add click event to view entries for this day
  dayCircle.addEventListener('click', () => viewDayEntries(dateString));
  
  dayCircle.appendChild(dayNumber);
  dayCircle.appendChild(dayProgress);
  
  return dayCircle;
}

// Function to check progress for the entire week
async function checkWeekProgress() {
  if (!currentUser) return;
  
  try {
    // For each day in the week
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Check both morning and evening entries
      await checkDayProgress(dateString);
    }
  } catch (error) {
    console.error('Error checking week progress:', error);
  }
}

// Function to check and update a specific day's progress
async function checkDayProgress(dateString) {
  try {
    // Check if morning check-in exists for the date
    const morningCheckIn = await checkMorningCheckIn(dateString);
    
    // Check if evening review exists for the date
    const eveningReview = await checkEveningReview(dateString);
    
    // Update progress based on completed items
    if (eveningReview) {
      updateProgress(dateString, 100); // Both morning and evening completed
    } else if (morningCheckIn) {
      updateProgress(dateString, 50); // Only morning completed
    } else {
      updateProgress(dateString, 0); // Nothing completed
    }
    
    // If this is today, update journey status text
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) {
      updateJourneyStatus(weekProgress[dateString] || 0);
    }
    
  } catch (error) {
    console.error(`Error checking progress for ${dateString}:`, error);
  }
}

// Check if morning check-in exists for a specific date
async function checkMorningCheckIn(date) {
  if (!currentUser) return false;
  
  try {
    const { data, error } = await _supabase
      .from('daily_check_ins')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('date', date)
      .maybeSingle();
    
    if (error) throw error;
    return data ? true : false;
  } catch (error) {
    console.error('Error checking morning check-in:', error);
    return false;
  }
}

// Check if evening review exists for a specific date
async function checkEveningReview(date) {
  if (!currentUser) return false;
  
  try {
    const { data, error } = await _supabase
      .from('evening_reviews')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('date', date)
      .maybeSingle();
    
    if (error) throw error;
    return data ? true : false;
  } catch (error) {
    console.error('Error checking evening review:', error);
    return false;
  }
}

// Update the progress UI
function updateProgress(date, progress) {
  // Store progress in our tracking object
  weekProgress[date] = progress;
  
  // If it's today, update the main progress
  const today = new Date().toISOString().split('T')[0];
  if (date === today) {
    todayProgress = progress;
    
    // Update progress percentage
    const progressPercentage = document.querySelector('.progress-percentage');
    if (progressPercentage) {
      progressPercentage.textContent = `${progress}%`;
    }
    
    // Update progress bar
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
  }
  
  // Update the specific day in the week view
  const dayElement = document.querySelector(`.day-circle[data-date="${date}"]`);
  if (dayElement) {
    const dayProgress = dayElement.querySelector('.day-progress');
    if (dayProgress) {
      // Reset classes
      dayProgress.classList.remove('empty', 'half-filled', 'filled');
      
      // Set appropriate class
      if (progress >= 100) {
        dayProgress.classList.add('filled');
      } else if (progress >= 50) {
        dayProgress.classList.add('half-filled');
      } else {
        dayProgress.classList.add('empty');
      }
    }
  }
}

// Update the journey status text
function updateJourneyStatus(progress) {
  const journeyStatus = document.getElementById('journey-status');
  if (!journeyStatus) return;
  
  if (progress >= 100) {
    journeyStatus.textContent = 'Journey Complete for Today!';
  } else if (progress >= 50) {
    journeyStatus.textContent = 'Halfway There';
  } else {
    journeyStatus.textContent = 'Starting Your Journey';
  }
}

// Function to view entries for a specific day
function viewDayEntries(date) {
  // This could either redirect to a filtered journal view
  // or open a modal with entries from this date
  console.log(`Viewing entries for ${date}`);
  
  // Format the date more nicely for display
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Basic alert for now - would be better with a proper modal or navigation
  alert(`Entries for ${formattedDate}\n\nProgress: ${weekProgress[date] || 0}%\n\nClick OK to view in journal.`);
  
  // Show journal view (could be enhanced to filter by date)
  showJournalView();
}

// Function to update progress after morning check-in
function updateProgressAfterMorningCheckIn() {
  const today = new Date().toISOString().split('T')[0];
  updateProgress(today, 50);
  updateJourneyStatus(50);
  console.log('Updated progress after morning check-in');
}

// Function to update progress after evening review
function updateProgressAfterEveningReview() {
  const today = new Date().toISOString().split('T')[0];
  updateProgress(today, 100);
  updateJourneyStatus(100);
  console.log('Updated progress after evening review');
}

// Update the sobriety days display correctly
async function updateSobrietyDaysDisplay() {
  console.log("updateSobrietyDaysDisplay called");
  try {
    // Get current user
    const { data: { user }, error: userError } = await _supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      console.log("No user found for sobriety date");
      return;
    }

    // Get profile data
    console.log("Fetching profile data for user:", user.id);
    const { data, error } = await _supabase
      .from('profiles')
      .select('sobriety_date')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sobriety date:', error);
      return;
    }

    console.log("Profile data received:", data);
    
    if (data && data.sobriety_date) {
      const sobrietyDate = new Date(data.sobriety_date);
      const today = new Date();
      sobrietyDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (!isNaN(sobrietyDate)) {
        const diffTime = Math.abs(today - sobrietyDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Update all sobriety counters with consistent format
        const sobrietyDaysCount = document.getElementById('sobriety-days-count');
        const daysCountHeader = document.getElementById('days-count');
        
        const daysText = `${diffDays} days sober`;
        
        if (sobrietyDaysCount) {
          sobrietyDaysCount.textContent = daysText;
          console.log("Updated sobriety-days-count to:", daysText);
        } else {
          console.log("sobriety-days-count element not found");
        }
        
        if (daysCountHeader) {
          daysCountHeader.textContent = daysText;
          console.log("Updated days-count in header to:", daysText);
        } else {
          console.log("days-count element not found");
        }
        
        console.log(`Updated sobriety days to ${diffDays} days sober`);
      } else {
        console.log("Invalid sobriety date:", data.sobriety_date);
      }
    } else {
      console.log("No sobriety date found");
      // Create an empty profile if none exists
      if (!data) {
        const { error: createError } = await _supabase
          .from('profiles')
          .insert({
            user_id: user.id
            // Removed updated_at as it's not in the schema
          });
        
        if (createError) {
          console.error("Error creating profile:", createError);
        }
      }
    }
  } catch (error) {
    console.error('Error updating sobriety days:', error);
  }
}

// Function to show welcome/progress view after login
function showWelcomeView() {
  // Hide all content views except progress section
  document.getElementById('morning-checkin-form').style.display = 'none';
  document.getElementById('tenth-step-view').style.display = 'none';
  document.getElementById('journal-view').style.display = 'none';
  document.getElementById('profile-view').style.display = 'none';
  document.getElementById('panic-mode-view').style.display = 'none';
  
  // Make sure progress section is visible
  const progressSection = document.getElementById('progress-section');
  if (progressSection) {
    progressSection.style.display = 'block';
  }
  
  // Update progress tracking
  initProgressTracking();
  
  // Update sobriety days count
  updateSobrietyDaysDisplay();
}

// Update the morning check-in functionality to always be editable
function setupCheckInForms() {
    console.log("Setting up form handlers");
    
    // Morning check-in form
    const morningForm = document.getElementById('morning-form');
    if (morningForm) {
        // First remove any existing listeners to avoid duplicates
        const oldSubmit = morningForm.onsubmit;
        if (oldSubmit) morningForm.onsubmit = null;
        
        // Clear any existing event listeners (for modern browsers)
        morningForm.replaceWith(morningForm.cloneNode(true));
        
        // Re-get the form after replacing it
        const newMorningForm = document.getElementById('morning-form');
        
        // Add our single event listener
        newMorningForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("Morning form submitted");
            await submitMorningCheckin(event);
            closeModal('morning-checkin-modal');
        });
    }
    
    // 10th Step form 
    const tenthStepForm = document.getElementById('tenth-step-form');
    if (tenthStepForm) {
        // First remove any existing listeners to avoid duplicates
        const oldSubmit = tenthStepForm.onsubmit;
        if (oldSubmit) tenthStepForm.onsubmit = null;
        
        // Clear any existing event listeners
        tenthStepForm.replaceWith(tenthStepForm.cloneNode(true));
        
        // Re-get the form after replacing it
        const newTenthStepForm = document.getElementById('tenth-step-form');
        
        // Add our single event listener
        newTenthStepForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log("10th step form submitted");
            await submitTenthStep(event);
            closeModal('tenth-step-modal');
        });
    }
    
    // Toggle buttons for 10th step questions
    const toggleButtons = document.querySelectorAll('.toggle-button');
    toggleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const question = e.target.dataset.question;
            const value = e.target.dataset.value;
            
            // Remove active class from all buttons in this group
            document.querySelectorAll(`.toggle-button[data-question="${question}"]`).forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            e.target.classList.add('active');
            
            // Show/hide reflection area based on yes/no
            const reflectionArea = document.getElementById(`${question.split('_')[0]}-reflection-area`);
            if (reflectionArea) {
                reflectionArea.style.display = value === 'yes' ? 'block' : 'none';
            }
        });
    });
}

// Load existing check-in data if available
async function loadCheckInData() {
    // Use Supabase auth instead of Firebase
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Check for morning check-in
        const { data: morningData, error: morningError } = await _supabase
            .from('daily_check_ins')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();
        
        if (morningError) throw morningError;
        
        if (morningData) {
            // Populate morning form with existing data
            document.getElementById('gratitude-items').innerHTML = '';
            if (morningData.gratitude_list) {
                morningData.gratitude_list.forEach(item => {
                    const listItem = document.createElement('div');
                    listItem.className = 'item';
                    listItem.textContent = item;
                    document.getElementById('gratitude-items').appendChild(listItem);
                });
            }
            
            document.getElementById('general-plan').value = morningData.general_plan || '';
            document.getElementById('selected-mood').value = morningData.current_mood || '';
            
            // Update mood buttons to reflect selection
            if (morningData.current_mood) {
                document.querySelectorAll('.mood-button').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.mood === morningData.current_mood) {
                        btn.classList.add('active');
                    }
                });
            }
            
            document.getElementById('watch-for-items').innerHTML = '';
            if (morningData.watch_for_items) {
                morningData.watch_for_items.forEach(item => {
                    const listItem = document.createElement('div');
                    listItem.className = 'item';
                    listItem.textContent = item;
                    document.getElementById('watch-for-items').appendChild(listItem);
                });
            }
            
            document.getElementById('strive-for-items').innerHTML = '';
            if (morningData.strive_for_items) {
                morningData.strive_for_items.forEach(item => {
                    const listItem = document.createElement('div');
                    listItem.className = 'item';
                    listItem.textContent = item;
                    document.getElementById('strive-for-items').appendChild(listItem);
                });
            }
        }
        
        // Check for 10th step data
        const { data: tenthStepData, error: tenthStepError } = await _supabase
            .from('evening_reviews')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', today)
            .maybeSingle();
        
        if (tenthStepError) throw tenthStepError;
        
        if (tenthStepData && tenthStepData.tenth_step) {
            const data = tenthStepData.tenth_step;
            
            // Populate 10th step form with existing data
            if (data.harm_anyone) {
                document.querySelectorAll('[data-question="harm_anyone"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.value === (data.harm_anyone.answer ? 'yes' : 'no')) {
                        btn.classList.add('active');
                    }
                });
                document.getElementById('harm-reflection').value = data.harm_anyone.reflection || '';
                document.getElementById('harm-reflection-area').style.display = data.harm_anyone.answer ? 'block' : 'none';
            }
            
            if (data.resentment) {
                document.querySelectorAll('[data-question="resentment"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.value === (data.resentment.answer ? 'yes' : 'no')) {
                        btn.classList.add('active');
                    }
                });
                document.getElementById('resentment-reflection').value = data.resentment.reflection || '';
                document.getElementById('resentment-reflection-area').style.display = data.resentment.answer ? 'block' : 'none';
            }
            
            if (data.fear_anxiety) {
                document.querySelectorAll('[data-question="fear_anxiety"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.value === (data.fear_anxiety.answer ? 'yes' : 'no')) {
                        btn.classList.add('active');
                    }
                });
                document.getElementById('fear-reflection').value = data.fear_anxiety.reflection || '';
                document.getElementById('fear-reflection-area').style.display = data.fear_anxiety.answer ? 'block' : 'none';
            }
            
            if (data.selfish) {
                document.querySelectorAll('[data-question="selfish"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.value === (data.selfish.answer ? 'yes' : 'no')) {
                        btn.classList.add('active');
                    }
                });
                document.getElementById('selfish-reflection').value = data.selfish.reflection || '';
                document.getElementById('selfish-reflection-area').style.display = data.selfish.answer ? 'block' : 'none';
            }
            
            if (data.apology) {
                document.querySelectorAll('[data-question="apology"]').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.value === (data.apology.answer ? 'yes' : 'no')) {
                        btn.classList.add('active');
                    }
                });
                document.getElementById('apology-reflection').value = data.apology.reflection || '';
                document.getElementById('apology-reflection-area').style.display = data.apology.answer ? 'block' : 'none';
            }
        }
    } catch (error) {
        console.error('Error loading check-in data:', error);
    }
}

// Function for notifications
function showNotification(message, type = 'info') {
  // Check if a notification container exists, or create one
  let notificationContainer = document.getElementById('notification-container');
  
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = message;
  
  // Style notification
  notification.style.padding = '12px 20px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '4px';
  notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  notification.style.transition = 'all 0.3s ease';
  
  // Set color based on type
  if (type === 'success') {
    notification.style.backgroundColor = '#4caf50';
    notification.style.color = 'white';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
    notification.style.color = 'white';
  } else {
    notification.style.backgroundColor = '#2196f3';
    notification.style.color = 'white';
  }
  
  // Add notification to container
  notificationContainer.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(20px)';
    setTimeout(() => {
      if (notification.parentNode === notificationContainer) {
        notificationContainer.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Function to set up navigation
function setupNavigation() {
    // Navigation buttons
    const journalBtn = document.getElementById('journal-button');
    const homeBtn = document.getElementById('home-button');
    const profileBtn = document.getElementById('profile-button');
    const panicBtn = document.getElementById('panic-button');
    
    // Modal buttons
    const viewMorningBtn = document.getElementById('view-morning-btn');
    const viewTenthStepBtn = document.getElementById('view-tenth-step-btn');
    const viewPanicBtn = document.getElementById('view-panic-btn');
    const closeButtons = document.querySelectorAll('.close-modal');
    
    // Handle navigation to home
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            showWelcomeView();
        });
    }
    
    // Handle navigation to journal
    if (journalBtn) {
        journalBtn.addEventListener('click', () => {
            document.getElementById('journal-view').style.display = 'block';
            document.getElementById('profile-view').style.display = 'none';
            document.getElementById('panic-mode-view').style.display = 'none';
            
            // Load journal entries
            loadJournalEntries();
        });
    }
    
    // Handle navigation to profile
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            document.getElementById('journal-view').style.display = 'none';
            document.getElementById('profile-view').style.display = 'block';
            document.getElementById('panic-mode-view').style.display = 'none';
        });
    }
    
    // Handle panic button
    if (panicBtn) {
        panicBtn.addEventListener('click', () => {
            document.getElementById('journal-view').style.display = 'none';
            document.getElementById('profile-view').style.display = 'none';
            document.getElementById('panic-mode-view').style.display = 'block';
        });
    }
    
    // Open morning check-in modal
    if (viewMorningBtn) {
        viewMorningBtn.addEventListener('click', () => {
            console.log('Opening Morning Check-in modal');
            openModal('morning-checkin-modal');
        });
    }
    
    // Open 10th step modal
    if (viewTenthStepBtn) {
        viewTenthStepBtn.addEventListener('click', () => {
            console.log('Opening 10th Step modal');
            openModal('tenth-step-modal');
        });
    }
    
    // Open panic mode view
    if (viewPanicBtn) {
        viewPanicBtn.addEventListener('click', () => {
            console.log('Opening Panic mode');
            document.getElementById('journal-view').style.display = 'none';
            document.getElementById('profile-view').style.display = 'none';
            document.getElementById('panic-mode-view').style.display = 'block';
        });
    }
    
    // Set up close buttons for all modals
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal');
            closeModal(modalId);
        });
    });
}

// Make sure setupNavigation gets called during initialization and update sobriety days
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded. Setting up navigation...');
  setupNavigation();
  setupCheckInForms();
  
  // Add global click event listener to debug button clicks
  document.addEventListener('click', (e) => {
    if (e.target.nodeName === 'BUTTON' || e.target.closest('button')) {
      const button = e.target.nodeName === 'BUTTON' ? e.target : e.target.closest('button');
      console.log('Button clicked:', button.id || button.className || 'unnamed button');
    }
  });
  
  // Update form submissions to close modals - REMOVE THESE TO AVOID DUPLICATES
  // These are already handled in setupCheckInForms()
  /* 
  const morningForm = document.getElementById('morning-form');
  if (morningForm) {
    morningForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitMorningCheckin(event);
      closeModal('morning-checkin-modal');
    });
  }
  
  const tenthStepForm = document.getElementById('tenth-step-form');
  if (tenthStepForm) {
    tenthStepForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitTenthStep(event);
      closeModal('tenth-step-modal');
    });
  }
  */
  
  // Check if user is already logged in and update sobriety days
  _supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      console.log("User is logged in, updating sobriety days");
      updateSobrietyDaysDisplay().catch(err => console.error('Error updating sobriety days:', err));
    }
  });
});

// Functions to show and hide modals
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    
    // Load data for this modal if needed
    if (modalId === 'morning-checkin-modal' || modalId === 'tenth-step-modal') {
      loadCheckInData().catch(err => console.error('Error loading check-in data:', err));
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
}

// Close modal when clicking outside the content
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    closeModal(event.target.id);
  }
};

async function submitTenthStep(event) {
  event.preventDefault();
  
  // Get form data to create tenth step data
  const tenth_step = {
    harm_anyone: {
      answer: document.querySelector('[data-question="harm_anyone"].active').dataset.value === 'yes',
      reflection: document.getElementById('harm-reflection').value
    },
    resentment: {
      answer: document.querySelector('[data-question="resentment"].active').dataset.value === 'yes',
      reflection: document.getElementById('resentment-reflection').value
    },
    fear_anxiety: {
      answer: document.querySelector('[data-question="fear_anxiety"].active').dataset.value === 'yes',
      reflection: document.getElementById('fear-reflection').value
    },
    selfish: {
      answer: document.querySelector('[data-question="selfish"].active').dataset.value === 'yes',
      reflection: document.getElementById('selfish-reflection').value
    },
    apology: {
      answer: document.querySelector('[data-question="apology"].active').dataset.value === 'yes',
      reflection: document.getElementById('apology-reflection').value
    }
  };
  
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get current user
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      throw new Error('You need to be logged in');
    }
    
    // Check if entry already exists
    const { data: existingEntry } = await _supabase
      .from('evening_reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    
    if (existingEntry) {
      // Update existing entry
      const { error } = await _supabase
        .from('evening_reviews')
        .update({
          tenth_step: tenth_step
          // Removed updated_at as it's not in the schema
        })
        .eq('id', existingEntry.id);
      
      if (error) throw error;
      showNotification('10th Step updated!', 'success');
    } else {
      // Create new entry
      const { error } = await _supabase
        .from('evening_reviews')
        .insert({
          user_id: user.id,
          date: today,
          tenth_step: tenth_step,
          completed_actions: []
        });
      
      if (error) throw error;
      showNotification('10th Step saved!', 'success');
    }
    
    // Update progress
    updateProgressAfterEveningReview();
    
    // Close the modal
    closeModal('tenth-step-modal');
  } catch (error) {
    console.error('Error saving 10th step:', error);
    alert('Error saving 10th step: ' + error.message);
  }
}
