// Configuration
const defaultConfig = {
    assistant_name: "Google Assistant",
    welcome_message: "Hi! I'm Google Assistant. I can help you get things done.",
    voice_button_text: "Talk to Assistant",
    user_name: "",
    openai_api_key: "",
    use_openai: false
};

let currentData = [];
let isListening = false;
let isContinuousMode = false;
let recognition = null;
let continuousRecognition = null;

// Data SDK Handler
const dataHandler = {
    onDataChanged(data) {
        currentData = data;
        updateHistoryDisplay();
    }
};

// Element SDK Configuration
const elementConfig = {
    defaultConfig,
    onConfigChange: async (config) => {
        const assistantName = config.assistant_name || defaultConfig.assistant_name;
        const welcomeMessage = config.welcome_message || defaultConfig.welcome_message;
        const voiceButtonText = config.voice_button_text || defaultConfig.voice_button_text;
        const userName = config.user_name || defaultConfig.user_name;
        const openaiApiKey = config.openai_api_key || defaultConfig.openai_api_key;
        const useOpenAI = config.use_openai || defaultConfig.use_openai;

        document.getElementById('assistantName').textContent = assistantName;
        document.getElementById('welcomeMessage').textContent = welcomeMessage;
        document.getElementById('voiceButtonText').textContent = voiceButtonText;
        
        // Update AI processor with user name and OpenAI settings
        if (aiProcessor) {
            aiProcessor.setUserName(userName);
            aiProcessor.setOpenAIConfig(openaiApiKey, useOpenAI);
        }
    },
    mapToCapabilities: (config) => ({
        recolorables: [],
        borderables: [],
        fontEditable: undefined,
        fontSizeable: undefined
    }),
    mapToEditPanelValues: (config) => new Map([
        ["assistant_name", config.assistant_name || defaultConfig.assistant_name],
        ["welcome_message", config.welcome_message || defaultConfig.welcome_message],
        ["voice_button_text", config.voice_button_text || defaultConfig.voice_button_text],
        ["user_name", config.user_name || defaultConfig.user_name],
        ["openai_api_key", config.openai_api_key || defaultConfig.openai_api_key],
        ["use_openai", config.use_openai ? "true" : "false"]
    ])
};

// Initialize SDKs
async function initializeApp() {
    try {
        if (window.dataSdk) {
            const initResult = await window.dataSdk.init(dataHandler);
            if (!initResult.isOk) {
                console.error("Failed to initialize data SDK");
            }
        }

        if (window.elementSdk) {
            await window.elementSdk.init(elementConfig);
        }

        setupVoiceRecognition();
        setupEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
    }
}

// Voice Recognition Setup
function setupVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;

        recognition.onstart = function() {
            addMessage('assistant', '🎤 Listening... Go ahead, I\'m ready!');
        };

        recognition.onresult = function(event) {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            const inputField = document.getElementById('userInput');
            inputField.value = finalTranscript || interimTranscript;

            if (finalTranscript) {
                processVoiceCommand(finalTranscript.toLowerCase().trim());
            }
        };

        recognition.onend = function() {
            isListening = false;
            updateVoiceButton();
        };

        recognition.onerror = function(event) {
            isListening = false;
            updateVoiceButton();
            
            let errorMessage = 'Sorry, I had trouble hearing you. ';
            switch(event.error) {
                case 'no-speech':
                    errorMessage += 'I didn\'t hear anything. Please try speaking again.';
                    break;
                case 'audio-capture':
                    errorMessage += 'Please check your microphone permissions.';
                    break;
                case 'not-allowed':
                    errorMessage += 'Microphone access was denied. Please enable it in your browser settings.';
                    break;
                case 'network':
                    errorMessage += 'Network error occurred. Please check your connection.';
                    break;
                default:
                    errorMessage += 'Please try again.';
            }
            addMessage('assistant', errorMessage);
        };
    } else {
        console.log('Speech recognition not supported');
    }
}

