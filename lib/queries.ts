import { db } from "@/lib/db";
import {
  learningStatuses,
  reviewResults,
  type LearningStatus,
  type ReviewResult,
  type WordFilterOptions,
  type WordFilters,
  type Word,
  type WordStats,
} from "@/types/word";

const wordsTable = process.env.MYSQL_WORDS_TABLE ?? "english_word_bank";
const defaultWordsLimit = Number(process.env.MYSQL_WORDS_LIMIT ?? 50);

type WordRow = Omit<Word, "isPhrase"> & {
  isPhrase: 0 | 1;
  lastSeen: Date | string | null;
  nextReviewAt: Date | string | null;
  updatedAt: Date | string | null;
};

type StatusCountRow = {
  learningStatus: LearningStatus;
  count: string | number;
};

type CountRow = {
  count: string | number;
};

type DistinctValueRow = {
  value: string | null;
};

type ReviewStateRow = {
  learningStatus: LearningStatus;
  correctUses: number;
  incorrectUses: number;
};

export type LearningStatusUpdate = Pick<
  Word,
  | "id"
  | "learningStatus"
  | "correctUses"
  | "incorrectUses"
  | "lastSeen"
  | "nextReviewAt"
  | "updatedAt"
>;

const reviewScheduleDays = [1, 3, 5, 7, 30, 60, 90] as const;

const filterColumnMap = {
  learningStatus: "learning_status",
  cefrLevel: "cefr_level",
  priority: "priority",
  wordType: "word_type",
  ieltsRelevance: "ielts_relevance",
  theme: "theme",
  studyGroup: "study_group",
} satisfies Record<keyof WordFilters, string>;

function assertSafeIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error("Invalid MySQL table name");
  }
}

function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.floor(limit), 1), 500);
}

export function getDefaultWordsLimit() {
  return normalizeLimit(defaultWordsLimit);
}

function normalizeOffset(offset: number) {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(Math.floor(offset), 0);
}

