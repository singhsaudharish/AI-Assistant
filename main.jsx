import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ConfigProvider } from "antd";
import store, { persistor } from "./store";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ConfigProvider>
        <App />
      </ConfigProvider>
    </PersistGate>
  </Provider>
);