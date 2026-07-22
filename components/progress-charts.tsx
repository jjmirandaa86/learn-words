"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Group,
  NavLink,
  Paper,
  Popover,
  Splitter,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { FaCircleInfo } from "react-icons/fa6";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type { ProgressChartData } from "@/types/word";

type ChartId =
  | "byStatus"
  | "reviewSteps"
  | "activityByDay"
  | "reviewQuality"
  | "reviewSchedule"
  | "byCefr"
  | "byTheme"
  | "studyStreak"
  | "hardestWords"
  | "phrasesByStatus";

type ChartOption = {
  id: ChartId;
  title: string;
  description: string;
  details: string;
};

const chartOptions: ChartOption[] = [
  {
    id: "byStatus",
    title: "Words by learning status",
    description: "Distribution of new, learning, review, known and mastered.",
    details:
      "Counts every word in the database by learning_status. Useful to see how much of your bank is still new versus already known or mastered.",
  },
  {
    id: "reviewSteps",
    title: "Progress toward known (7 reviews)",
    description: "How many words sit on each review step from 0 to 7.",
    details:
      "Groups words by correct_uses capped at 7. Review 0 means not advanced yet; higher steps mean the word is closer to being marked known in the spaced-repetition flow.",
  },
  {
    id: "activityByDay",
    title: "Reviews per day",
    description: "Words touched in the last 14 days based on last_seen.",
    details:
      "Shows how many words were updated in last_seen each day for the last 14 days. It reflects study activity volume, not unique review button presses.",
  },
  {
    id: "reviewQuality",
    title: "Again vs Good vs Known",
    description: "Incorrect uses, correct uses and known/mastered words.",
    details:
      "Again uses the sum of incorrect_uses, Good uses the sum of correct_uses, and Known counts words already in known or mastered. It is an aggregate quality snapshot of your practice history.",
  },
  {
    id: "reviewSchedule",
    title: "Overdue and upcoming reviews",
    description: "Schedule health from next_review_at.",
    details:
      "Breaks words into overdue, due today, upcoming, and unscheduled based on next_review_at. Helps you see whether your review queue is healthy or falling behind.",
  },
  {
    id: "byCefr",
    title: "Retention by CEFR",
    description: "Known/learning/other words grouped by CEFR level.",
    details:
      "For each CEFR level, compares known/mastered versus learning/review versus other statuses. Useful to check which levels you retain best.",
  },
  {
    id: "byTheme",
    title: "Progress by theme",
    description: "Top themes by known and learning volume.",
    details:
      "Shows the top 10 themes by word count and stacks known/mastered against learning/review. Use it to prioritize themes where you still have more active learning work.",
  },
  {
    id: "studyStreak",
    title: "Study streak",
    description: "Recent consecutive days with study activity.",
    details:
      "Builds a streak from distinct last_seen dates. An active day means at least one word was studied that day. The badge shows your current consecutive streak ending today.",
  },
  {
    id: "hardestWords",
    title: "Hardest words",
    description: "Top words with the most incorrect uses.",
    details:
      "Plots the top 10 words with incorrect_uses on the Y axis and correct_uses on the X axis. Words high on incorrect need more attention in Anki or conversation practice.",
  },
  {
    id: "phrasesByStatus",
    title: "Conversation phrase readiness",
    description: "Phrase status distribution for conversation practice.",
    details:
      "Only includes rows where is_phrase = 1, grouped by learning_status. Helps you see how ready your phrase bank is for conversation mode.",
  },
];

const pieColors = ["#228be6", "#15aabf", "#fab005", "#40c057", "#be4bdb"];

