"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { FaFilter, FaPlus, FaTrashCan, FaXmark } from "react-icons/fa6";

import { AnkiStudy } from "@/components/anki-study";
import { ConversationPractice } from "@/components/conversation-practice";
import { WordsTable } from "@/components/words-table";
import {
  learningStatuses,
  type LearningStatus,
  type ReviewResult,
  type Word,
  type WordFilterOptions,
  type WordFilters,
  type WordStats,
} from "@/types/word";

type HomeContentProps = {
  words: Word[];
  wordsLimit: number;
  wordStats: WordStats;
  filterOptions: WordFilterOptions;
};

type ViewMode = "list" | "anki" | "conversation";
type StatusFilter = "all" | LearningStatus;

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...learningStatuses.map((status) => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1),
  })),
];

function toSelectOptions(values: string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function hasAdvancedFilters(filters: WordFilters) {
  return Object.values(filters).some(Boolean);
}

type WordsResponse = {
  data: Word[];
  meta?: {
    hasMore?: boolean;
    total?: number;
  };
};

type StatusUpdateResponse = {
  data: Pick<
    Word,
    | "id"
    | "learningStatus"
    | "correctUses"
    | "incorrectUses"
    | "lastSeen"
    | "nextReviewAt"
    | "updatedAt"
  >;
};

export function HomeContent({
  words,
  wordsLimit,
  wordStats,
  filterOptions,
}: HomeContentProps) {
  const [items, setItems] = useState(words);
  const [stats, setStats] = useState(wordStats);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [advancedFilters, setAdvancedFilters] = useState<WordFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeTotal, setActiveTotal] = useState(wordStats.total);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const databaseStatusTotal =
    statusFilter === "all" ? stats.total : stats.byStatus[statusFilter];
  const hasMore = items.length < activeTotal;
  const conversationFilters = useMemo(
    () => ({
      ...advancedFilters,
      learningStatus: statusFilter === "all" ? undefined : statusFilter,
    }),
    [advancedFilters, statusFilter],
  );

  function buildWordsUrl(
    offset: number,
    filter = statusFilter,
    nextAdvancedFilters = advancedFilters,
  ) {
    const params = new URLSearchParams({
      limit: String(wordsLimit),
      offset: String(offset),
    });

    if (filter !== "all") {
      params.set("status", filter);
    }

    for (const [key, value] of Object.entries(nextAdvancedFilters)) {
      if (value) {
        params.set(key, value);
      }
    }

    return `/api/words?${params.toString()}`;
  }

  async function fetchWordsPage(
    filter: StatusFilter,
    offset: number,
    nextAdvancedFilters = advancedFilters,
  ) {
    const response = await fetch(
      buildWordsUrl(offset, filter, nextAdvancedFilters),
    );

    if (!response.ok) {
      return { data: [], total: 0 };
    }

    const result = (await response.json()) as WordsResponse;
    return {
      data: result.data,
      total: result.meta?.total ?? result.data.length,
    };
  }

  async function handleStatusFilterChange(value: string | null) {
    const nextFilter = (value ?? "all") as StatusFilter;

    setStatusFilter(nextFilter);
    setIsLoadingMore(true);

    const result = await fetchWordsPage(nextFilter, 0);
    setItems(result.data);
    setActiveTotal(result.total);
    setIsLoadingMore(false);
  }

  async function handleAdvancedFilterChange(
    filterKey: keyof WordFilters,
    value: string | null,
  ) {
    const nextAdvancedFilters = {
      ...advancedFilters,
      [filterKey]: value || undefined,
    };

    setAdvancedFilters(nextAdvancedFilters);
    setIsLoadingMore(true);

    const result = await fetchWordsPage(statusFilter, 0, nextAdvancedFilters);
    setItems(result.data);
    setActiveTotal(result.total);
    setIsLoadingMore(false);
  }

  async function handleClearAdvancedFilters() {
    setAdvancedFilters({});
    setIsLoadingMore(true);

    const result = await fetchWordsPage(statusFilter, 0, {});
    setItems(result.data);
    setActiveTotal(result.total);
    setIsLoadingMore(false);
  }

  async function handleStatusChange(
    id: string,
    nextStatus: LearningStatus | null,
  ) {
    if (!nextStatus) {
      return;
    }

    const previousItems = items;
    const previousStats = stats;
    const previousActiveTotal = activeTotal;
    const currentWord = items.find((word) => word.id === id);

    if (!currentWord) {
      return;
    }

    setSavingId(id);
    setItems((currentItems) => {
      const nextItems = currentItems.map((word) =>
        word.id === id ? { ...word, learningStatus: nextStatus } : word,
      );

      if (statusFilter !== "all" && currentWord.learningStatus !== nextStatus) {
        return nextItems.filter((word) => word.id !== id);
      }

      return nextItems;
    });
    if (currentWord.learningStatus !== nextStatus) {
      setStats((currentStats) => ({
        total: currentStats.total,
        byStatus: {
          ...currentStats.byStatus,
          [currentWord.learningStatus]:
            currentStats.byStatus[currentWord.learningStatus] - 1,
          [nextStatus]: currentStats.byStatus[nextStatus] + 1,
        },
      }));
    }
    if (statusFilter !== "all" && currentWord.learningStatus !== nextStatus) {
      setActiveTotal((currentTotal) => Math.max(currentTotal - 1, 0));
    }

    const response = await fetch(`/api/words/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ learningStatus: nextStatus }),
    });

    if (!response.ok) {
      setItems(previousItems);
      setStats(previousStats);
      setActiveTotal(previousActiveTotal);
      setSavingId(null);
      return;
    }

    const result = (await response.json()) as StatusUpdateResponse;
    const updatedWord = result.data;

    setItems((currentItems) => {
      const nextItems = currentItems.map((word) =>
        word.id === id ? { ...word, ...updatedWord } : word,
      );

      if (
        statusFilter !== "all" &&
        updatedWord.learningStatus !== statusFilter
      ) {
        return nextItems.filter((word) => word.id !== id);
      }

      return nextItems;
    });

    if (updatedWord.learningStatus !== nextStatus) {
      setStats((currentStats) => ({
        total: currentStats.total,
        byStatus: {
          ...currentStats.byStatus,
          [nextStatus]: currentStats.byStatus[nextStatus] - 1,
          [updatedWord.learningStatus]:
            currentStats.byStatus[updatedWord.learningStatus] + 1,
        },
      }));
    }

    if (
      statusFilter !== "all" &&
      currentWord.learningStatus === statusFilter &&
      updatedWord.learningStatus !== statusFilter
    ) {
      setActiveTotal((currentTotal) => Math.max(currentTotal - 1, 0));
    }

    setSavingId(null);
  }

  async function handleReviewResult(id: string, result: ReviewResult) {
    const previousItems = items;
    const previousStats = stats;
    const previousActiveTotal = activeTotal;
    const currentWord = items.find((word) => word.id === id);

    if (!currentWord) {
      return null;
    }

    setSavingId(id);

    const response = await fetch(`/api/words/${id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ result }),
    });

    if (!response.ok) {
      setItems(previousItems);
      setStats(previousStats);
      setActiveTotal(previousActiveTotal);
      setSavingId(null);
      return null;
    }

    const reviewResponse = (await response.json()) as StatusUpdateResponse;
    const updatedWord = reviewResponse.data;

    setItems((currentItems) => {
      const nextItems = currentItems.map((word) =>
        word.id === id ? { ...word, ...updatedWord } : word,
      );

      if (
        statusFilter !== "all" &&
        updatedWord.learningStatus !== statusFilter
      ) {
        return nextItems.filter((word) => word.id !== id);
      }

      return nextItems;
    });

    if (currentWord.learningStatus !== updatedWord.learningStatus) {
      setStats((currentStats) => ({
        total: currentStats.total,
        byStatus: {
          ...currentStats.byStatus,
          [currentWord.learningStatus]:
            currentStats.byStatus[currentWord.learningStatus] - 1,
          [updatedWord.learningStatus]:
            currentStats.byStatus[updatedWord.learningStatus] + 1,
        },
      }));
    }

    if (
      statusFilter !== "all" &&
      currentWord.learningStatus === statusFilter &&
      updatedWord.learningStatus !== statusFilter
    ) {
      setActiveTotal((currentTotal) => Math.max(currentTotal - 1, 0));
    }

    setSavingId(null);
    return updatedWord;
  }

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) {
      return [];
    }

    setIsLoadingMore(true);

    const result = await fetchWordsPage(statusFilter, items.length);

    if (result.data.length > 0) {
      setItems((currentItems) => [...currentItems, ...result.data]);
    }

    setActiveTotal(result.total);

    setIsLoadingMore(false);
    return result.data;
  }

  return (
    <Container size="lg" px="md" py="xl">
      <Stack gap="md">
        <Paper withBorder radius="lg" p="md" shadow="xs">
          <Stack gap="sm">
            <Badge variant="light" color="blue">
              Learn Words
            </Badge>
            <Title order={1} size="h2">
              English jjma
            </Title>
          </Stack>
        </Paper>

        <Paper withBorder radius="lg" p="sm" shadow="xs">
          <Stack gap="sm">
            <Group justify="space-between" align="center" gap="sm">
              <Select
                aria-label="Learning status"
                data={statusFilterOptions}
                value={statusFilter}
                onChange={handleStatusFilterChange}
                disabled={isLoadingMore}
                size="sm"
                w={{ base: "100%", sm: 220 }}
              />

              <Button
                variant="subtle"
                size="sm"
                leftSection={showAdvancedFilters ? <FaXmark /> : <FaFilter />}
                onClick={() => setShowAdvancedFilters((current) => !current)}
              >
                {showAdvancedFilters ? "Hide filters" : "More filters"}
              </Button>

              <Group gap="xs" style={{ flex: 1 }}>
                <Badge variant="light" color="blue">
                  {statusFilter === "all" ? "All" : statusFilter}
                </Badge>
                <Text size="sm" c="dimmed">
                  <strong>{items.length}</strong>/<strong>{activeTotal}</strong>{" "}
                  shown
                </Text>
                <Text size="sm" c="dimmed">
                  DB <strong>{databaseStatusTotal}</strong>/
                  <strong>{stats.total}</strong>
                </Text>
                {hasMore ? (
                  <Badge variant="outline" color="gray">
                    More
                  </Badge>
                ) : null}
              </Group>

              <SegmentedControl
                size="sm"
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                data={[
                  { value: "list", label: "List" },
                  { value: "anki", label: "Anki" },
                  { value: "conversation", label: "Conversation" },
                ]}
              />
            </Group>

            {showAdvancedFilters ? (
              <Stack gap="md">
                <Group align="end">
                  <Select
                    clearable
                    label="CEFR level"
                    data={toSelectOptions(filterOptions.cefrLevels)}
                    value={advancedFilters.cefrLevel ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("cefrLevel", value)
                    }
                    disabled={isLoadingMore}
                    w={{ base: "100%", sm: 220 }}
                  />
                  <Select
                    clearable
                    label="Priority"
                    data={toSelectOptions(filterOptions.priorities)}
                    value={advancedFilters.priority ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("priority", value)
                    }
                    disabled={isLoadingMore}
                    w={{ base: "100%", sm: 220 }}
                  />
                  <Select
                    clearable
                    label="Word type"
                    data={toSelectOptions(filterOptions.wordTypes)}
                    value={advancedFilters.wordType ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("wordType", value)
                    }
                    disabled={isLoadingMore}
                    searchable
                    w={{ base: "100%", sm: 220 }}
                  />
                  <Select
                    clearable
                    label="IELTS relevance"
                    data={toSelectOptions(filterOptions.ieltsRelevances)}
                    value={advancedFilters.ieltsRelevance ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("ieltsRelevance", value)
                    }
                    disabled={isLoadingMore}
                    w={{ base: "100%", sm: 220 }}
                  />
                  <Select
                    clearable
                    label="Theme"
                    data={toSelectOptions(filterOptions.themes)}
                    value={advancedFilters.theme ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("theme", value)
                    }
                    disabled={isLoadingMore}
                    searchable
                    w={{ base: "100%", sm: 220 }}
                  />
                  <Select
                    clearable
                    label="Study group"
                    data={toSelectOptions(filterOptions.studyGroups)}
                    value={advancedFilters.studyGroup ?? null}
                    onChange={(value) =>
                      handleAdvancedFilterChange("studyGroup", value)
                    }
                    disabled={isLoadingMore}
                    searchable
                    w={{ base: "100%", sm: 220 }}
                  />
                </Group>

                <Button
                  variant="default"
                  leftSection={<FaTrashCan />}
                  disabled={
                    isLoadingMore || !hasAdvancedFilters(advancedFilters)
                  }
                  onClick={handleClearAdvancedFilters}
                  w="fit-content"
                >
                  Clear extra filters
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Paper>

        {viewMode === "anki" ? (
          <AnkiStudy
            words={items}
            savingId={savingId}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onReviewResult={handleReviewResult}
            onLoadMore={handleLoadMore}
          />
        ) : viewMode === "conversation" ? (
          <ConversationPractice filters={conversationFilters} />
        ) : (
          <WordsTable
            words={items}
            savingId={savingId}
            onStatusChange={handleStatusChange}
          />
        )}

        {viewMode === "list" && hasMore ? (
          <Button
            variant="light"
            leftSection={<FaPlus />}
            loading={isLoadingMore}
            onClick={handleLoadMore}
          >
            Load more
          </Button>
        ) : null}
      </Stack>
    </Container>
  );
}