function buildWhereClause(filters: WordFilters) {
  const clauses: string[] = [];
  const values: string[] = [];

  for (const [filterKey, column] of Object.entries(filterColumnMap)) {
    const value = filters[filterKey as keyof WordFilters];

    if (value) {
      clauses.push(`${column} = ?`);
      values.push(value);
    }
  }

  return {
    clause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function toIsoString(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function getReviewIntervalDays(correctUses: number) {
  const scheduleIndex = Math.min(
    Math.max(correctUses, 1),
    reviewScheduleDays.length,
  ) - 1;

  return reviewScheduleDays[scheduleIndex];
}

export async function getWords(
  limit = getDefaultWordsLimit(),
  offset = 0,
  filters: WordFilters = {},
  options: { random?: boolean } = {},
): Promise<Word[]> {
  assertSafeIdentifier(wordsTable);

  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const where = buildWhereClause(filters);
  const queryParams: Array<string | number> = [
    ...where.values,
    safeLimit,
    safeOffset,
  ];

  const [rows] = await db.query(
    `SELECT
      CAST(id AS CHAR) AS id,
      cefr_level AS cefrLevel,
      learning_order AS learningOrder,
      priority,
      word_or_expression AS wordOrExpression,
      word_type AS wordType,
      is_phrase AS isPhrase,
      spanish_translation AS spanishTranslation,
      meaning_en AS meaningEn,
      collocation_or_pattern AS collocationOrPattern,
      example_en AS exampleEn,
      example_es AS exampleEs,
      pronunciation_ipa AS pronunciationIpa,
      learning_status AS learningStatus,
      ielts_relevance AS ieltsRelevance,
      CAST(ielts_band_target AS CHAR) AS ieltsBandTarget,
      theme,
      subtheme,
      study_group AS studyGroup,
      correct_uses AS correctUses,
      incorrect_uses AS incorrectUses,
      last_seen AS lastSeen,
      next_review_at AS nextReviewAt,
      updated_at AS updatedAt
    FROM \`${wordsTable}\`
    ${where.clause}
    ORDER BY ${
      options.random ? "RAND()" : "COALESCE(learning_order, id), id"
    }
    LIMIT ? OFFSET ?`,
    queryParams,
  );

  return (rows as WordRow[]).map((word) => ({
    ...word,
    isPhrase: Boolean(word.isPhrase),
    correctUses: Number(word.correctUses),
    incorrectUses: Number(word.incorrectUses),
    lastSeen: toIsoString(word.lastSeen),
    nextReviewAt: toIsoString(word.nextReviewAt),
    updatedAt: toIsoString(word.updatedAt),
  }));
}

export async function getFilteredWordCount(
  filters: WordFilters = {},
): Promise<number> {
  assertSafeIdentifier(wordsTable);

  const where = buildWhereClause(filters);
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM \`${wordsTable}\` ${where.clause}`,
    where.values,
  );
  const [row] = rows as CountRow[];

  return Number(row?.count ?? 0);
}

async function getDistinctValues(column: string) {
  assertSafeIdentifier(wordsTable);

  const [rows] = await db.query(
    `SELECT DISTINCT ${column} AS value
    FROM \`${wordsTable}\`
    WHERE ${column} IS NOT NULL AND ${column} != ''
    ORDER BY ${column}`,
  );

  return (rows as DistinctValueRow[]).map((row) => row.value ?? "");
}

export async function getWordFilterOptions(): Promise<WordFilterOptions> {
  const [
    cefrLevels,
    priorities,
    wordTypes,
    ieltsRelevances,
    themes,
    studyGroups,
  ] = await Promise.all([
    getDistinctValues("cefr_level"),
    getDistinctValues("priority"),
    getDistinctValues("word_type"),
    getDistinctValues("ielts_relevance"),
    getDistinctValues("theme"),
    getDistinctValues("study_group"),
  ]);

  return {
    cefrLevels,
    priorities,
    wordTypes,
    ieltsRelevances,
    themes,
    studyGroups,
  };
}

export async function getWordStats(): Promise<WordStats> {
  assertSafeIdentifier(wordsTable);

  const [rows] = await db.query(
    `SELECT learning_status AS learningStatus, COUNT(*) AS count
    FROM \`${wordsTable}\`
    GROUP BY learning_status`,
  );

  const byStatus = learningStatuses.reduce(
    (stats, status) => ({
      ...stats,
      [status]: 0,
    }),
    {} as Record<LearningStatus, number>,
  );

  for (const row of rows as StatusCountRow[]) {
    byStatus[row.learningStatus] = Number(row.count);
  }

  return {
    total: Object.values(byStatus).reduce((total, count) => total + count, 0),
    byStatus,
  };
}

export function isLearningStatus(value: unknown): value is LearningStatus {
  return (
    typeof value === "string" &&
    learningStatuses.includes(value as LearningStatus)
  );
}

export function isReviewResult(value: unknown): value is ReviewResult {
  return (
    typeof value === "string" && reviewResults.includes(value as ReviewResult)
  );
}

export async function updateLearningStatus(
  id: string,
  learningStatus: LearningStatus,
): Promise<LearningStatusUpdate> {
  assertSafeIdentifier(wordsTable);

  const isReset = learningStatus === "new";
  const isMastered = learningStatus === "mastered";

  if (isReset) {
    await db.query(
      `UPDATE \`${wordsTable}\`
      SET
        learning_status = ?,
        correct_uses = 0,
        incorrect_uses = 0,
        last_seen = NOW(),
        next_review_at = NULL,
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1`,
      [learningStatus, id],
    );
  } else if (isMastered) {
    await db.query(
      `UPDATE \`${wordsTable}\`
      SET
        learning_status = ?,
        last_seen = NOW(),
        next_review_at = NULL,
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1`,
      [learningStatus, id],
    );
  } else {
    await db.query(
      `UPDATE \`${wordsTable}\`
      SET
        learning_status = ?,
        last_seen = NOW(),
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1`,
      [learningStatus, id],
    );
  }

  return getLearningStatusUpdate(id);
}

export async function reviewWord(
  id: string,
  result: ReviewResult,
): Promise<LearningStatusUpdate> {
  assertSafeIdentifier(wordsTable);

  const [rows] = await db.query(
    `SELECT
      learning_status AS learningStatus,
      correct_uses AS correctUses,
      incorrect_uses AS incorrectUses
    FROM \`${wordsTable}\`
    WHERE id = ?
    LIMIT 1`,
    [id],
  );

  const [currentWord] = rows as ReviewStateRow[];

  if (!currentWord) {
    throw new Error("Word not found");
  }

  if (result === "known") {
    await db.query(
      `UPDATE \`${wordsTable}\`
      SET
        learning_status = 'known',
        last_seen = NOW(),
        next_review_at = NULL,
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1`,
      [id],
    );

    return getLearningStatusUpdate(id);
  }

  if (result === "again") {
    await db.query(
      `UPDATE \`${wordsTable}\`
      SET
        learning_status = 'learning',
        incorrect_uses = incorrect_uses + 1,
        last_seen = NOW(),
        next_review_at = DATE_ADD(NOW(), INTERVAL 1 DAY),
        updated_at = NOW()
      WHERE id = ?
      LIMIT 1`,
      [id],
    );

    return getLearningStatusUpdate(id);
  }

  const nextCorrectUses = Number(currentWord.correctUses) + 1;
  const finalLearningStatus =
    nextCorrectUses >= reviewScheduleDays.length ? "known" : "learning";
  const intervalDays = getReviewIntervalDays(nextCorrectUses);

  await db.query(
    `UPDATE \`${wordsTable}\`
    SET
      learning_status = ?,
      correct_uses = ?,
      last_seen = NOW(),
      next_review_at = DATE_ADD(NOW(), INTERVAL ? DAY),
      updated_at = NOW()
    WHERE id = ?
    LIMIT 1`,
    [finalLearningStatus, nextCorrectUses, intervalDays, id],
  );

  return getLearningStatusUpdate(id);
}

async function getLearningStatusUpdate(
  id: string,
): Promise<LearningStatusUpdate> {
  assertSafeIdentifier(wordsTable);

  const [updatedRows] = await db.query(
    `SELECT
      CAST(id AS CHAR) AS id,
      learning_status AS learningStatus,
      correct_uses AS correctUses,
      incorrect_uses AS incorrectUses,
      last_seen AS lastSeen,
      next_review_at AS nextReviewAt,
      updated_at AS updatedAt
    FROM \`${wordsTable}\`
    WHERE id = ?
    LIMIT 1`,
    [id],
  );
  const [updatedWord] = updatedRows as Array<
    Omit<LearningStatusUpdate, "lastSeen" | "nextReviewAt" | "updatedAt"> & {
      lastSeen: Date | string | null;
      nextReviewAt: Date | string | null;
      updatedAt: Date | string | null;
    }
  >;

  return {
    ...updatedWord,
    correctUses: Number(updatedWord.correctUses),
    incorrectUses: Number(updatedWord.incorrectUses),
    lastSeen: toIsoString(updatedWord.lastSeen),
    nextReviewAt: toIsoString(updatedWord.nextReviewAt),
    updatedAt: toIsoString(updatedWord.updatedAt),
  };
}
