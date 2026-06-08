import { useState } from "react";

import TranslatorPage from "./pages/TranslatorPage";
import SayItPage from "./pages/SayItPage";

type Page = "translator" | "say-it";

function App() {
  const [activePage, setActivePage] = useState<Page>("translator");

  return (
    <div className="app-shell">
      <header className="app-header">
        <nav className="app-tabs" aria-label="Primary navigation">
          <button
            className={activePage === "translator" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("translator")}
          >
            Translator
          </button>
          <button
            className={activePage === "say-it" ? "tab active" : "tab"}
            type="button"
            onClick={() => setActivePage("say-it")}
          >
            Say it
          </button>
        </nav>
      </header>

      {activePage === "translator" ? <TranslatorPage /> : <SayItPage />}
    </div>
  );
}

export default App;
