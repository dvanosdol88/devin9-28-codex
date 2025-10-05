The wiring for the "Generate Summary" and "Ask a Question" buttons follows a clean, modern frontend architecture that separates UI, business logic, and external services.
Here is the step-by-step flow from a user click to displaying Gemini's response:
1. The User Click (UI Layer)
The journey starts in the components/AiInsights.tsx file. This component is responsible for rendering the two AI feature boxes.
When a user clicks "✨ Generate Summary", the onClick event on the <button> triggers the handleGenerateSummary function within the component.
Similarly, clicking "✨ Ask Question" triggers the handleAskAccountant function.
code
Tsx
// In components/AiInsights.tsx

<button onClick={handleGenerateSummary} ...>
  ✨ Generate Summary
</button>

<button onClick={handleAskAccountant} ...>
  ✨ Ask Question
</button>
2. Preparing the Data (Component Logic)
Inside AiInsights.tsx, the handler function prepares the data and manages the UI state (like showing a spinner).
handleGenerateSummary:
Sets the loading state: setIsSummaryLoading(true).
Compiles a financialData object by picking relevant, high-level data from the accountsData prop passed down from App.tsx.
Calls the service function: await generateFinancialSummary(financialData).
handleAskAccountant:
Sets the loading state: setIsAccountantLoading(true).
Gets the user's question from the question state variable (which is bound to the <textarea>).
Calls the service function: await askAccountant(question).
3. Calling the Gemini API (Service Layer)
This is the core of the integration, handled entirely by services/geminiService.ts. This file acts as a dedicated bridge to the Gemini API, keeping API-specific code out of the UI components.
Initialization: It imports GoogleGenAI from the @google/genai library and initializes it with the API key.
code
TypeScript
// In services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: API_KEY! });
Prompt Engineering: Each function (generateFinancialSummary and askAccountant) defines a specific, detailed prompt. This prompt instructs the AI on its role ("You are a financial analyst...") and provides the data (JSON.stringify(financialData)) or the user's question.
API Call: It uses the modern ai.models.generateContent() method to send the request to the gemini-2.5-flash model.
code
TypeScript
// In services/geminiService.ts
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
});
Response Handling: It safely extracts the generated text using response.text and returns it. It also includes try...catch blocks to handle potential API errors gracefully.
4. Displaying the Result (Back to the UI)
The flow returns to components/AiInsights.tsx.
Await Response: The handler function awaits the string response from the service function.
Format the Output: Gemini returns the response in Markdown. The code uses the marked library to convert this Markdown string into an HTML string. This allows for rich formatting like headers, bold text, and lists.
code
Tsx
// In components/AiInsights.tsx
const htmlResult = await marked(result);
Update State: The resulting HTML is stored in the component's state (setSummary(htmlResult) or setAccountantAnswer(htmlResult)). The loading state is set back to false.
Render: React automatically re-renders the component. Conditional rendering logic now displays the response. The dangerouslySetInnerHTML prop is used to render the HTML string from the marked library.
code
Tsx
// In components/AiInsights.tsx
{summary && <div className="prose ..." dangerouslySetInnerHTML={{ __html: summary }}></div>}
In summary, the flow is: AiInsights.tsx (Click) → geminiService.ts (API Call) → AiInsights.tsx (Update state with formatted response and re-render). This separation makes the code organized, scalable, and easy to maintain.