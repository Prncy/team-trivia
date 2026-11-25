# Team Trivia

A lightweight React + Vite trivia game for a single laptop and projector. No backend is required.

## Run locally

1. Install Node.js (LTS).
2. Extract this folder.
3. Open a terminal in the project folder.
4. Run `npm install`.
5. Run `npm run dev`.
6. Open the local address Vite prints (usually http://localhost:5173).

Build for production with `npm run build`.

## Question bank

Edit `src/data/questions.js`. Add a new object to the `questionBank` array:

```js
{
  id: "GK011", // unique ID
  category: "General Knowledge",
  question: "Your question here?",
  answer: "The accepted answer",
  difficulty: "Medium"
}
```

Supported categories:
- General Knowledge
- Technology
- Sports
- Music & Entertainment
- Geography & History
- Science

Difficulty labels: Easy, Medium, Challenging.

## Game behaviour

- Correct answers receive the configured points.
- Incorrect and passed answers receive zero.
- `P` records a pass in the round scoreboard.
- Questions are retired once the operator records a result.
- The timer begins only when the operator presses Start answering.
- Enter 0 seconds in setup for an unlimited timer.
- Progress is saved automatically in this browser's LocalStorage.
- `P` pauses/resumes the game; `Esc` opens/closes the game menu.
- Game settings can be changed from the menu while paused (timer duration and correct-answer points).

## Important notes

- LocalStorage survives refreshes but can be cleared by browser data cleanup. Use the same browser and device for the event.
- This first release is designed for one browser window. A separate presenter/display mode can be added later.
- The browser needs to be opened once while online if fonts are to load from Google Fonts; the app itself does not require a server or account once dependencies are installed and the project is running locally.
