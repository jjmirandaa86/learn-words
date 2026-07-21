"use client";

import type { Word } from "@/types/word";

const audioCacheStorageKey = "learn-words:pronunciation-audio-urls";

function getAudioCacheKey(word: string) {
  return word.trim().toLowerCase();
}

function readAudioCache() {
  try {
    const cachedValue = window.localStorage.getItem(audioCacheStorageKey);

    if (!cachedValue) {
      return {};
    }

    return JSON.parse(cachedValue) as Record<string, string>;
  } catch {
    return {};
  }
}

function getCachedAudioUrl(word: string) {
  return readAudioCache()[getAudioCacheKey(word)] ?? null;
}

function setCachedAudioUrl(word: string, audioUrl: string) {
  try {
    const audioCache = readAudioCache();

    window.localStorage.setItem(
      audioCacheStorageKey,
      JSON.stringify({
        ...audioCache,
        [getAudioCacheKey(word)]: audioUrl,
      }),
    );
  } catch {
    // Audio playback should still work when browser storage is unavailable.
  }
}

export async function playPronunciationAudio(word: Word) {
  const cachedAudioUrl = getCachedAudioUrl(word.wordOrExpression);

  if (cachedAudioUrl) {
    await new Audio(cachedAudioUrl).play();
    return;
  }

  const response = await fetch(
    `/api/pronunciation?word=${encodeURIComponent(word.wordOrExpression)}`,
  );

  if (!response.ok) {
    throw new Error("No audio found");
  }

  const result = (await response.json()) as {
    data?: {
      audioUrl?: string;
    };
  };
  const audioUrl = result.data?.audioUrl;

  if (!audioUrl) {
    throw new Error("No audio found");
  }

  setCachedAudioUrl(word.wordOrExpression, audioUrl);
  await new Audio(audioUrl).play();
}
