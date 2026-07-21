"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { FaArrowsRotate, FaComments, FaVolumeHigh } from "react-icons/fa6";

import { playPronunciationAudio } from "@/lib/pronunciation-audio";
import type { Word, WordFilters } from "@/types/word";

type ConversationPracticeProps = {
  filters: WordFilters;
};

type WordsResponse = {
  data: Word[];
};

const quantityOptions = Array.from({ length: 20 }, (_, index) => {
  const value = String((index + 1) * 5);

  return {
    value,
    label: value,
  };
});

function buildConversationWordsUrl(limit: number, filters: WordFilters) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: "0",
    random: "true",
  });

  if (filters.learningStatus) {
    params.set("status", filters.learningStatus);
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key !== "learningStatus" && value) {
      params.set(key, value);
    }
  }

  return `/api/words?${params.toString()}`;
}

function getActiveFilterLabels(filters: WordFilters) {
  return Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      key,
      label: key === "learningStatus" ? "Status" : key,
      value,
    }));
}

export function ConversationPractice({ filters }: ConversationPracticeProps) {
  const [quantity, setQuantity] = useState("5");
  const [words, setWords] = useState<Word[]>([]);
  const [spokenWordIds, setSpokenWordIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeFilterLabels = getActiveFilterLabels(filters);

  const loadRandomWords = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch(
      buildConversationWordsUrl(Number(quantity), filters),
    );

    if (!response.ok) {
      setWords([]);
      setSpokenWordIds(new Set());
      setError("Could not load conversation words");
      setLoading(false);
      return;
    }

    const result = (await response.json()) as WordsResponse;
    setWords(result.data);
    setSpokenWordIds(new Set());
    setLoading(false);
  }, [filters, quantity]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRandomWords();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadRandomWords]);

  async function handlePlayAudio(word: Word) {
    setAudioLoadingId(word.id);

    try {
      await playPronunciationAudio(word);
    } catch {
      setError(`No audio found for "${word.wordOrExpression}"`);
    } finally {
      setAudioLoadingId(null);
    }
  }

  function handleSpokenChange(wordId: string, checked: boolean) {
    setSpokenWordIds((currentWordIds) => {
      const nextWordIds = new Set(currentWordIds);

      if (checked) {
        nextWordIds.add(wordId);
      } else {
        nextWordIds.delete(wordId);
      }

      return nextWordIds;
    });
  }

  return (
    <Paper withBorder radius="lg" p="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="end" gap="sm">
          <Stack gap={2}>
            <Group gap="xs">
              <FaComments />
              <Title order={3}>Conversation</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Use these random words naturally in your conversation.
            </Text>
          </Stack>

          <Group gap="xs" align="end">
            <Select
              label="Words"
              data={quantityOptions}
              value={quantity}
              onChange={(value) => setQuantity(value ?? "5")}
              allowDeselect={false}
              w={100}
            />
            <Button
              leftSection={<FaArrowsRotate />}
              loading={loading}
              onClick={loadRandomWords}
            >
              New words
            </Button>
          </Group>
        </Group>

        <Group gap="xs">
          <Badge variant="light" color="blue">
            {spokenWordIds.size}/{words.length} said
          </Badge>
          <Badge variant="outline" color="gray">
            Random from database filters
          </Badge>
          {activeFilterLabels.length > 0 ? (
            activeFilterLabels.map((filter) => (
              <Badge key={filter.key} variant="light" color="teal">
                {filter.label}: {filter.value}
              </Badge>
            ))
          ) : (
            <Badge variant="light" color="gray">
              No top filters
            </Badge>
          )}
        </Group>

        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}

        <Stack gap="xs">
          {words.map((word) => (
            <Paper key={word.id} withBorder radius="md" p="sm">
              <Group justify="space-between" align="center" gap="sm">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Group gap="xs">
                    <Text fw={700}>{word.wordOrExpression}</Text>
                    <Badge variant="light">{word.cefrLevel}</Badge>
                    {word.wordType ? (
                      <Badge variant="outline">{word.wordType}</Badge>
                    ) : null}
                  </Group>
                  {word.pronunciationIpa ? (
                    <Text size="sm" c="dimmed">
                      {word.pronunciationIpa}
                    </Text>
                  ) : null}
                </Stack>

                <Group gap="sm" wrap="nowrap">
                  <ActionIcon
                    aria-label={`Play audio for ${word.wordOrExpression}`}
                    size="lg"
                    radius="xl"
                    variant="light"
                    loading={audioLoadingId === word.id}
                    onClick={() => handlePlayAudio(word)}
                  >
                    <FaVolumeHigh />
                  </ActionIcon>
                  <Checkbox
                    aria-label={`Mark ${word.wordOrExpression} as said`}
                    checked={spokenWordIds.has(word.id)}
                    onChange={(event) =>
                      handleSpokenChange(word.id, event.currentTarget.checked)
                    }
                  />
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
