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
        super.activateListeners(html);
        
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
    console.log('Character Questions | Initializing module - START');

    // Register Handlebars helpers for V2 Application templates
    registerHandlebarsHelpers();

    // Register module settings
    registerModuleSettings();

    // Register settings change handlers
    registerSettingsChangeHandlers();

    // Scene controls will be initialized later in the ready hook

    console.log('Character Questions | Module initialized - END');
});

// Ready hook - module fully loaded
Hooks.once('ready', async () => {
    console.log('Character Questions | Ready hook fired - START');

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
                // Add to sidebar header instead of directory
                html.find('.sidebar-header').first().append(button);
                console.log('Character Questions | Test button added to sidebar header');
            }
        });

        console.log('Character Questions | Setup complete - END');

        // Fallback: Poll for scene controls and add button if needed
        let pollCount = 0;
        const maxPolls = 20; // 10 seconds at 500ms intervals
        const pollInterval = setInterval(() => {
            pollCount++;
            console.log(`Character Questions | Poll ${pollCount}: Checking for scene controls`);
            
            // Check if button already exists in the actual scene controls
            const sceneControls = $('#scene-controls');
            if (sceneControls.length > 0 && sceneControls.find('#character-questions-control').length > 0) {
                console.log(`Character Questions | Poll ${pollCount}: Button already exists in scene controls, stopping poll`);
                clearInterval(pollInterval);
                return;
            }
            
            // Try to add button to scene controls
            if (sceneControls.length > 0) {
                console.log(`Character Questions | Poll ${pollCount}: Found scene controls, attempting to add button`);
                if (addButtonToSceneControls(sceneControls)) {
                    console.log(`Character Questions | Poll ${pollCount}: Button added successfully, stopping poll`);
                    clearInterval(pollInterval);
                    return;
                }
            }

            if (pollCount >= maxPolls) {
                console.log('Character Questions | Polling stopped after max attempts - no suitable element found');
                clearInterval(pollInterval);
            }
        }, 500);

    } catch (error) {
        console.error('Character Questions | Setup failed:', error);
        ui.notifications.error(`Character Questions setup failed: ${error.message}`);
    }
});

/**
 * Register Handlebars helpers for V2 Application templates
 */
