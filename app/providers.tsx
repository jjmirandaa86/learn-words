"use client";

import { createTheme, MantineProvider } from "@mantine/core";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Arial, Helvetica, sans-serif"
});

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}
