# Profoundry

<img src="media/logo.png" alt="Profoundry" width="400">


Profoundry is a module for Foundry VTT designed to assist GMs in guiding their players with their character development. It gives players the ability to flesh out their existing characters by answering questions about them.
This module provides a curated list of categorized questions that can be to prompt discussions, helping the players develop and understand their characters better.
The module posts a random question to chat based on the different selected categories.

## Install

`https://raw.githubusercontent.com/orangebutblue/fvtt-profoundry/main/module.json`

## Usage
As a GM, just select the question mark icon from the Scene controls on the left sidebar

Then select the categories you want questions from (I recommend only using a single category at a time) and the number of questions you want to fetch at the same time.

All questions will be whispered to the GM. If you like a question, right-click it and select 'Reveal to Everyone' (or just ask them the question yourself).

![Profoundry UI](https://raw.githubusercontent.com/orangebutblue/fvtt-profoundry/refs/heads/main/media/screenshot.png)

## Contributing

### Bugs and feature requests
This is my first Foundry module, so I'm sure there are a lot of things that can be improved. If you find a bug or have a feature request, please open an [issue](https://github.com/orangebutblue/fvtt-profoundry/issues) here on GitHub

### New questions
Contributions to the Character Questions are welcome! If you want to add your own questions to the module, just add it to the questions.json and send me a merge request. You can add the question in any language you like, however it is mandatory for every question to have at least an English translation.

## Requirements for new questions:
- Questions should be formulated as if addressing the character directly.
  - Example: "What is your favorite color?" instead of "What is the character's favorite color?"
- Questions should be open-ended and not have a yes/no answer
- Questions should be categorized accordingly. If you want a new category to be added, open an issue and I will consider it.
- Questions should be written in a way that they can be answered by any character, regardless of the setting or system.
  - Example: "What is your favorite spell?" is not suitable, as it assumes the character is a spellcaster.
- Before adding a new question, please check if there isn't already a similar question in the list.
### Translating
Profundry can support multiple languages. If you want, you can translate the existing questions to the language of your choice.
Just add another key to an existing question with your language code and the translation.
Example:
```json
{"en": "What is your favorite color?","es": "¿Cuál es tu color favorito?"}
```
