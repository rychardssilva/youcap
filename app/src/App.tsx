import { useEffect } from "react";

import { AppShell } from "@/app/app-shell";
import { CaptureOverlay } from "@/features/capture/capture-overlay";
import { OcrReview } from "@/features/capture/ocr-review";
import { LookupPopup } from "@/features/lookup/lookup-popup";
import { listSettings } from "@/services/settings-service";
import { useThemeStore } from "@/stores/theme-store";

function App() {
  const { theme, hydrateTheme, setTheme } = useThemeStore();
  const route = window.location.hash.split("?")[0];

  useEffect(() => {
    hydrateTheme();
    void listSettings().then((settings) => {
      const storedTheme = settings.find((setting) => setting.key === "theme")?.value;
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }
    });
  }, [hydrateTheme, setTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (route === "#/capture-overlay") {
    return <CaptureOverlay />;
  }

  if (route === "#/ocr-review") {
    return <OcrReview />;
  }

  if (route === "#/lookup-popup") {
    return <LookupPopup />;
  }

  return <AppShell />;
}

export default App;