function computeStreak(studyDays: string[]) {
  if (studyDays.length === 0) {
    return { current: 0, points: [] as Array<{ name: string; value: number }> };
  }

  const daySet = new Set(studyDays);
  const points: Array<{ name: string; value: number }> = [];
  let current = 0;
  const cursor = new Date();

  for (let index = 0; index < 14; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    const active = daySet.has(key) ? 1 : 0;
    points.unshift({ name: key.slice(5), value: active });

    if (index === 0 || current > 0) {
      if (active) {
        current += 1;
      } else if (index > 0) {
        break;
      }
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, points };
}

function ChartPanel({
  chartId,
  data,
}: {
  chartId: ChartId;
  data: ProgressChartData;
}) {
  const streak = useMemo(
    () => computeStreak(data.studyDays),
    [data.studyDays],
  );

  switch (chartId) {
    case "byStatus":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie
              data={data.byStatus}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label
            >
              {data.byStatus.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={pieColors[index % pieColors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case "reviewSteps":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.reviewSteps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#228be6" name="Words" />
          </BarChart>
        </ResponsiveContainer>
      );

    case "activityByDay":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data.activityByDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#15aabf"
              strokeWidth={2}
              name="Words seen"
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case "reviewQuality":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.reviewQuality}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#fab005" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      );

    case "reviewSchedule":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.reviewSchedule}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#fa5252" name="Words" />
          </BarChart>
        </ResponsiveContainer>
      );

    case "byCefr":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.byCefr}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="known" stackId="a" fill="#40c057" name="Known" />
            <Bar
              dataKey="learning"
              stackId="a"
              fill="#228be6"
              name="Learning"
            />
            <Bar dataKey="other" stackId="a" fill="#868e96" name="Other" />
          </BarChart>
        </ResponsiveContainer>
      );

    case "byTheme":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={data.byTheme} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} />
            <Tooltip />
            <Legend />
            <Bar dataKey="known" stackId="a" fill="#40c057" name="Known" />
            <Bar
              dataKey="learning"
              stackId="a"
              fill="#228be6"
              name="Learning"
            />
          </BarChart>
        </ResponsiveContainer>
      );

    case "studyStreak":
      return (
        <Stack gap="sm">
          <Badge variant="light" color="teal" w="fit-content">
            Current streak: {streak.current} day
            {streak.current === 1 ? "" : "s"}
          </Badge>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={streak.points}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} domain={[0, 1]} />
              <Tooltip />
              <Bar dataKey="value" fill="#12b886" name="Active day" />
            </BarChart>
          </ResponsiveContainer>
        </Stack>
      );

    case "hardestWords":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="correct"
              name="Correct"
              allowDecimals={false}
            />
            <YAxis
              type="number"
              dataKey="incorrect"
              name="Incorrect"
              allowDecimals={false}
            />
            <ZAxis range={[80, 80]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data.hardestWords} fill="#e64980" name="Words" />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case "phrasesByStatus":
      return (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart>
            <Pie
              data={data.phrasesByStatus}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label
            >
              {data.phrasesByStatus.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={pieColors[index % pieColors.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
}

export function ProgressCharts() {
  const [selectedChartId, setSelectedChartId] =
    useState<ChartId>("byStatus");
  const [data, setData] = useState<ProgressChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/charts/progress");

      if (!response.ok) {
        setError("Could not load chart data");
        setLoading(false);
        return;
      }

      const result = (await response.json()) as { data: ProgressChartData };
      setData(result.data);
      setLoading(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const selectedChart =
    chartOptions.find((option) => option.id === selectedChartId) ??
    chartOptions[0];

  return (
    <Paper withBorder radius="lg" p="md" shadow="xs">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={3}>Charts</Title>
          <Text size="sm" c="dimmed">
            Pick a progress chart on the left to inspect your learning data.
          </Text>
        </Stack>

        <Splitter h={{ base: 640, md: 560 }}>
          <Splitter.Pane defaultSize="34%" min="240px" max="45%">
            <Stack gap="xs" p="sm" h="100%" style={{ overflow: "auto" }}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Chart list
              </Text>
              {chartOptions.map((option, index) => (
                <NavLink
                  key={option.id}
                  label={`${index + 1}. ${option.title}`}
                  active={selectedChartId === option.id}
                  variant="filled"
                  onClick={() => setSelectedChartId(option.id)}
                />
              ))}
            </Stack>
          </Splitter.Pane>

          <Splitter.Pane defaultSize="66%" min="40%">
            <Stack gap="sm" p="md" h="100%">
              <Group justify="space-between" align="flex-start" gap="sm">
                <Stack gap={4} style={{ flex: 1 }}>
                  <Title order={4}>{selectedChart.title}</Title>
                  <Text size="sm" c="dimmed">
                    {selectedChart.description}
                  </Text>
                </Stack>

                <Popover width={320} position="bottom-end" withArrow shadow="md">
                  <Popover.Target>
                    <ActionIcon
                      variant="light"
                      color="blue"
                      radius="xl"
                      aria-label="Chart information"
                    >
                      <FaCircleInfo size={16} />
                    </ActionIcon>
                  </Popover.Target>
                  <Popover.Dropdown>
                    <Stack gap="xs">
                      <Text size="sm" fw={700}>
                        {selectedChart.title}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {selectedChart.details}
                      </Text>
                    </Stack>
                  </Popover.Dropdown>
                </Popover>
              </Group>

              {loading ? (
                <Text c="dimmed">Loading chart data...</Text>
              ) : error ? (
                <Text c="red">{error}</Text>
              ) : data ? (
                <ChartPanel chartId={selectedChartId} data={data} />
              ) : null}
            </Stack>
          </Splitter.Pane>
        </Splitter>
      </Stack>
    </Paper>
  );
}