// Event Listeners
function setupEventListeners() {
    const userInput = document.getElementById('userInput');
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Process Voice Commands
function processVoiceCommand(command) {
    if (command.includes('hey google') || command.includes('ok google')) {
        const actualCommand = command.replace(/^(hey google|ok google),?\s*/i, '');
        if (actualCommand) {
            document.getElementById('userInput').value = actualCommand;
            sendMessage();
        } else {
            addMessage('assistant', 'Hi! I\'m listening. What can I help you with?');
        }
        return;
    }

    if (command.includes('stop listening') || command.includes('cancel')) {
        recognition.stop();
        addMessage('assistant', 'Okay, I\'ve stopped listening.');
        return;
    }

    if (
        command.endsWith('?') ||
        command.includes('what') ||
        command.includes('how') ||
        command.includes('when') ||
        command.includes('where') ||
        command.includes('why') ||
        command.includes('tell me') ||
        command.includes('show me') ||
        command.includes('calculate')
    ) {
        sendMessage();
    }
}

// Add Message to Chat
function addMessage(sender, message, addToHistory = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-avatar ${sender}">
            ${sender === 'assistant' ? '🤖' : '🧑'}
        </div>
        <div class="message-content">${message}</div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (addToHistory && sender === 'assistant') {
        updateHistory(message);
    }
}

// Update History Panel
function updateHistory(responseText) {
    const query = document.getElementById('userInput').value;
    const category = categorizeQuery(query);

    const record = {
        id: Date.now(),
        query,
        response: responseText,
        timestamp: new Date().toISOString(),
        category
    };

    currentData.push(record);
    updateHistoryDisplay();

    if (window.dataSdk) {
        window.dataSdk.save(currentData);
    }
}

function categorizeQuery(query) {
    const q = query.toLowerCase();

    if (q.includes('time') || q.includes('clock')) return 'time';
    if (q.includes('weather')) return 'weather';
    if (q.includes('calculate') || q.includes('tip') || q.includes('math')) return 'calculation';
    if (q.includes('joke') || q.includes('funny')) return 'entertainment';
    if (q.includes('remind') || q.includes('reminder')) return 'reminder';
    return 'general';
}

// Update History Display
function updateHistoryDisplay() {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '';

    const recent = [...currentData].slice(-5).reverse();
    recent.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-query">${item.query}</div>
            <div class="history-response">${item.response.slice(0, 50)}...</div>
        `;
        div.onclick = () => openDataViewer(item.id);
        container.appendChild(div);
    });
}

// Send User Message
function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text) {
        addMessage('assistant', 'Please type something for me to respond to.');
        return;
    }

    addMessage('user', text, false);
    input.value = '';

    showTyping(true);

    aiProcessor.processMessage(text).then(response => {
        showTyping(false);
        addMessage('assistant', response);
    });
}

// Show Typing Indicator
function showTyping(show) {
    const indicator = document.getElementById('typingIndicator');
    indicator.style.display = show ? 'flex' : 'none';
}

// Quick Query Button
function sendQuickQuery(text) {
    document.getElementById('userInput').value = text;
    sendMessage();
}

// Voice Button Toggle
function toggleVoiceInput() {
    if (!recognition) {
        addMessage('assistant', 'Sorry, your browser does not support voice input.');
        return;
    }

    if (!isListening) {
        recognition.start();
        isListening = true;
    } else {
        recognition.stop();
        isListening = false;
    }

    updateVoiceButton();
}

// Voice Button UI Update
function updateVoiceButton() {
    const btn = document.getElementById('voiceButton');
    const text = document.getElementById('voiceButtonText');

    if (isListening) {
        btn.classList.add('listening');
        text.textContent = 'Listening...';
    } else {
        btn.classList.remove('listening');
        text.textContent = 'Voice';
    }
}

// Toggle Continuous Listening
function toggleContinuousListening() {
    isContinuousMode = !isContinuousMode;

    if (isContinuousMode) {
        startContinuousRecognition();
        addMessage('assistant', '🔁 Continuous listening enabled.');
    } else {
        stopContinuousRecognition();
        addMessage('assistant', '⛔ Continuous listening disabled.');
    }
}

function startContinuousRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        addMessage('assistant', 'This browser does not support advanced voice recognition.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    continuousRecognition = new SpeechRecognition();
    continuousRecognition.continuous = true;
    continuousRecognition.interimResults = false;
    continuousRecognition.lang = 'en-US';

    continuousRecognition.onresult = function(event) {
        const transcript = event.results[event.results.length - 1][0].transcript;

        if (isContinuousMode) {
            document.getElementById('userInput').value = transcript;
            sendMessage();
        }
    };

    continuousRecognition.onerror = function() {
        if (isContinuousMode) {
            startContinuousRecognition();
        }
    };

    continuousRecognition.onend = function() {
        if (isContinuousMode) {
            startContinuousRecognition();
        }
    };

    continuousRecognition.start();
}

function stopContinuousRecognition() {
    if (continuousRecognition) continuousRecognition.stop();
}

// ===============================
// DATA VIEWER MODAL
// ===============================

function openDataViewer(scrollToId = null) {
    const modal = document.getElementById('dataViewerModal');
    modal.style.display = 'flex';

    populateConversationList();

    if (scrollToId) {
        setTimeout(() => {
            const target = document.getElementById(`conv-${scrollToId}`);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
    }
}

function closeDataViewer() {
    const modal = document.getElementById('dataViewerModal');
    modal.style.display = 'none';
}

function populateConversationList() {
    const list = document.getElementById('conversationList');
    list.innerHTML = '';

    if (currentData.length === 0) {
        list.innerHTML = `
            <div class="no-data-message">
                <div class="no-data-icon">📭</div>
                No conversation history found.
            </div>
        `;
        updateStats(0, 0);
        return;
    }

    currentData
        .slice()
        .reverse()
        .forEach(item => {
            const div = document.createElement('div');
            div.className = 'conversation-card';
            div.id = `conv-${item.id}`;
            div.innerHTML = `
                <div class="conversation-header">
                    <div class="conversation-date">${new Date(item.timestamp).toLocaleString()}</div>
                    <div class="conversation-category">${item.category}</div>
                </div>

                <div class="conversation-query">
                    <div class="conversation-query-label">Query:</div>
                    <div class="conversation-query-text">${item.query}</div>
                </div>

                <div class="conversation-response">
                    <div class="conversation-response-label">Response:</div>
                    <div class="conversation-response-text">${item.response}</div>
                </div>
            `;

            list.appendChild(div);
        });

    updateStats(currentData.length, currentData.length);
}

function updateStats(total, shown) {
    document.getElementById('totalCount').textContent = `Total: ${total}`;
    document.getElementById('filteredCount').textContent = `Showing: ${shown}`;
}

// ===============================
// SEARCH & FILTER
// ===============================

function filterConversations() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const filter = document.getElementById('categoryFilter').value;

    const list = document.getElementById('conversationList');
    list.innerHTML = '';

    let matched = 0;

    currentData.slice().reverse().forEach(item => {
        const matchesText =
            item.query.toLowerCase().includes(query) ||
            item.response.toLowerCase().includes(query);

        const matchesCategory =
            !filter || item.category === filter;

        if (matchesText && matchesCategory) {
            matched++;
            const div = document.createElement('div');
            div.className = 'conversation-card';
            div.innerHTML = `
                <div class="conversation-header">
                    <div class="conversation-date">${new Date(item.timestamp).toLocaleString()}</div>
                    <div class="conversation-category">${item.category}</div>
                </div>
                <div class="conversation-query">
                    <div class="conversation-query-label">Query:</div>
                    <div class="conversation-query-text">${item.query}</div>
                </div>
                <div class="conversation-response">
                    <div class="conversation-response-label">Response:</div>
                    <div class="conversation-response-text">${item.response}</div>
                </div>
            `;
            list.appendChild(div);
        }
    });

    updateStats(currentData.length, matched);

    if (matched === 0) {
        list.innerHTML = `
            <div class="no-data-message">
                <div class="no-data-icon">🔎</div>
                No matching conversations found.
            </div>
        `;
    }
}

// ===============================
// EXPORT CSV
// ===============================

function exportData() {
    if (currentData.length === 0) {
        addMessage('assistant', 'No data available for export.');
        return;
    }

    const rows = [
        ["ID", "Query", "Response", "Timestamp", "Category"],
        ...currentData.map(item => [
            item.id,
            item.query.replace(/"/g, '""'),
            item.response.replace(/"/g, '""'),
            item.timestamp,
            item.category
        ])
    ];

    const csvContent = rows.map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "assistant_conversations.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addMessage('assistant', '📥 Your CSV file has been downloaded.');
}

// ===============================
// AI PROCESSOR
// ===============================

const aiProcessor = {
    userName: "",
    openaiKey: "",
    useOpenAI: false,

    setUserName(name) {
        this.userName = name || "";
    },

    setOpenAIConfig(key, enabled) {
        this.openaiKey = key;
        this.useOpenAI = enabled === true || enabled === "true";
    },

    async processMessage(text) {
        text = text.toLowerCase();

        // 1. TIME
        if (text.includes('time')) {
            return this.handleTime();
        }

        // 2. WEATHER (mock)
        if (text.includes('weather')) {
            return this.handleWeather();
        }

        // 3. CALCULATIONS
        if (text.includes('calculate') || text.includes('%') || text.match(/\d+/g)) {
            return this.handleCalculation(text);
        }

        // 4. JOKE
        if (text.includes('joke')) {
            return this.handleJoke();
        }

        // 5. REMINDERS
        if (text.includes('remind')) {
            return this.handleReminder(text);
        }

        // 6. OPENAI (if enabled)
        if (this.useOpenAI && this.openaiKey) {
            return await this.askOpenAI(text);
        }

        // 7. Default fallback response
        return this.handleGeneral(text);
    },

        // ===============================
    // RESPONSE HANDLERS
    // ===============================

    handleTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const greeting = now.getHours() < 12
            ? "Good morning!"
            : now.getHours() < 18
            ? "Good afternoon!"
            : "Good evening!";

        return `${greeting} The current time is ${timeString}.`;
    },

    handleWeather() {
        return "I can't fetch real-time weather without API access, but I can tell you today's weather seems nice! ☀️";
    },

    handleCalculation(text) {
        try {
            let expression = text.replace(/calculate|what is|how much is/gi, "");
            expression = expression.replace(/[^0-9+\-*/().]/g, "");

            if (!expression) return "I couldn’t find a valid calculation in your question.";

            const result = Function(`"use strict"; return (${expression})`)();

            if (isNaN(result)) return "Hmm, I couldn't process that calculation.";

            return `The answer is ${result}.`;
        } catch {
            return "Sorry, I couldn't calculate that.";
        }
    },

    handleJoke() {
        const jokes = [
            "Why don’t skeletons fight each other? Because they don’t have the guts!",
            "Why did the computer go to the doctor? It had a virus!",
            "I tried to catch fog yesterday… Mist!",
            "Why do cows wear bells? Because their horns don’t work!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    },

    handleReminder(text) {
        return "Okay! I will remind you... (Actually not implemented yet 😅).";
    },

    handleGeneral(text) {
        return `You said: "${text}". I'm still learning how to help with that!`;
    },

    // ===============================
    // OpenAI
    // ===============================

    async askOpenAI(text) {
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.openaiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `You are a helpful assistant. The user's name is ${this.userName}.`
                        },
                        {
                            role: "user",
                            content: text
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.error) {
                return "OpenAI error: " + data.error.message;
            }

            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error(error);
            return "I couldn't connect to OpenAI. Please check your API key or network.";
        }
    }
};

// ===============================
// INIT APP
// ===============================
initializeApp();
