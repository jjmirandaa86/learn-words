"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaCircleCheck,
  FaEye,
  FaEyeSlash,
  FaRotateLeft,
  FaVolumeHigh,
} from "react-icons/fa6";

import { playPronunciationAudio } from "@/lib/pronunciation-audio";
import {
  type ReviewResult,
  type Word,
} from "@/types/word";

type AnkiStudyProps = {
  words: Word[];
  savingId: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  onReviewResult: (
    id: string,
    result: ReviewResult,
  ) => Promise<Partial<Word> | null>;
  onLoadMore: () => Promise<Word[]>;
};

export function AnkiStudy({
  words,
  savingId,
  hasMore,
  isLoadingMore,
  onReviewResult,
  onLoadMore,
}: AnkiStudyProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const lastAutoPlayedWordIdRef = useRef<string | null>(null);

  const safeIndex = Math.min(currentIndex, Math.max(words.length - 1, 0));
  const word = words[safeIndex];

  const playAudioForWord = useCallback(
    async (targetWord: Word, options = { showErrors: true }) => {
      setAudioError(null);
      setAudioLoadingId(targetWord.id);

      try {
        await playPronunciationAudio(targetWord);
      } catch {
        if (options.showErrors) {
          setAudioError("Audio playback failed");
        }
      } finally {
        setAudioLoadingId(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!autoPlayAudio || !word) {
      return;
    }

    if (lastAutoPlayedWordIdRef.current === word.id) {
      return;
    }

    lastAutoPlayedWordIdRef.current = word.id;
    void playAudioForWord(word, { showErrors: false });
  }, [autoPlayAudio, playAudioForWord, word]);

  if (words.length === 0 || isFinished) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Stack gap="xs">
          <Title order={3}>No more words</Title>
          <Text c="dimmed">
            There are no more cards for the current filters.
          </Text>
        </Stack>
      </Paper>
    );
  }

  function goToCard(nextIndex: number) {
    setCurrentIndex(nextIndex);
    setShowBack(false);
    setIsFinished(false);
  }

  async function handleNext() {
    if (safeIndex < words.length - 1) {
      goToCard(safeIndex + 1);
      return;
    }

    if (!hasMore) {
      setIsFinished(true);
      return;
    }

    const newWords = await onLoadMore();

    if (newWords.length > 0) {
      goToCard(safeIndex + 1);
      return;
    }

    setIsFinished(true);
  }

  async function handleReviewAction(result: ReviewResult) {
    const updatedWord = await onReviewResult(word.id, result);

    if (!updatedWord) {
      return;
    }

    await handleNext();
  }

  async function handlePlayAudio() {
    await playAudioForWord(word);
  }

  return (
    <Paper withBorder radius="lg" p="md" shadow="xs">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Card {safeIndex + 1} of {words.length}
          </Text>
          <Group gap="xs">
            <Switch
              size="sm"
              label="Auto audio"
              checked={autoPlayAudio}
              onChange={(event) => {
                lastAutoPlayedWordIdRef.current = word.id;
                setAutoPlayAudio(event.currentTarget.checked);
              }}
            />
            <Badge variant="light" color="blue">
              {word.learningStatus}
            </Badge>
          </Group>
        </Group>

        <Paper withBorder radius="lg" p="xl" bg="gray.0" mih={260}>
          {showBack ? (
            <CardBack word={word} />
          ) : (
            <CardFront
              word={word}
              audioError={audioError}
              isAudioLoading={audioLoadingId === word.id}
              onPlayAudio={handlePlayAudio}
            />
          )}
        </Paper>

        <StatusActions
          word={word}
          savingId={savingId}
          onReviewResult={handleReviewAction}
        />

        <Group grow>
          <Button
            variant="default"
            leftSection={<FaChevronLeft />}
            disabled={safeIndex === 0}
            onClick={() => goToCard(safeIndex - 1)}
          >
            Previous
          </Button>
          <Button
            leftSection={showBack ? <FaEyeSlash /> : <FaEye />}
            onClick={() => setShowBack((current) => !current)}
          >
            {showBack ? "Show word" : "Show answer"}
          </Button>
          <Button
            variant="default"
            rightSection={<FaChevronRight />}
            loading={safeIndex === words.length - 1 && isLoadingMore}
            disabled={safeIndex === words.length - 1 && !hasMore}
            onClick={handleNext}
          >
            {safeIndex === words.length - 1 && hasMore ? "Load next" : "Next"}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

type CardSideProps = {
  word: Word;
};

type CardFrontProps = CardSideProps & {
  audioError: string | null;
  isAudioLoading: boolean;
  onPlayAudio: () => void;
};

type StatusActionsProps = {
  word: Word;
  savingId: string | null;
  onReviewResult: (result: ReviewResult) => void;
};

function StatusActions({
  word,
  savingId,
  onReviewResult,
}: StatusActionsProps) {
  const isSaving = savingId === word.id;

  return (
    <Stack gap="xs">
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Review progress: {Math.min(word.correctUses, 7)} of 7
      </Text>
      <Group gap="xs" grow>
        <Button
          color="red"
          variant="light"
          leftSection={<FaRotateLeft />}
          loading={isSaving}
          disabled={isSaving}
          onClick={() => onReviewResult("again")}
        >
          Again
        </Button>
        <Button
          leftSection={<FaCheck />}
          loading={isSaving}
          disabled={isSaving}
          onClick={() => onReviewResult("good")}
        >
          Good
        </Button>
        <Button
          color="green"
          variant="light"
          leftSection={<FaCircleCheck />}
          loading={isSaving}
          disabled={isSaving}
          onClick={() => onReviewResult("known")}
        >
          Known
        </Button>
      </Group>
    </Stack>
  );
}

function CardFront({
  word,
  audioError,
  isAudioLoading,
  onPlayAudio,
}: CardFrontProps) {
  return (
    <Stack h="100%" justify="center" align="center" gap="sm">
      <Stack gap={4} align="center">
        <Title order={1} ta="center" fz={{ base: 42, sm: 56 }} lh={1.05}>
          {word.wordOrExpression}
        </Title>
        {word.pronunciationIpa ? (
          <Text size="lg" c="dimmed" ta="center">
            {word.pronunciationIpa}
          </Text>
        ) : null}
      </Stack>
      <Group gap="xs" justify="center">
        <Badge variant="light">{word.cefrLevel}</Badge>
        {word.wordType ? <Badge variant="outline">{word.wordType}</Badge> : null}
        {word.isPhrase ? (
          <Badge variant="light" color="grape">
            Phrase
          </Badge>
        ) : null}
      </Group>
      <Button
        aria-label="Play audio"
        size="lg"
        variant="light"
        radius="xl"
        loading={isAudioLoading}
        onClick={onPlayAudio}
        px="md"
      >
        <FaVolumeHigh size={24} />
      </Button>
      {audioError ? (
        <Text size="xs" c="red">
          {audioError}
        </Text>
      ) : null}
    </Stack>
  );
}

function CardBack({ word }: CardSideProps) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Title order={3}>{word.wordOrExpression}</Title>
        <Badge variant="light">{word.cefrLevel}</Badge>
      </Group>

      <Group gap="xs">
        <Badge variant="light" color="blue">
          Review {Math.min(word.correctUses, 7)} of 7
        </Badge>
        <Badge variant="light" color="red">
          Again {word.incorrectUses}
        </Badge>
      </Group>

      {word.nextReviewAt ? (
        <Text size="sm" c="dimmed">
          Next review: {new Date(word.nextReviewAt).toLocaleDateString()}
        </Text>
      ) : null}

      {word.pronunciationIpa ? (
        <Text size="sm" c="dimmed">
          {word.pronunciationIpa}
        </Text>
      ) : null}

      <Divider />

      <Stack gap={6}>
        <Text fw={700}>Spanish</Text>
        <Text>{word.spanishTranslation}</Text>
      </Stack>

      <Stack gap={6}>
        <Text fw={700}>Meaning</Text>
        <Text c="dimmed">{word.meaningEn}</Text>
      </Stack>

      {word.collocationOrPattern ? (
        <Stack gap={6}>
          <Text fw={700}>Pattern</Text>
          <Text c="blue">{word.collocationOrPattern}</Text>
        </Stack>
      ) : null}

      <Stack gap={6}>
        <Text fw={700}>Example</Text>
        <Text>{word.exampleEn}</Text>
        {word.exampleEs ? <Text c="dimmed">{word.exampleEs}</Text> : null}
      </Stack>

      {word.theme ? (
        <Group gap="xs">
          <Badge variant="light" color="gray">
            {word.theme}
          </Badge>
          {word.subtheme ? (
            <Badge variant="outline" color="gray">
              {word.subtheme}
            </Badge>
          ) : null}
        </Group>
      ) : null}
    </Stack>
  );
}
