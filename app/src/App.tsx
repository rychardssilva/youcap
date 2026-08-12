import { useEffect } from "react";

import { AppShell } from "@/app/app-shell";
import { CaptureOverlay } from "@/features/capture/capture-overlay";
import { OcrReview } from "@/features/capture/ocr-review";
import { LookupPopup } from "@/features/lookup/lookup-popup";
import { OnboardingModal } from "@/features/onboarding/onboarding-modal";
import { listSettings } from "@/services/settings-service";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeStore } from "@/stores/theme-store";

function App() {
  const { theme, hydrateTheme, setTheme } = useThemeStore();
  const setOnboardingOpen = useOnboardingStore((state) => state.setOnboardingOpen);
  const route = window.location.hash.split("?")[0];

  useEffect(() => {
    hydrateTheme();
    void listSettings().then((settings) => {
      const storedTheme = settings.find((setting) => setting.key === "theme")?.value;
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
      }

      const onboardingCompleted = settings.find(
        (setting) => setting.key === "onboarding_completed",
      )?.value;
      const browserOnboardingCompleted = window.localStorage.getItem("yocab.onboarding_completed");
      if (
        route !== "#/capture-overlay" &&
        route !== "#/ocr-review" &&
        route !== "#/lookup-popup" &&
        onboardingCompleted !== "true" &&
        browserOnboardingCompleted !== "true"
      ) {
        setOnboardingOpen(true);
      }
    });
  }, [hydrateTheme, route, setOnboardingOpen, setTheme]);

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

  return (
    <>
      <AppShell />
      <OnboardingModal />
    </>
  );
}

export default App;