function registerHandlebarsHelpers() {
    const helpers = {
        // Equality helper for template conditionals
        'eq': function(a, b) {
            return a === b;
        },

        // Inequality helper
        'ne': function(a, b) {
            return a !== b;
        },

        // Greater-than-or-equal helper
        'gte': function(a, b) {
            if (typeof a === 'string') a = Number(a);
            if (typeof b === 'string') b = Number(b);
            return a >= b;
        },

        // Greater-than helper
        'gt': function(a, b) {
            if (typeof a === 'string') a = Number(a);
            if (typeof b === 'string') b = Number(b);
            return a > b;
        },

        // Date formatting helper
        'formatDate': function(dateString) {
            if (!dateString) return 'Unknown';

            // If it's already in the correct format (YYYY-MM-DD HH:mm), return as is
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
                return dateString;
            }

            // Try to parse and format the date
            let date;
            if (typeof dateString === 'string') {
                date = new Date(dateString);
            } else if (dateString instanceof Date) {
                date = dateString;
            } else if (typeof dateString === 'number') {
                date = new Date(dateString);
            } else {
                return 'Invalid Date';
            }

            // Check if date is valid
            if (isNaN(date.getTime())) {
                return 'Invalid Date';
            }

            // Format as YYYY-MM-DD HH:mm
            const year = date.getFullYear().toString();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            return `${year}-${month}-${day} ${hours}:${minutes}`;
        },

        // Logical AND helper
        'and': function() {
            const args = Array.prototype.slice.call(arguments, 0, -1);
            return args.every(Boolean);
        },

        // Logical OR helper
        'or': function() {
            const args = Array.prototype.slice.call(arguments, 0, -1);
            return args.some(Boolean);
        },

        // Format number helper
        'formatNumber': function(number) {
            if (typeof number !== 'number') return number;
            return number.toLocaleString();
        },

        // Capitalize helper
        'capitalize': function(str) {
            if (typeof str !== 'string') return str;
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        // Join array helper
        'join': function(array, separator) {
            if (!Array.isArray(array)) return '';
            return array.join(separator || ', ');
        },

        // Keys helper - get object keys
        'keys': function(obj) {
            if (!obj || typeof obj !== 'object') return [];
            return Object.keys(obj);
        }

        // REMOVED 'selected' helper - it was interfering with Foundry's FilePicker
        // The FilePicker relies on its own selection logic and this helper was breaking it
    };

    // Register helpers only if they don't already exist
    Object.keys(helpers).forEach(helperName => {
        if (!Handlebars.helpers[helperName]) {
            Handlebars.registerHelper(helperName, helpers[helperName]);
            console.log(`Character Questions | Registered Handlebars helper: ${helperName}`);
        } else {
            console.log(`Character Questions | Handlebars helper ${helperName} already exists, skipping`);
        }
    });

    console.log('Character Questions | Handlebars helpers registration complete');
}

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
            console.log('Character Questions | Scene controls hook fired - START');
            console.log('Character Questions | Hook name:', hookName);
            console.log('Character Questions | Current controls:', controls.map(c => ({ name: c.name, tools: c.tools?.length || 0 })));

            // Check if our control already exists to prevent duplicates
            const existingControl = controls.find(c => c.name === 'character-questions');
            if (existingControl) {
                console.log('Character Questions | Control already exists, skipping duplicate - END');
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
            console.log('Character Questions | Controls added successfully to scene controls - END');
            console.log('Character Questions | Updated controls:', controls.map(c => c.name));
        });

        console.log('Character Questions | Scene controls complete - hook registered');

        // Also listen for render to inject our button into the HTML directly
        Hooks.on('renderSceneControls', (app, html, data) => {
            console.log('Character Questions | renderSceneControls fired - START');
            console.log('Character Questions | App:', app?.constructor?.name);
            console.log('Character Questions | HTML type:', typeof html, html instanceof jQuery ? 'jQuery' : 'not jQuery');

            // Ensure html is a jQuery object
            const $html = html instanceof jQuery ? html : $(html);
            console.log('Character Questions | HTML element:', $html[0]?.tagName, $html[0]?.id, $html[0]?.className);

            // Check if button already exists
            if ($html.find('#character-questions-control').length > 0) {
                console.log('Character Questions | Button already in HTML - END');
                return;
            }

            console.log('Character Questions | Adding button to scene controls HTML');

            const majorVersion = parseInt(game.version?.split('.')[0] || '0');
            console.log('Character Questions | Major version for controls:', majorVersion);

            if (majorVersion >= 13) {
                // V13+ uses <menu> elements with buttons
                console.log('Character Questions | Looking for v13 layers menu');
                const layersMenu = $html.find('menu#scene-controls-layers');
                console.log('Character Questions | Layers menu found:', layersMenu.length, layersMenu[0]?.tagName);

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
                        return false;
                    });

                    layersMenu.append(buttonLi);
                    console.log('Character Questions | Button added to v13 layers menu - END');
                } else {
                    console.warn('Character Questions | Could not find v13 layers menu');
                    console.log('Character Questions | Available menus:', $html.find('menu').map((i, el) => `${el.tagName}#${el.id}.${el.className}`).get());
                    console.log('Character Questions | Full HTML structure:', $html[0]?.outerHTML?.substring(0, 1000));
                }
            } else {
                // V11/V12 use <ol> elements with <li> items
                console.log('Character Questions | Looking for v11/v12 controls list');
                let controlsList = $html.find('ol.main-controls');
                console.log('Character Questions | main-controls found:', controlsList.length);
                if (controlsList.length === 0) {
                    controlsList = $html.find('ol.control-tools');
                    console.log('Character Questions | control-tools found:', controlsList.length);
                }
                if (controlsList.length === 0) {
                    controlsList = $html.find('ol').first();
                    console.log('Character Questions | first ol found:', controlsList.length, controlsList[0]?.className);
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
                        event.stopPropagation();
                        openCharacterQuestionsDialog();
                        return false;
                    });

                    controlsList.append(buttonLi);
                    console.log('Character Questions | Button added to v11/v12 controls list - END');
                } else {
                    console.warn('Character Questions | Could not find any controls list for v11/v12');
                    console.log('Character Questions | Available ols:', $html.find('ol').map((i, el) => `${el.tagName}.${el.className}#${el.id}`).get());
                    console.log('Character Questions | HTML structure:', $html[0]?.outerHTML?.substring(0, 500));
                }
            }
        });

        // Removed dangerous renderApplication hook that was interfering with FilePicker
        // The combination of renderSceneControls hook + polling is sufficient

    } catch (error) {
        console.error('Character Questions | Scene controls integration failed:', error);
        ui.notifications.warn('Character Questions scene controls integration failed.');
    }
}

