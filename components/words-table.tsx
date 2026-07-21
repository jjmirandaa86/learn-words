"use client";

import {
  Badge,
  Box,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from "@mantine/core";

import {
  learningStatuses,
  type LearningStatus,
  type Word,
} from "@/types/word";

type WordsTableProps = {
  words: Word[];
  savingId: string | null;
  onStatusChange: (id: string, nextStatus: LearningStatus | null) => void;
};

const statusOptions = learningStatuses.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

export function WordsTable({
  words,
  savingId,
  onStatusChange,
}: WordsTableProps) {
  if (words.length === 0) {
    return (
      <Paper withBorder radius="lg" p="xl">
        <Text c="dimmed">No words found.</Text>
      </Paper>
    );
  }

  return (
    <>
      <Box visibleFrom="md">
        <Paper withBorder radius="lg" shadow="xs" style={{ overflow: "hidden" }}>
          <Table
            striped
            highlightOnHover
            withTableBorder={false}
            verticalSpacing="md"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Word</Table.Th>
                <Table.Th>Meaning</Table.Th>
                <Table.Th>Examples</Table.Th>
                <Table.Th>Context</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {words.map((word) => (
                <Table.Tr key={word.id}>
                  <Table.Td>
                    <WordHeader word={word} />
                  </Table.Td>
                  <Table.Td>
                    <MeaningBlock word={word} />
                  </Table.Td>
                  <Table.Td>
                    <ExamplesBlock word={word} />
                  </Table.Td>
                  <Table.Td>
                    <ContextBlock word={word} />
                  </Table.Td>
                  <Table.Td>
                    <StatusSelect
                      word={word}
                      savingId={savingId}
                      onChange={onStatusChange}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Box>

      <Stack gap="md" hiddenFrom="md">
        {words.map((word) => (
          <Paper key={word.id} withBorder radius="lg" p="md" shadow="xs">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" gap="sm">
                <WordHeader word={word} />
                <StatusSelect
                  word={word}
                  savingId={savingId}
                  onChange={onStatusChange}
                />
              </Group>

              <Divider />

              <Stack gap="sm">
                <MeaningBlock word={word} />
                <ExamplesBlock word={word} />
                <ContextBlock word={word} />
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </>
  );
}

type WordBlockProps = {
  word: Word;
};

function WordHeader({ word }: WordBlockProps) {
  return (
    <Stack gap={6}>
      <Group gap="xs">
        <Text fw={700}>{word.wordOrExpression}</Text>
        {word.isPhrase ? (
          <Badge size="xs" variant="light" color="grape">
            Phrase
          </Badge>
        ) : null}
      </Group>
      <Group gap="xs">
        <Badge size="sm" variant="light">
          {word.cefrLevel}
        </Badge>
        {word.wordType ? (
          <Badge size="sm" variant="outline" color="gray">
            {word.wordType}
          </Badge>
        ) : null}
        {word.priority ? (
          <Badge size="sm" variant="dot" color="orange">
            {word.priority}
          </Badge>
        ) : null}
      </Group>
      {word.pronunciationIpa ? (
        <Text size="sm" c="dimmed">
          {word.pronunciationIpa}
        </Text>
      ) : null}
    </Stack>
  );
}

function MeaningBlock({ word }: WordBlockProps) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Meaning
      </Text>
      <Text size="sm" fw={600}>
        {word.spanishTranslation}
      </Text>
      <Text size="sm" c="dimmed">
        {word.meaningEn}
      </Text>
      {word.collocationOrPattern ? (
        <Text size="xs" c="blue">
          Pattern: {word.collocationOrPattern}
        </Text>
      ) : null}
    </Stack>
  );
}

function ExamplesBlock({ word }: WordBlockProps) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Examples
      </Text>
      <Text size="sm">{word.exampleEn}</Text>
      {word.exampleEs ? (
        <Text size="sm" c="dimmed">
          {word.exampleEs}
        </Text>
      ) : null}
    </Stack>
  );
}

function ContextBlock({ word }: WordBlockProps) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        Context
      </Text>
      {word.theme ? <Text size="sm">{word.theme}</Text> : null}
      {word.subtheme ? (
        <Text size="xs" c="dimmed">
          {word.subtheme}
        </Text>
      ) : null}
      {word.ieltsRelevance && word.ieltsRelevance !== "none" ? (
        <Tooltip label="IELTS relevance">
          <Badge size="sm" variant="light" color="teal" w="fit-content">
            IELTS {word.ieltsRelevance}
            {word.ieltsBandTarget ? ` - Band ${word.ieltsBandTarget}` : ""}
          </Badge>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

type StatusSelectProps = {
  word: Word;
  savingId: string | null;
  onChange: (id: string, nextStatus: LearningStatus | null) => void;
};

function StatusSelect({ word, savingId, onChange }: StatusSelectProps) {
  return (
    <Select
      aria-label={`Learning status for ${word.wordOrExpression}`}
      data={statusOptions}
      value={word.learningStatus}
      disabled={savingId === word.id}
      onChange={(value) => onChange(word.id, value as LearningStatus | null)}
      size="sm"
      w={{ base: 150, md: 170 }}
    />
  );
}
