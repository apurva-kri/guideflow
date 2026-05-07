document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');
    const sendBtn = document.getElementById('send-btn');
    const quickBtns = document.querySelectorAll('.quick-btn');

    let isWaiting = false;

    // Set marked options for Markdown parsing
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    // Add user message to UI
    const addUserMessage = (text) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message user-message';
        msgDiv.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-user"></i></div>
            <div class="message-content">${escapeHTML(text)}</div>
        `;
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    };

    // Add bot message container to UI
    const addBotMessageContainer = () => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message assistant-message';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<i class="fa-solid fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        msgDiv.appendChild(avatarDiv);
        msgDiv.appendChild(contentDiv);
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
        
        return contentDiv;
    };

    // Show typing indicator
    const showTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.className = 'message assistant-message typing-indicator-container';
        indicator.innerHTML = `
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        `;
        chatContainer.appendChild(indicator);
        scrollToBottom();
        return indicator;
    };

    // Escape basic HTML to prevent XSS in user input
    const escapeHTML = (str) => {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    // Handle form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text || isWaiting) return;

        await processMessage(text);
    });

    // Handle quick action buttons
    quickBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (isWaiting) return;
            const text = btn.getAttribute('data-query');
            await processMessage(text);
        });
    });

    const processMessage = async (text) => {
        // UI updates
        userInput.value = '';
        sendBtn.disabled = true;
        isWaiting = true;
        addUserMessage(text);
        
        const indicator = showTypingIndicator();

        try {
            // Setup fetch request
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Remove indicator and prep bot message
            indicator.remove();
            const contentDiv = addBotMessageContainer();
            let accumulatedText = "";

            // Handle Server-Sent Events stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (!dataStr) continue;
                        
                        if (dataStr === '[DONE]') {
                            break;
                        }

                        try {
                            const data = JSON.parse(dataStr);
                            if (data.error) {
                                accumulatedText += `\n**Error:** ${data.error}`;
                            } else if (data.text) {
                                accumulatedText += data.text;
                            }
                            
                            // Parse markdown and update UI incrementally
                            contentDiv.innerHTML = marked.parse(accumulatedText);
                            scrollToBottom();
                        } catch (err) {
                            console.error("Error parsing stream chunk", err);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            indicator.remove();
            const contentDiv = addBotMessageContainer();
            contentDiv.innerHTML = `<p style="color: #ff5252;">Sorry, I encountered an error connecting to the server. Please check your API key and network connection.</p>`;
        } finally {
            isWaiting = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    };
});
