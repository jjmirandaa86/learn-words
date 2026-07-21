import { NextResponse } from "next/server";

type MerriamEntry = {
  hwi?: {
    prs?: Array<{
      sound?: {
        audio?: string;
      };
    }>;
  };
};

type SoundValue = {
  audio?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getAudioSubdirectory(audio: string) {
  if (audio.startsWith("bix")) {
    return "bix";
  }

  if (audio.startsWith("gg")) {
    return "gg";
  }

  if (/^[^a-zA-Z]/.test(audio)) {
    return "number";
  }

  return audio[0].toLowerCase();
}

function buildMerriamAudioUrl(audio: string) {
  const subdirectory = getAudioSubdirectory(audio);

  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`;
}

function buildFallbackAudioCandidates(word: string) {
  const normalizedWord = word.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (!normalizedWord) {
    return [];
  }

  const stems = new Set([normalizedWord]);

  if (normalizedWord.endsWith("ly") && normalizedWord.length > 3) {
    stems.add(normalizedWord.slice(0, -2));
  }

  if (normalizedWord.endsWith("ily") && normalizedWord.length > 4) {
    stems.add(`${normalizedWord.slice(0, -3)}y`);
  }

  if (normalizedWord.endsWith("ally") && normalizedWord.length > 5) {
    stems.add(normalizedWord.slice(0, -4));
  }

  const suffixes = ["", "01", "001", "0001"];

  return Array.from(stems).flatMap((stem) =>
    suffixes.map((suffix) => `${stem}${suffix}`),
  );
}

async function findExistingFallbackAudio(word: string) {
  const candidates = buildFallbackAudioCandidates(word);

  for (const audio of candidates) {
    const response = await fetch(buildMerriamAudioUrl(audio), {
      method: "HEAD",
    });

    if (response.ok) {
      return audio;
    }
  }

  return null;
}

function collectNestedAudio(value: unknown, audios: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNestedAudio(item, audios);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const sound = value.sound;

  if (isRecord(sound) && typeof sound.audio === "string") {
    audios.add(sound.audio);
  }

  for (const nestedValue of Object.values(value)) {
    collectNestedAudio(nestedValue, audios);
  }
}

function findAudio(entries: unknown) {
  if (!Array.isArray(entries)) {
    return null;
  }

  const audios = new Set<string>();

  for (const entry of entries as MerriamEntry[]) {
    const pronunciations = entry.hwi?.prs ?? [];

    for (const pronunciation of pronunciations) {
      const audio = pronunciation.sound?.audio;

      if (audio) {
        audios.add(audio);
      }
    }
  }

  collectNestedAudio(entries, audios);

  return audios.values().next().value ?? null;
}

export async function GET(request: Request) {
  const apiKey = process.env.MERRIAM_WEBSTER_API_KEY;
  const reference = process.env.MERRIAM_WEBSTER_REFERENCE ?? "spanish";
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.trim();

  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing Merriam-Webster API key" },
      { status: 500 },
    );
  }

  const merriamUrl = `https://www.dictionaryapi.com/api/v3/references/${reference}/json/${encodeURIComponent(word)}?key=${apiKey}`;
  const response = await fetch(merriamUrl);

  if (!response.ok) {
    return NextResponse.json(
      { error: "Merriam-Webster lookup failed" },
      { status: response.status },
    );
  }

  const entries = await response.json();
  const audio = findAudio(entries) ?? (await findExistingFallbackAudio(word));

  if (!audio) {
    return NextResponse.json(
      { error: "No pronunciation audio found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      word,
      audio,
      audioUrl: buildMerriamAudioUrl(audio),
    },
  });
}
