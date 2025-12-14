/**
 * Profoundry Module
 * Main module initialization and hook registration
 */

// Module constants
const MODULE_ID = "fvtt-profoundry";

// Global module state
let debugLogger = null;
let errorHandler = null;
let configValidator = null;

/**
 * Character Questions Form Application
 */
class CharacterQuestions extends Application {
    constructor(options = {}) {
        super(options);
        this.questions = [];
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "character-questions",
            template: `modules/${MODULE_ID}/templates/form.html`,
            width: 400,
            height: 600,
            resizable: true,
            minimizable: true,
            title: "Profoundry",
        });
    }

    async getData() {
        const savedData = game.settings.get(MODULE_ID, 'formData') || {};
        const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];

        // Fetch category counts
        const categoryCounts = await this.getCategoryCounts(blockedQuestions);

        return {
            language: savedData.language || 'en',
            blockedQuestions: blockedQuestions,
            blockedCount: blockedQuestions.length,
            categoryCounts: categoryCounts
        };
    }

    async getCategoryCounts(blockedQuestions) {
        const jsonUrl = 'https://raw.githubusercontent.com/orangebutblue/CharacterQuestions/main/questions.json';

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`Error fetching JSON: ${response.statusText}`);
            }
            const data = await response.json();

            // Calculate available questions for each category
            const categories = ['background', 'motivations', 'personality', 'values', 'relationships', 'secrets', 'weakness', 'interests', 'society'];
            const counts = {};

            categories.forEach(category => {
                if (data[category] && Array.isArray(data[category])) {
                    const totalQuestions = data[category].length;
                    const blockedInCategory = data[category].filter(q => blockedQuestions.includes(q.en)).length;

                    // Also subtract questions that are currently selected in this session
                    const currentCategoryQuestions = (this.questions || []).filter(q => q.category === category);
                    const selectedInCategory = currentCategoryQuestions.length;

                    counts[category] = totalQuestions - blockedInCategory - selectedInCategory;
                } else {
                    counts[category] = 0;
                }
            });

            return counts;
        } catch (error) {
            console.error('Character Questions | Error fetching category counts:', error);
            // Return zeros for all categories if fetch fails
            return {
                background: 0,
                motivations: 0,
                personality: 0,
                values: 0,
                relationships: 0,
                secrets: 0,
                weakness: 0,
                interests: 0,
                society: 0
            };
        }
    }

    activateListeners(html) {
        // Only activate once
        if (this._listenersActivated) return;
        this._listenersActivated = true;

        // Language selection changes
        const languageSelect = html.find('#language');
        // Set initial value from saved settings
        const savedData = game.settings.get(MODULE_ID, 'formData') || {};
        languageSelect.val(savedData.language || 'en');

        languageSelect.on('change', () => {
            const formData = { language: languageSelect.val() };
            game.settings.set(MODULE_ID, 'formData', formData);
        });

        // Category button clicks
        html.on('click', '.category-btn', (event) => {
            const category = event.currentTarget.dataset.category;
            this.addQuestion(category);
        });

        // Delete question buttons
        html.on('click', '.question-delete', (event) => {
            const questionId = event.currentTarget.dataset.questionId;
            this.deleteQuestion(questionId);
        });

        // Chat question buttons
        html.on('click', '.question-chat', (event) => {
            const questionId = event.currentTarget.dataset.questionId;
            this.sendQuestionToChat(questionId);
        });

        // Block question buttons
        html.on('click', '.question-block', (event) => {
            const questionId = event.currentTarget.dataset.questionId;
            this.blockQuestion(questionId);
        });

        // Toggle blocked questions section
        html.on('click', '.toggle-blocked-btn', (event) => {
            const list = this.element.find('.blocked-questions-list');
            const icon = this.element.find('.toggle-blocked-btn i');
            if (list.is(':visible')) {
                list.slideUp();
                icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
            } else {
                list.slideDown();
                icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
            }
        });

        // Unblock question buttons
        html.on('click', '.unblock-btn', (event) => {
            const questionText = event.currentTarget.dataset.question;
            this.unblockQuestion(questionText);
        });

        // Clear all questions
        html.on('click', '.clear-btn', (event) => {
            this.clearAllQuestions();
        });

        // Initialize blocked questions display
        this.updateBlockedQuestionsDisplay();
    }

    async addQuestion(category) {
        const button = this.element.find(`[data-category="${category}"]`);
        const language = this.element.find('#language').val() || 'en';
        const jsonUrl = 'https://raw.githubusercontent.com/orangebutblue/CharacterQuestions/main/questions.json';

        // Set loading state
        button.addClass('loading');

        try {
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                throw new Error(`Error fetching JSON: ${response.statusText}`);
            }
            const data = await response.json();

            if (data[category] && data[category].length > 0) {
                // Get blocked questions
                const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];

                // Filter out blocked questions
                let availableQuestions = data[category].filter(q => !blockedQuestions.includes(q.en));

                // Also filter out questions that are already selected in the current session
                const currentCategoryQuestions = (this.questions || []).filter(q => q.category === category);
                availableQuestions = availableQuestions.filter(q =>
                    !currentCategoryQuestions.some(selectedQ => selectedQ.questionData.en === q.en)
                );

                if (availableQuestions.length === 0) {
                    ui.notifications.warn(`No more unique questions available in the ${category} category. Remove some questions first or try a different category.`);
                    return;
                }

                const randomIndex = Math.floor(Math.random() * availableQuestions.length);
                const questionData = availableQuestions[randomIndex];
                const question = questionData[language] || questionData.en;

                // Create unique ID for this question
                const questionId = `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // Add to our questions collection
                if (!this.questions) this.questions = [];
                this.questions.unshift({
                    id: questionId,
                    category: category,
                    question: question,
                    questionData: questionData // Store the full question data for blocking
                });

                // Update display
                this.updateQuestionsDisplay();

                // Update category counts since we now have one less available
                this.updateCategoryCounts();
            } else {
                ui.notifications.warn(`No questions available in the ${category} category.`);
            }

        } catch (error) {
            console.error('Character Questions | Error adding question:', error);
            ui.notifications.error('Error adding question. Check console for details.');
        } finally {
            // Remove loading state
            button.removeClass('loading');
        }
    }

    deleteQuestion(questionId) {
        if (this.questions) {
            this.questions = this.questions.filter(q => q.id !== questionId);
            this.updateQuestionsDisplay();
            // Update category counts since we now have one more available
            this.updateCategoryCounts();
        }
    }

    sendQuestionToChat(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (question) {
            ChatMessage.create({
                user: game.user.id,
                content: `Question about <i>${question.category.charAt(0).toUpperCase() + question.category.slice(1)}</i>:<br/><b>${question.question}</b>`,
            });
            ui.notifications.info('Question sent to chat!');
        }
    }

    blockQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (question && question.questionData && question.questionData.en) {
            const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];
            if (!blockedQuestions.includes(question.questionData.en)) {
                blockedQuestions.push(question.questionData.en);
                game.settings.set(MODULE_ID, 'blockedQuestions', blockedQuestions);
                ui.notifications.info('Question blocked from future appearances.');
                // Update the blocked count in the header and the list contents
                this.updateBlockedCount();
                this.updateBlockedQuestionsDisplay();
                // Update category counts
                this.updateCategoryCounts();
            }
            // Remove from current list
            this.deleteQuestion(questionId);
        }
    }

    unblockQuestion(questionText) {
        const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];
        const index = blockedQuestions.indexOf(questionText);
        if (index !== -1) {
            blockedQuestions.splice(index, 1);
            game.settings.set(MODULE_ID, 'blockedQuestions', blockedQuestions);
            ui.notifications.info('Question unblocked.');
            // Update the blocked questions display
            this.updateBlockedQuestionsDisplay();
            // Update category counts
            this.updateCategoryCounts();
        }
    }

    clearAllQuestions() {
        this.questions = [];
        this.updateQuestionsDisplay();
        // Update category counts since all questions are now available again
        this.updateCategoryCounts();
    }

    updateQuestionsDisplay() {
        const questionsList = this.element.find('#questions-list');

        if (!this.questions || this.questions.length === 0) {
            questionsList.html(`
                <div class="empty-state">
                    <i class="fas fa-question-circle"></i>
                    <p>Click category buttons to add questions</p>
                </div>
            `);
            return;
        }

        const questionsHtml = this.questions.map(q => `
            <div class="question-item">
                <div style="flex: 1;">
                    <span class="question-category">${q.category.charAt(0).toUpperCase() + q.category.slice(1)}</span>
                    <p class="question-text">${q.question}</p>
                </div>
                <div class="question-actions">
                    <button class="question-chat" data-question-id="${q.id}" title="Send to chat">
                        <i class="fas fa-comment"></i>
                    </button>
                    <button class="question-block" data-question-id="${q.id}" title="Block this question">
                        <i class="fas fa-ban"></i>
                    </button>
                    <button class="question-delete" data-question-id="${q.id}" title="Remove this question">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');

        questionsList.html(questionsHtml);
    }

    updateBlockedCount() {
        const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];
        const headerSpan = this.element.find('.toggle-blocked-btn span');
        headerSpan.text(`Blocked Questions (${blockedQuestions.length})`);
    }

    updateBlockedQuestionsDisplay() {
        const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];
        const blockedList = this.element.find('.blocked-questions-list');

        if (blockedQuestions.length === 0) {
            blockedList.html('<p class="empty-blocked">No questions blocked</p>');
            return;
        }

        const blockedHtml = blockedQuestions.map(question => `
            <div class="blocked-question-item">
                <span class="blocked-question-text">${question}</span>
                <button class="unblock-btn" data-question="${question}" title="Unblock this question">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        blockedList.html(blockedHtml);
    }

    async updateCategoryCounts() {
        const blockedQuestions = game.settings.get(MODULE_ID, 'blockedQuestions') || [];
        const counts = await this.getCategoryCounts(blockedQuestions);

        // Update each category count badge
        Object.keys(counts).forEach(category => {
            const countElement = this.element.find(`[data-category="${category}"] .category-count`);
            if (countElement.length) {
                countElement.text(counts[category]);
            }
        });
    }

    close() {
        if (this.element) {
            this.element.remove();
        }
        return super.close();
    }
}

// Module initialization
Hooks.once('init', () => {
    console.log('Character Questions | Initializing module');

    // Register module settings
    registerModuleSettings();

    // Register settings change handlers
    registerSettingsChangeHandlers();

    // Scene controls will be initialized later in the ready hook

    console.log('Character Questions | Module initialized');
});

// Ready hook - module fully loaded
Hooks.once('ready', async () => {
    console.log('Character Questions | Module ready');

    try {
        // Initialize native UI integration
        await initializeProperSceneControls();

        // TEMPORARY: Add a debug button to the UI
        Hooks.on('renderSidebar', (app, html) => {
            console.log('Character Questions | renderSidebar hook fired');
            if ($('#character-questions-test-button').length === 0) {
                const button = $(`<button id="character-questions-test-button" style="margin: 5px;">
                    <i class="fas fa-question-circle"></i> Character Questions (Test)
                </button>`);
                button.on('click', () => {
                    console.log('Character Questions | Test button clicked');
                    openCharacterQuestionsDialog();
                });
                html.find('.directory').first().prepend(button);
                console.log('Character Questions | Test button added to sidebar');
            }
        });

        console.log('Character Questions | Setup complete');

    } catch (error) {
        console.error('Character Questions | Setup failed:', error);
        ui.notifications.error(`Character Questions setup failed: ${error.message}`);
    }
});

/**
 * Register module settings with FoundryVTT
 */
function registerModuleSettings() {
    // Form data setting
    game.settings.register(MODULE_ID, 'formData', {
        name: 'Form Data',
        hint: 'Data from the form',
        scope: 'world',
        config: false,
        default: {},
        type: Object,
    });

    // Blocked questions setting
    game.settings.register(MODULE_ID, 'blockedQuestions', {
        name: 'Blocked Questions',
        hint: 'List of questions that have been blocked from appearing',
        scope: 'world',
        config: false,
        default: [],
        type: Array,
    });

    console.log('Character Questions | Settings registered');
}

/**
 * Register settings change handlers
 */
function registerSettingsChangeHandlers() {
    // Additional setup for change handlers if needed
    console.log('Character Questions | Settings change handlers registered');
}

/**
 * Initialize proper scene controls integration ONLY
 */
async function initializeProperSceneControls() {
    console.log('Character Questions | Initializing scene controls integration');

    try {
        // Use basic fallback directly (no sophisticated classes available)
        console.log('Character Questions | Using basic scene controls');
        await initializeBasicSceneControls();
    } catch (error) {
        console.error('Character Questions | Scene controls integration failed:', error);
        ui.notifications.warn('Character Questions scene controls integration failed.');
    }
}

/**
 * Basic scene controls fallback
 */
async function initializeBasicSceneControls() {
    console.log('Character Questions | Initializing scene controls');

    try {
        // Detect Foundry version
        const majorVersion = parseInt(game.version?.split('.')[0] || '0');
        console.log('Character Questions | Detected Foundry version:', game.version, 'Major:', majorVersion);

        // Register the appropriate hook based on version
        const hookName = majorVersion >= 12 ? 'getSceneControls' : 'getSceneControlButtons';
        console.log('Character Questions | Using hook:', hookName);

        Hooks.on(hookName, (controls) => {
            console.log('Character Questions | Scene controls hook fired - adding controls');
            console.log('Character Questions | Current controls:', controls.map(c => c.name));

            // Check if our control already exists to prevent duplicates
            const existingControl = controls.find(c => c.name === 'character-questions');
            if (existingControl) {
                console.log('Character Questions | Control already exists, skipping duplicate');
                return;
            }

            const characterQuestionsControls = {
                name: 'character-questions',
                title: 'Character Questions',
                icon: 'fas fa-question-circle',
                visible: true,
                layer: 'TokenLayer',
                tools: [{
                    name: 'open-questions',
                    title: 'Open Character Questions',
                    icon: 'fas fa-question',
                    button: true,
                    onClick: () => {
                        console.log('Character Questions | Button clicked!');

                        // Try to open the questions dialog
                        try {
                            openCharacterQuestionsDialog();
                        } catch (error) {
                            console.error('Character Questions | Error opening dialog:', error);
                            ui.notifications.error('Error opening Character Questions dialog. Check console for details.');
                        }
                    }
                }]
            };

            controls.push(characterQuestionsControls);
            console.log('Character Questions | Controls added successfully to scene controls');
            console.log('Character Questions | Updated controls:', controls.map(c => c.name));
        });

        console.log('Character Questions | Scene controls complete - hook registered');

        // Also listen for render to inject our button into the HTML directly
        Hooks.on('renderSceneControls', (app, html, data) => {
            console.log('Character Questions | renderSceneControls fired');

            // Ensure html is a jQuery object
            const $html = html instanceof jQuery ? html : $(html);

            // Check if button already exists
            if ($html.find('#character-questions-control').length > 0) {
                console.log('Character Questions | Button already in HTML');
                return;
            }

            console.log('Character Questions | Adding button to scene controls HTML');

            const majorVersion = parseInt(game.version?.split('.')[0] || '0');

            if (majorVersion >= 13) {
                // V13+ uses <menu> elements with buttons
                const layersMenu = $html.find('menu#scene-controls-layers');

                if (layersMenu.length > 0) {
                    console.log('Character Questions | Found v13 layers menu, adding button');

                    const buttonLi = $(`
                        <li id="character-questions-control">
                            <button type="button" class="control ui-control layer icon fa-solid fa-question-circle"
                                    role="tab" data-action="control" data-control="character-questions"
                                    data-tooltip="" aria-pressed="false"
                                    aria-label="Character Questions"
                                    aria-controls="scene-controls-tools">
                            </button>
                        </li>
                    `);

                    buttonLi.find('button').on('click', (event) => {
                        console.log('Character Questions | Scene control button clicked!');
                        event.preventDefault();
                        event.stopPropagation();
                        openCharacterQuestionsDialog();
                    });

                    layersMenu.append(buttonLi);
                    console.log('Character Questions | Button added to v13 layers menu');
                } else {
                    console.warn('Character Questions | Could not find v13 layers menu');
                }
            } else {
                // V11/V12 use <ol> elements with <li> items
                let controlsList = $html.find('ol.main-controls');
                if (controlsList.length === 0) {
                    controlsList = $html.find('ol.control-tools');
                }
                if (controlsList.length === 0) {
                    controlsList = $html.find('ol').first();
                }

                if (controlsList.length > 0) {
                    console.log('Character Questions | Found v11/v12 controls list, adding button');

                    const buttonLi = $(`
                        <li id="character-questions-control" class="scene-control" data-control="character-questions" title="Character Questions">
                            <i class="fas fa-question-circle"></i>
                        </li>
                    `);

                    buttonLi.on('click', (event) => {
                        console.log('Character Questions | Scene control button clicked!');
                        event.preventDefault();
                        openCharacterQuestionsDialog();
                    });

                    controlsList.append(buttonLi);
                    console.log('Character Questions | Button added to v11/v12 controls list');
                } else {
                    console.warn('Character Questions | Could not find any controls list for v11/v12');
                    console.log('Character Questions | HTML structure:', $html[0]?.outerHTML?.substring(0, 500));
                }
            }
        });

    } catch (error) {
        console.error('Character Questions | Scene controls integration failed:', error);
        ui.notifications.warn('Character Questions scene controls integration failed.');
    }
}

/**
 * Open the character questions floating UI
 */
function openCharacterQuestionsDialog() {
    try {
        console.log('Character Questions | Opening floating UI');

        // Use module-scoped storage instead of global window
        const moduleScope = game.modules.get(MODULE_ID);
        if (!moduleScope._characterQuestionsInstance) {
            moduleScope._characterQuestionsInstance = new CharacterQuestions();
        }

        const instance = moduleScope._characterQuestionsInstance;

        // If already rendered, close it
        if (instance.isRendered) {
            instance.close();
            return;
        }

        // Create new instance
        instance.render(true);

        console.log('Character Questions | Floating UI opened successfully');
    } catch (error) {
        console.error('Character Questions | Error opening floating UI:', error);
        ui.notifications.error('Error opening Character Questions. Check console for details.');
    }
}