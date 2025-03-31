import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ChatApplication from "./chat-application";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";
import { LightTheme, BaseProvider } from "baseui";

const root = createRoot(document.getElementById("root")!);
const engine = new Styletron();

root.render(
  <StrictMode>
    <StyletronProvider value={engine}>
      <BaseProvider theme={LightTheme}>
        <ChatApplication />
      </BaseProvider>
    </StyletronProvider>
  </StrictMode>
);
