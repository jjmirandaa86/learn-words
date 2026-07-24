import { db } from "@/lib/db";
import {
  learningStatuses,
  reviewResults,
  type LearningStatus,
  type ReviewResult,
  type WordFilterOptions,
  type WordFilters,
  type ProgressChartData,
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
  isPhrase: "is_phrase",
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

function omitFilter(
  filters: WordFilters,
  key: keyof WordFilters,
): WordFilters {
  const nextFilters = { ...filters };
  delete nextFilters[key];
  return nextFilters;
}

async function getDistinctValues(column: string, filters: WordFilters = {}) {
  assertSafeIdentifier(wordsTable);

  if (!/^[a-zA-Z0-9_]+$/.test(column)) {
    throw new Error("Invalid MySQL column name");
  }

  const where = buildWhereClause(filters);
  const valueClause = `${column} IS NOT NULL AND CAST(${column} AS CHAR) != ''`;
  const clause = where.clause
    ? `${where.clause} AND ${valueClause}`
    : `WHERE ${valueClause}`;

  const [rows] = await db.query(
    `SELECT DISTINCT CAST(${column} AS CHAR) AS value
    FROM \`${wordsTable}\`
    ${clause}
    ORDER BY value`,
    where.values,
  );

  return (rows as DistinctValueRow[]).map((row) => row.value ?? "");
}

export async function getWordFilterOptions(
  filters: WordFilters = {},
): Promise<WordFilterOptions> {
  const [
    cefrLevels,
    priorities,
    wordTypes,
    ieltsRelevances,
    themes,
    studyGroups,
    isPhrases,
  ] = await Promise.all([
    getDistinctValues("cefr_level", omitFilter(filters, "cefrLevel")),
    getDistinctValues("priority", omitFilter(filters, "priority")),
    getDistinctValues("word_type", omitFilter(filters, "wordType")),
    getDistinctValues("ielts_relevance", omitFilter(filters, "ieltsRelevance")),
    getDistinctValues("theme", omitFilter(filters, "theme")),
    getDistinctValues("study_group", omitFilter(filters, "studyGroup")),
    getDistinctValues("is_phrase", omitFilter(filters, "isPhrase")),
  ]);

  return {
    cefrLevels,
    priorities,
    wordTypes,
    ieltsRelevances,
    themes,
    studyGroups,
    isPhrases,
  };
}

export function parseWordFilters(
  searchParams: URLSearchParams,
): { filters: WordFilters; error?: string } {
  const status = searchParams.get("status");
  const learningStatus =
    status && isLearningStatus(status) ? status : undefined;

  if (status && !learningStatus) {
    return {
      filters: {},
      error: "Invalid learning status",
    };
  }

  const isPhraseParam = searchParams.get("isPhrase");
  const isPhrase =
    isPhraseParam === "0" || isPhraseParam === "1" ? isPhraseParam : undefined;

  return {
    filters: {
      learningStatus,
      cefrLevel: searchParams.get("cefrLevel") || undefined,
      priority: searchParams.get("priority") || undefined,
      wordType: searchParams.get("wordType") || undefined,
      ieltsRelevance: searchParams.get("ieltsRelevance") || undefined,
      theme: searchParams.get("theme") || undefined,
      studyGroup: searchParams.get("studyGroup") || undefined,
      isPhrase,
    },
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

type NamedCountRow = {
  name: string | null;
  value: string | number;
};

type CefrProgressRow = {
  name: string | null;
  known: string | number;
  learning: string | number;
  other: string | number;
};

type ThemeProgressRow = {
  name: string | null;
  known: string | number;
  learning: string | number;
  total: string | number;
};

type HardWordRow = {
  name: string;
  incorrect: string | number;
  correct: string | number;
};

type ReviewQualityRow = {
  incorrect: string | number;
  correct: string | number;
  known: string | number;
};

type ReviewScheduleRow = {
  overdue: string | number;
  dueToday: string | number;
  upcoming: string | number;
  unscheduled: string | number;
};

function toNamedCounts(
  rows: NamedCountRow[],
  fallbackNames: string[] = [],
): ProgressChartData["byStatus"] {
  const counts = new Map(
    rows
      .filter((row) => row.name)
      .map((row) => [row.name as string, Number(row.value)]),
  );

  if (fallbackNames.length === 0) {
    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }

  return fallbackNames.map((name) => ({
    name,
    value: counts.get(name) ?? 0,
  }));
}

export async function getProgressChartData(): Promise<ProgressChartData> {
  assertSafeIdentifier(wordsTable);

  const [
    statusRows,
    reviewStepRows,
    activityRows,
    reviewQualityRows,
    scheduleRows,
    cefrRows,
    themeRows,
    studyDayRows,
    hardestRows,
    phraseRows,
  ] = await Promise.all([
    db.query(
      `SELECT learning_status AS name, COUNT(*) AS value
      FROM \`${wordsTable}\`
      GROUP BY learning_status`,
    ),
    db.query(
      `SELECT CAST(LEAST(correct_uses, 7) AS UNSIGNED) AS step, COUNT(*) AS value
      FROM \`${wordsTable}\`
      GROUP BY CAST(LEAST(correct_uses, 7) AS UNSIGNED)
      ORDER BY step`,
    ),
    db.query(
      `SELECT DATE_FORMAT(last_seen, '%Y-%m-%d') AS name, COUNT(*) AS value
      FROM \`${wordsTable}\`
      WHERE last_seen IS NOT NULL
        AND last_seen >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE_FORMAT(last_seen, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(last_seen, '%Y-%m-%d')`,
    ),
    db.query(
      `SELECT
        COALESCE(SUM(incorrect_uses), 0) AS incorrect,
        COALESCE(SUM(correct_uses), 0) AS correct,
        SUM(CASE WHEN learning_status IN ('known', 'mastered') THEN 1 ELSE 0 END) AS known
      FROM \`${wordsTable}\``,
    ),
    db.query(
      `SELECT
        SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at < CURDATE() THEN 1 ELSE 0 END) AS overdue,
        SUM(CASE WHEN next_review_at IS NOT NULL AND DATE(next_review_at) = CURDATE() THEN 1 ELSE 0 END) AS dueToday,
        SUM(CASE WHEN next_review_at IS NOT NULL AND next_review_at > CURDATE() THEN 1 ELSE 0 END) AS upcoming,
        SUM(CASE WHEN next_review_at IS NULL THEN 1 ELSE 0 END) AS unscheduled
      FROM \`${wordsTable}\``,
    ),
    db.query(
      `SELECT
        cefr_level AS name,
        SUM(CASE WHEN learning_status IN ('known', 'mastered') THEN 1 ELSE 0 END) AS known,
        SUM(CASE WHEN learning_status IN ('learning', 'review') THEN 1 ELSE 0 END) AS learning,
        SUM(CASE WHEN learning_status NOT IN ('known', 'mastered', 'learning', 'review') THEN 1 ELSE 0 END) AS other
      FROM \`${wordsTable}\`
      WHERE cefr_level IS NOT NULL AND cefr_level != ''
      GROUP BY cefr_level
      ORDER BY cefr_level`,
    ),
    db.query(
      `SELECT
        theme AS name,
        SUM(CASE WHEN learning_status IN ('known', 'mastered') THEN 1 ELSE 0 END) AS known,
        SUM(CASE WHEN learning_status IN ('learning', 'review') THEN 1 ELSE 0 END) AS learning,
        COUNT(*) AS total
      FROM \`${wordsTable}\`
      WHERE theme IS NOT NULL AND theme != ''
      GROUP BY theme
      ORDER BY COUNT(*) DESC
      LIMIT 10`,
    ),
    db.query(
      `SELECT DATE_FORMAT(last_seen, '%Y-%m-%d') AS name
      FROM \`${wordsTable}\`
      WHERE last_seen IS NOT NULL
      GROUP BY DATE_FORMAT(last_seen, '%Y-%m-%d')
      ORDER BY DATE_FORMAT(last_seen, '%Y-%m-%d') DESC
      LIMIT 60`,
    ),
    db.query(
      `SELECT
        word_or_expression AS name,
        incorrect_uses AS incorrect,
        correct_uses AS correct
      FROM \`${wordsTable}\`
      WHERE incorrect_uses > 0
      ORDER BY incorrect_uses DESC, correct_uses ASC
      LIMIT 10`,
    ),
    db.query(
      `SELECT learning_status AS name, COUNT(*) AS value
      FROM \`${wordsTable}\`
      WHERE is_phrase = 1
      GROUP BY learning_status`,
    ),
  ]);

  const [reviewQuality] = reviewQualityRows[0] as ReviewQualityRow[];
  const [schedule] = scheduleRows[0] as ReviewScheduleRow[];

  return {
    byStatus: toNamedCounts(
      statusRows[0] as NamedCountRow[],
      [...learningStatuses],
    ),
    reviewSteps: toNamedCounts(
      (reviewStepRows[0] as Array<{ step: string | number; value: string | number }>).map(
        (row) => ({
          name: `Review ${row.step}`,
          value: row.value,
        }),
      ),
      Array.from({ length: 8 }, (_, index) => `Review ${index}`),
    ),
    activityByDay: toNamedCounts(activityRows[0] as NamedCountRow[]),
    reviewQuality: [
      { name: "Again", value: Number(reviewQuality?.incorrect ?? 0) },
      { name: "Good", value: Number(reviewQuality?.correct ?? 0) },
      { name: "Known", value: Number(reviewQuality?.known ?? 0) },
    ],
    reviewSchedule: [
      { name: "Overdue", value: Number(schedule?.overdue ?? 0) },
      { name: "Due today", value: Number(schedule?.dueToday ?? 0) },
      { name: "Upcoming", value: Number(schedule?.upcoming ?? 0) },
      { name: "Unscheduled", value: Number(schedule?.unscheduled ?? 0) },
    ],
    byCefr: (cefrRows[0] as CefrProgressRow[]).map((row) => ({
      name: row.name ?? "Unknown",
      known: Number(row.known),
      learning: Number(row.learning),
      other: Number(row.other),
    })),
    byTheme: (themeRows[0] as ThemeProgressRow[]).map((row) => ({
      name: row.name ?? "Unknown",
      known: Number(row.known),
      learning: Number(row.learning),
      total: Number(row.total),
    })),
    studyDays: (studyDayRows[0] as NamedCountRow[])
      .map((row) => row.name)
      .filter((value): value is string => Boolean(value)),
    hardestWords: (hardestRows[0] as HardWordRow[]).map((row) => ({
      name: row.name,
      incorrect: Number(row.incorrect),
      correct: Number(row.correct),
    })),
    phrasesByStatus: toNamedCounts(
      phraseRows[0] as NamedCountRow[],
      [...learningStatuses],
    ),
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
