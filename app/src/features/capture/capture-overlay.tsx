import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import {
  captureImageSrc,
  completeCaptureSelection,
  getCurrentCaptureSession,
  cancelCapture,
  type CaptureSession,
} from "@/services/capture-service";

type Point = {
  x: number;
  y: number;
};

type Selection = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function CaptureOverlay() {
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState<CaptureSession | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [sessionFailed, setSessionFailed] = useState(false);

  const selection = useMemo<Selection | null>(() => {
    if (!startPoint || !currentPoint) {
      return null;
    }

    const left = Math.min(startPoint.x, currentPoint.x);
    const top = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(startPoint.x - currentPoint.x);
    const height = Math.abs(startPoint.y - currentPoint.y);

    return { left, top, width, height };
  }, [currentPoint, startPoint]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        void cancelCapture();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    void getCurrentCaptureSession()
      .then((nextSession) => {
        setSession(nextSession);
        setSessionFailed(false);
      })
      .catch(() => setSessionFailed(true));

    const unlisten = listen<CaptureSession>("capture_session_ready", (event) => {
      setSession(event.payload);
      setStartPoint(null);
      setCurrentPoint(null);
      setIsProcessing(false);
      setPreviewFailed(false);
      setSessionFailed(false);
    });

    return () => {
      void unlisten.then((cleanup) => cleanup());
    };
  }, []);

  async function finishSelection() {
    if (!session) {
      return;
    }

    if (!selection || selection.width < 8 || selection.height < 8) {
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    const imageScaleX = session.width / window.innerWidth;
    const imageScaleY = session.height / window.innerHeight;

    setIsProcessing(true);
    await completeCaptureSelection({
      session_id: session.id,
      x: Math.round(selection.left * imageScaleX),
      y: Math.round(selection.top * imageScaleY),
      width: Math.round(selection.width * imageScaleX),
      height: Math.round(selection.height * imageScaleY),
    });
  }

  return (
    <main
      className="fixed inset-0 cursor-crosshair select-none overflow-hidden bg-black text-white"
      onMouseDown={(event) => {
        setStartPoint({ x: event.clientX, y: event.clientY });
        setCurrentPoint({ x: event.clientX, y: event.clientY });
      }}
      onMouseMove={(event) => {
        if (startPoint) {
          setCurrentPoint({ x: event.clientX, y: event.clientY });
        }
      }}
      onMouseUp={() => {
        void finishSelection();
      }}
    >
      {session ? (
        <img
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          src={captureImageSrc(session.image_path)}
          alt=""
          onError={() => setPreviewFailed(true)}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-black/10" />

      <div className="pointer-events-none absolute left-4 top-4 rounded-md bg-black/70 px-3 py-2 text-sm">
        {previewFailed
          ? "Nao foi possivel carregar a previa da tela. Esc cancela."
          : sessionFailed
            ? "Nao foi possivel iniciar a sessao. Esc cancela."
            : session
            ? "Arraste para selecionar uma area. Esc cancela."
            : "Preparando captura..."}
      </div>

      {selection ? (
        <div
          className="pointer-events-none absolute border border-white bg-primary/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            left: selection.left,
            top: selection.top,
            width: selection.width,
            height: selection.height,
          }}
        />
      ) : null}

      {isProcessing ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-black/70 px-3 py-2 text-sm">
          Capturando imagem...
        </div>
      ) : null}
    </main>
  );
}
