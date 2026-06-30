import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import { store } from "src/store/store";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found");
}

createRoot(rootEl).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
