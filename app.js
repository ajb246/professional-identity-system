console.log("Professional Identity System Initializing...");
const APP_STATE = {
    data: {
        profile: null,
        services: null,
        portfolio: null
    },
    adminMode: false
};
// --- DATA LOADING ---
async function loadData() {
    try {
        // Use relative paths with cache busting to prevent stale 404s
        const t = Date.now();
        const [profile, services, portfolio] = await Promise.all([
            fetchSafe(`profile.json?t=${t}`),
            fetchSafe(`services.json?t=${t}`),
            fetchSafe(`portfolio.json?t=${t}`)
        ]);
        APP_STATE.data = { profile, services, portfolio };
        // Remove loading screen
        const loading = document.getElementById('loading-state');
        if (loading) loading.style.display = 'none';
        renderApp();
    } catch (e) {
        console.error("Critical Error:", e);
        const app = document.getElementById('app');
        const problematicUrl = e.url || 'profile.json';
        const absoluteDebugUrl = new URL(problematicUrl, window.location.href).href;
        // Elegant error UI
        app.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #e0e0e0;">
                <h2 style="color: #ff6b6b; margin-bottom: 1rem;">System Initialization Failed</h2>
                <p style="max-width: 600px; line-height: 1.6;">
                    Unable to load profile data.<br>
                    Please verify that <code>profile.json</code> exists in the repository root.<br>
                    <br>
                    <span style="font-family: monospace; background: #333; padding: 4px; border-radius: 4px; font-size: 0.9em;">
                        Error: ${e.message}
                    </span>
                </p>
                <div style="margin-top: 2rem; font-size: 0.9rem; color: #aaa;">
                    <strong>Diagnostic Check:</strong><br>
                    Try opening this file directly:<br>
                    <a href="${absoluteDebugUrl}" target="_blank" style="color: #3b82f6;">${absoluteDebugUrl}</a>
                </div>
            </div>
        `;
    }
}
async function fetchSafe(url) {
    const response = await fetch(url);
    if (!response.ok) {
        const err = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        err.url = url;
        throw err;
    }
    return response.json();
}
// --- RENDERING ---
function renderApp() {
    const { profile, services, portfolio } = APP_STATE.data;
    if (!profile || !services || !portfolio) return;
    // Render Hero
    const hero = document.getElementById('hero');
    hero.innerHTML = `
        <h1>${profile.name}</h1>
        <h2>${profile.headline}</h2>
        <p class="positioning">${profile.positioning}</p>
    `;
    // Render About
    const about = document.getElementById('about');
    about.innerHTML = `
        <h3>About Me</h3>
        <p>${profile.bio}</p>
        <div class="skills-list">
            ${profile.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
        <div class="contact-info">
            <a href="mailto:${profile.contact.email}" class="cta-button">Contact Me</a>
            ${profile.contact.calendar_link ? `<a href="${profile.contact.calendar_link}" target="_blank" class="secondary-button">Book Consultation</a>` : ''}
        </div>
    `;
    // Render Services
    const servicesSection = document.getElementById('services');
    servicesSection.innerHTML = `
        <h3>Services</h3>
        <div class="services-grid">
            ${services.services.map(service => `
                <div class="service-card">
                    <h4>${service.name}</h4>
                    <p>${service.description}</p>
                    <ul>
                        ${service.deliverables.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                    <span class="price">${service.pricing_model}</span>
                </div>
            `).join('')}
        </div>
    `;
    // Render Portfolio
    const portfolioSection = document.getElementById('portfolio');
    portfolioSection.innerHTML = `
        <h3>Selected Work</h3>
        <div class="portfolio-grid">
            ${portfolio.projects.map(project => `
                <div class="project-card">
                    <div class="project-header">
                        <h4>${project.title}</h4>
                        <span class="timestamp">${project.timestamp}</span>
                    </div>
                    <div class="project-body">
                        <p><strong>Problem:</strong> ${project.problem}</p>
                        <p><strong>Solution:</strong> ${project.solution}</p>
                        <p><strong>Outcome:</strong> ${project.outcome} (${project.metrics})</p>
                    </div>
                    <div class="project-stack">
                        ${project.stack.map(tech => `<span class="stack-tag">${tech}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    setupAdminToggle();
}
function setupAdminToggle() {
    const trigger = document.getElementById('admin-trigger');
    const panel = document.getElementById('admin-panel');
    const closeBtn = document.getElementById('close-admin');
    if (trigger.dataset.hasListener) return;
    trigger.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });
    closeBtn.addEventListener('click', () => {
        panel.classList.add('hidden');
    });
    trigger.dataset.hasListener = 'true';
}
// --- ADMIN & API CLIENTS ---
class GitHubClient {
    constructor(token) {
        this.token = token;
        this.owner = localStorage.getItem('gh_owner');
        this.repo = localStorage.getItem('gh_repo');
        this.branch = 'main';
    }
    async getFile(path) {
        if (!this.owner || !this.repo) throw new Error("Repository settings missing");
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        if (!response.ok) throw new Error(`Failed to fetch ${path} from GitHub API`);
        return await response.json();
    }
    async updateFile(path, content, message, sha) {
        if (!this.owner || !this.repo) throw new Error("Repository settings missing");
        const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}`;
        const payload = {
            message: message,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
            sha: sha,
            branch: this.branch
        };
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `Failed to update ${path}`);
        }
        return await response.json();
    }
}
class OpenAIClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.endpoint = 'https://api.openai.com/v1/chat/completions';
    }
    async chat(messages, systemPrompt) {
        if (!this.apiKey) throw new Error("OpenAI Key not found");
        const payload = {
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            response_format: { type: "json_object" }
        };
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "OpenAI API Error");
            }
            const data = await response.json();
            return JSON.parse(data.choices[0].message.content);
        } catch (error) {
            console.error("OpenAI Call Failed:", error);
            throw error;
        }
    }
}
// --- APP INITIALIZATION ---
const SYSTEM_PROMPT = `
You are a Professional Identity Architect.
Your goal is to manage the user's professional profile data.
Your output must be a valid JSON object with this structure:
{
  "commit_message": "A concise git commit message describing the changes",
  "updates": {
    "profile.json": { ...only fields to update... },
    "portfolio.json": { "projects": [...] }, 
    "services.json": { "services": [...] }
  },
  "human_message": "A polite response to the user."
}
Rules:
1. Maintain professional tone.
2. Only return files in "updates" that are changing.
3. If no changes, return "updates": {}.
`;
async function handleChat() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    appendChatMessage("User", message);
    input.value = '';
    const apiKey = localStorage.getItem('openai_key');
    if (!apiKey) {
        appendChatMessage("System", "Error: OpenAI Key not found.");
        return;
    }
    const client = new OpenAIClient(apiKey);
    const contextMessage = {
        role: "user",
        content: `Current Data State: ${JSON.stringify(APP_STATE.data)}\n\nUser Request: ${message}`
    };
    try {
        appendChatMessage("AI", "Thinking...");
        const result = await client.chat([contextMessage], SYSTEM_PROMPT);
        const history = document.getElementById('chat-history');
        if (history.lastElementChild.textContent.includes("Thinking...")) {
            history.lastElementChild.remove();
        }
        appendChatMessage("AI", result.human_message);
        if (Object.keys(result.updates).length > 0) {
            APP_STATE.pendingUpdates = result;
            renderDiff(result);
        }
    } catch (e) {
        const history = document.getElementById('chat-history');
        if (history.lastElementChild.textContent.includes("Thinking...")) {
            history.lastElementChild.remove();
        }
        appendChatMessage("System", `Error: ${e.message}`);
    }
}
function appendChatMessage(role, text) {
    const history = document.getElementById('chat-history');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role.toLowerCase()}`;
    msgDiv.innerHTML = `<strong>${role}:</strong> ${text}`;
    history.appendChild(msgDiv);
    history.scrollTop = history.scrollHeight;
}
function renderDiff(result) {
    const viewer = document.getElementById('diff-viewer');
    viewer.innerHTML = `
        <h4>Proposed Updates</h4>
        <pre>${JSON.stringify(result.updates, null, 2)}</pre>
        <p><strong>Commit Message:</strong> ${result.commit_message}</p>
    `;
    const commitBtn = document.getElementById('commit-btn');
    commitBtn.disabled = false;
    commitBtn.onclick = () => executeCommit(result);
}
async function executeCommit(result) {
    const commitBtn = document.getElementById('commit-btn');
    commitBtn.disabled = true;
    commitBtn.textContent = "Committing...";
    const token = localStorage.getItem('gh_token');
    if (!token) {
        alert("GitHub Token not found.");
        commitBtn.disabled = false;
        return;
    }
    const ghClient = new GitHubClient(token);
    try {
        const filesToUpdate = Object.keys(result.updates);
        for (const filename of filesToUpdate) {
            // Files are in root now based on user feedback
            const path = filename;
            const newContent = result.updates[filename];
            if (Object.keys(newContent).length === 0) continue;
            appendChatMessage("System", `Fetching SHA for ${filename}...`);
            const currentFileRequest = await ghClient.getFile(path);
            const currentContentStr = atob(currentFileRequest.content);
            const currentContent = JSON.parse(decodeURIComponent(escape(currentContentStr)));
            let finalContent = { ...currentContent, ...newContent };
            appendChatMessage("System", `Updating ${filename}...`);
            await ghClient.updateFile(path, finalContent, result.commit_message, currentFileRequest.sha);
        }
        appendChatMessage("System", "Committed! Redeploying...");
        alert("Updates committed! GitHub Pages will rebuild shortly.");
        await loadData(); // Reload local state
    } catch (e) {
        console.error(e);
        appendChatMessage("System", `Commit Failed: ${e.message}`);
        alert(`Commit Failed: ${e.message}`);
    } finally {
        commitBtn.disabled = false;
        commitBtn.textContent = "Commit Changes";
        APP_STATE.pendingUpdates = null;
        document.getElementById('diff-viewer').innerHTML = '';
    }
}
function loadSettings() {
    const ghToken = localStorage.getItem('gh_token');
    const openaiKey = localStorage.getItem('openai_key');
    const ghOwner = localStorage.getItem('gh_owner');
    const ghRepo = localStorage.getItem('gh_repo');
    if (ghToken) {
        document.getElementById('github-token').value = ghToken;
        APP_STATE.adminMode = true;
        document.getElementById('admin-trigger').style.opacity = '1';
    }
    if (openaiKey) document.getElementById('openai-key').value = openaiKey;
    if (ghOwner) document.getElementById('github-owner').value = ghOwner;
    if (ghRepo) document.getElementById('github-repo').value = ghRepo;
}
function saveSettings() {
    const ghToken = document.getElementById('github-token').value.trim();
    const openaiKey = document.getElementById('openai-key').value.trim();
    const ghOwner = document.getElementById('github-owner').value.trim();
    const ghRepo = document.getElementById('github-repo').value.trim();
    if (ghToken) localStorage.setItem('gh_token', ghToken);
    if (openaiKey) localStorage.setItem('openai_key', openaiKey);
    if (ghOwner) localStorage.setItem('gh_owner', ghOwner);
    if (ghRepo) localStorage.setItem('gh_repo', ghRepo);
    alert('Settings saved!');
    loadSettings();
}
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    loadSettings();
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    document.getElementById('send-chat').addEventListener('click', handleChat);
});