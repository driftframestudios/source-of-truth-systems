import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../app/theme/ThemeProvider";
import { ThemeSelector } from "../app/theme/ThemeSelector";
import "virtual:documentation-theme.css";
import "./reading.css";
// Static articles and navigation remain usable before this isolated enhancement loads.
const receiver = document.getElementById("docs-appearance");
if (receiver)
  createRoot(receiver).render(
    <ThemeProvider>
      <ThemeSelector />
    </ThemeProvider>,
  );

const navigation = document.querySelector<HTMLDetailsElement>(
  ".docs-sidebar details",
);
if (navigation && window.matchMedia("(max-width: 760px)").matches)
  navigation.open = false;
