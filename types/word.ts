export const learningStatuses = [
  "new",
  "learning",
  "review",
  "known",
  "mastered"
] as const;

export type LearningStatus = (typeof learningStatuses)[number];

export const reviewResults = ["again", "good", "known"] as const;

export type ReviewResult = (typeof reviewResults)[number];

export type Word = {
  id: string;
  cefrLevel: string;
  learningOrder: number | null;
  priority: string | null;
  wordOrExpression: string;
  wordType: string | null;
  isPhrase: boolean;
  spanishTranslation: string | null;
  meaningEn: string | null;
  collocationOrPattern: string | null;
  exampleEn: string | null;
  exampleEs: string | null;
  pronunciationIpa: string | null;
  learningStatus: LearningStatus;
  ieltsRelevance: string | null;
  ieltsBandTarget: string | null;
  theme: string | null;
  subtheme: string | null;
  studyGroup: string | null;
  correctUses: number;
  incorrectUses: number;
  lastSeen: string | null;
  nextReviewAt: string | null;
  updatedAt: string | null;
};

export type WordStats = {
  total: number;
  byStatus: Record<LearningStatus, number>;
};

export type WordFilters = {
  learningStatus?: LearningStatus;
  cefrLevel?: string;
  priority?: string;
  wordType?: string;
  ieltsRelevance?: string;
  theme?: string;
  studyGroup?: string;
  isPhrase?: string;
};

export type WordFilterOptions = {
  cefrLevels: string[];
  priorities: string[];
  wordTypes: string[];
  ieltsRelevances: string[];
  themes: string[];
  studyGroups: string[];
};

export type NamedCount = {
  name: string;
  value: number;
};

export type ProgressChartData = {
  byStatus: NamedCount[];
  reviewSteps: NamedCount[];
  activityByDay: NamedCount[];
  reviewQuality: NamedCount[];
  reviewSchedule: NamedCount[];
  byCefr: Array<{
    name: string;
    known: number;
    learning: number;
    other: number;
  }>;
  byTheme: Array<{
    name: string;
    known: number;
    learning: number;
    total: number;
  }>;
  studyDays: string[];
  hardestWords: Array<{
    name: string;
    incorrect: number;
    correct: number;
  }>;
  phrasesByStatus: NamedCount[];
};
