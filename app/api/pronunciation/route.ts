import { NextResponse } from "next/server";

type MerriamEntry = {
  meta?: {
    id?: string;
    stems?: string[];
  };
  hwi?: {
    hw?: string;
    prs?: Array<{
      sound?: {
        audio?: string;
      };
    }>;
  };
};

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

function normalizeWord(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildFallbackAudioCandidates(word: string) {
  const normalizedWord = normalizeWord(word);

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

  // Apply silent-e stripping to every stem, e.g. extremely -> extreme -> extrem.
  for (const stem of Array.from(stems)) {
    if (stem.endsWith("e") && stem.length > 3) {
      stems.add(stem.slice(0, -1));
    }
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

function entryMatchesWord(entry: MerriamEntry, word: string) {
  const normalizedWord = normalizeWord(word);

  if (!normalizedWord) {
    return false;
  }

  const candidates = [
    entry.meta?.id,
    entry.hwi?.hw,
    ...(entry.meta?.stems ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeWord);

  return candidates.some(
    (candidate) =>
      candidate === normalizedWord ||
      candidate.startsWith(normalizedWord) ||
      normalizedWord.startsWith(candidate),
  );
}

function audioMatchesWord(audio: string, word: string) {
  const normalizedWord = normalizeWord(word);
  const normalizedAudio = normalizeWord(audio.replace(/\d+$/, ""));

  if (!normalizedWord || !normalizedAudio) {
    return false;
  }

  return (
    normalizedAudio === normalizedWord ||
    normalizedWord.startsWith(normalizedAudio) ||
    normalizedAudio.startsWith(normalizedWord)
  );
}

function findAudio(entries: unknown, word: string) {
  if (!Array.isArray(entries)) {
    return null;
  }

  const matchingEntries = (entries as MerriamEntry[]).filter((entry) =>
    entryMatchesWord(entry, word),
  );

  for (const entry of matchingEntries) {
    const pronunciations = entry.hwi?.prs ?? [];

    for (const pronunciation of pronunciations) {
      const audio = pronunciation.sound?.audio;

      if (audio && audioMatchesWord(audio, word)) {
        return audio;
      }
    }
  }

  return null;
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
  const audio = findAudio(entries, word) ?? (await findExistingFallbackAudio(word));

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
