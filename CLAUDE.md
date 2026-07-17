# Character Questions Foundry VTT Module - AI Coding Guidelines

## Architecture Overview

This is a Foundry VTT module that provides character development questions for Game Masters (GMs) to ask players. The module consists of:

- **FormApplication Class** (`scripts/character-questions.js`): Main UI dialog extending Foundry's FormApplication
- **Question Data** (`questions.json`): Categorized questions in multiple languages (English/German)
- **HTML Template** (`templates/form.html`): Simple form with category checkboxes and settings
- **Module Manifest** (`module.json`): Foundry VTT module configuration

## Key Patterns & Conventions

### Question Data Structure
Questions are stored as JSON objects with language codes as keys:
```json
{
  "background": [
    {"en": "What was your childhood like?", "de": "Wie war deine Kindheit?"}
  ]
}
```

### Foundry VTT Integration
- Use `foundry.utils.mergeObject()` instead of `mergeObject()` for v12+ compatibility
- Register settings with `game.settings.register()` using `scope: 'world'` for persistence
- Add UI elements via version-specific hooks:
  - v11: `Hooks.on("getSceneControlButtons")` for top bar token controls
  - v12+: `Hooks.on("getSceneControls")` for left sidebar controls (e.g., under Notes)
- Use `ChatMessage.create()` with `whisper` for GM-only messages
- Dynamically set template paths using `game.modules.get(MODULE_ID).path` for portability

### Question Selection Logic
- Fetch questions from remote JSON (currently GitHub raw URL)
- Filter by selected categories from form checkboxes
- Random selection with duplicate prevention (splice after selection)
- Validate question count against available questions per category

## Development Workflow

### Adding New Questions
1. Add to appropriate category in `questions.json`
2. Include English translation minimum, other languages optional
3. Questions should be open-ended, character-directed, setting-agnostic
4. Test by selecting category and generating questions

### Module Updates
- Update version in `module.json` following semantic versioning
- Test compatibility with Foundry VTT versions listed in manifest
- No build process required - pure JavaScript module

### Development Setup
- The development directory (`/home/nezha/Documents/projects/fvtt-character-questions`) is symlinked in Foundry VTT as `fvtt-character-questions` in the `Data/modules/` folder for each version (data11, data12, data13)
- **IMPORTANT**: Be aware of existing symlinks and do NOT modify or recreate them, as they are managed externally
- Module ID in `module.json` is `"fvtt-character-questions"`
- Ensure all template paths in JavaScript (e.g., `scripts/character-questions.js`) use dynamic paths or `"modules/fvtt-character-questions/templates/form.html"` to match the symlink
- Changes in the development directory are immediately reflected in Foundry due to the symlinks
- Test on multiple Foundry versions (11, 12, 13) as UI hooks and APIs change between versions
- NEVER run the Zip Module task!

### UI Changes
- Modify `templates/form.html` for form structure
- Update `getData()` in FormApplication for dynamic values
- Use Handlebars helpers for conditional rendering (e.g., `{{selected}}`)

## Code Quality Notes

- Use `foundry.utils.mergeObject()` for option defaults (v12+)
- Handle form data serialization manually for checkboxes vs text inputs
- GM-only features should check `game.user.isGM`
- Settings use world scope for shared GM configuration
- Use version checks (`game.version`) for compatibility with different Foundry versions</content>
<parameter name="filePath">/home/nezha/Documents/projects/fvtt-character-questions/.github/copilot-instructions.md