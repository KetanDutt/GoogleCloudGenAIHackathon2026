"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { results: ArrayLike<SpeechResult> };
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const subscribe = () => () => {};
const supported = () =>
  !!(
    (window as SpeechWindow).SpeechRecognition ||
    (window as SpeechWindow).webkitSpeechRecognition
  );

export function useDictation(onText: (text: string) => void) {
  const isSupported = useSyncExternalStore(subscribe, supported, () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  useEffect(
    () => () => {
      const current = recognition.current;
      if (current) {
        current.onresult = null;
        current.onend = null;
        current.onerror = null;
        current.abort();
      }
    },
    [],
  );
  function stop() {
    recognition.current?.abort();
    setListening(false);
  }
  function toggle() {
    if (listening) {
      stop();
      return;
    }
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) return;
    const instance = new Constructor();
    recognition.current = instance;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language;
    instance.onresult = (event) =>
      onText(
        Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(" ")
          .slice(0, 8000),
      );
    instance.onend = () => setListening(false);
    instance.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted")
        toast.error(
          event.error === "not-allowed"
            ? "Microphone permission was denied. You can keep typing instead."
            : "Dictation stopped. Please try again or type your message.",
        );
    };
    try {
      instance.start();
      setListening(true);
    } catch {
      toast.error("Your browser could not start dictation.");
      setListening(false);
    }
  }
  return { isSupported, listening, toggle, stop };
}