/**
 * Fallback function to add button directly to scene controls HTML
 * Returns true if button was added, false otherwise
 */
function addButtonToSceneControls($html) {
    console.log('Character Questions | addButtonToSceneControls called');

    const majorVersion = parseInt(game.version?.split('.')[0] || '0');
    console.log('Character Questions | Major version for fallback:', majorVersion);

    if (majorVersion >= 13) {
        const layersMenu = $html.find('menu#scene-controls-layers');
        if (layersMenu.length > 0) {
            console.log('Character Questions | Fallback: Adding to v13 layers menu');

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
                console.log('Character Questions | Fallback button clicked!');
                event.preventDefault();
                event.stopPropagation();
                openCharacterQuestionsDialog();
                return false;
            });

            layersMenu.append(buttonLi);
            console.log('Character Questions | Fallback button added to v13 layers menu');
            return true;
        } else {
            console.log('Character Questions | Fallback: No v13 layers menu found, skipping');
            return false;
        }
    } else {
        let controlsList = $html.find('ol.main-controls');
        if (controlsList.length === 0) {
            controlsList = $html.find('ol.control-tools');
        }
        if (controlsList.length === 0) {
            controlsList = $html.find('ol').first();
        }

        if (controlsList.length > 0) {
            console.log('Character Questions | Fallback: Adding to v11/v12 controls list');

            const buttonLi = $(`
                <li id="character-questions-control" class="scene-control" data-control="character-questions" title="Character Questions">
                    <i class="fas fa-question-circle"></i>
                </li>
            `);

            buttonLi.on('click', (event) => {
                console.log('Character Questions | Fallback button clicked!');
                event.preventDefault();
                event.stopPropagation();
                openCharacterQuestionsDialog();
                return false;
            });

            controlsList.append(buttonLi);
            console.log('Character Questions | Fallback button added to v11/v12 controls list');
            return true;
        } else {
            console.log('Character Questions | Fallback: No v11/v12 controls list found, skipping');
            return false;
        }
    }
}

/**
 * Open the character questions floating UI
 */
function openCharacterQuestionsDialog() {
    try {
        console.log('Character Questions | Opening floating UI');

        // If already rendered, close it
        if (window.characterQuestionsInstance && window.characterQuestionsInstance.isRendered) {
            window.characterQuestionsInstance.close();
            return;
        }

        // Create new instance
        window.characterQuestionsInstance = new CharacterQuestions();
        window.characterQuestionsInstance.render(true);

        console.log('Character Questions | Floating UI opened successfully');
    } catch (error) {
        console.error('Character Questions | Error opening floating UI:', error);
        ui.notifications.error('Error opening Character Questions. Check console for details.');
    }
}