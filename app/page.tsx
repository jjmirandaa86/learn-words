import { HomeContent } from "@/components/home-content";
import {
  getDefaultWordsLimit,
  getWords,
  getWordFilterOptions,
  getWordStats,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const wordsLimit = getDefaultWordsLimit();
  const [words, wordStats, filterOptions] = await Promise.all([
    getWords(wordsLimit),
    getWordStats(),
    getWordFilterOptions(),
  ]);

  return (
    <HomeContent
      words={words}
      wordsLimit={wordsLimit}
      wordStats={wordStats}
      filterOptions={filterOptions}
    />
  );
}
