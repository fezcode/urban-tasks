import React from 'react';
import MarkdownDisplay from 'react-native-markdown-display';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  children: string;
}

export const Markdown: React.FC<Props> = ({ children }) => {
  const { palette, fontSize } = useTheme();
  return (
    <MarkdownDisplay
      style={{
        body: {
          color: palette.textPrimary,
          fontSize: fontSize.base,
          fontFamily: 'Inter_400Regular',
          lineHeight: 22,
        },
        paragraph: { marginTop: 0, marginBottom: 10 },
        heading1: {
          color: palette.textPrimary,
          fontFamily: 'Fraunces_600SemiBold',
          fontSize: fontSize.xl,
          marginTop: 12,
          marginBottom: 6,
        },
        heading2: {
          color: palette.textPrimary,
          fontFamily: 'Fraunces_600SemiBold',
          fontSize: fontSize.lg,
          marginTop: 10,
          marginBottom: 4,
        },
        heading3: {
          color: palette.textPrimary,
          fontFamily: 'Inter_600SemiBold',
          fontSize: fontSize.md,
          marginTop: 8,
          marginBottom: 2,
        },
        strong: { fontFamily: 'Inter_600SemiBold' },
        em: { fontStyle: 'italic' },
        bullet_list: { marginBottom: 8 },
        ordered_list: { marginBottom: 8 },
        code_inline: {
          backgroundColor: palette.bgSecondary,
          color: palette.accent,
          fontFamily: 'Inter_400Regular',
          paddingHorizontal: 5,
          paddingVertical: 1,
          borderRadius: 4,
          fontSize: fontSize.sm,
        },
        code_block: {
          backgroundColor: palette.bgSecondary,
          color: palette.textPrimary,
          padding: 12,
          borderRadius: 8,
          fontFamily: 'Inter_400Regular',
          fontSize: fontSize.sm,
        },
        fence: {
          backgroundColor: palette.bgSecondary,
          color: palette.textPrimary,
          padding: 12,
          borderRadius: 8,
          fontFamily: 'Inter_400Regular',
          fontSize: fontSize.sm,
        },
        blockquote: {
          backgroundColor: 'transparent',
          borderLeftWidth: 2,
          borderLeftColor: palette.accent,
          paddingLeft: 12,
          marginLeft: 0,
          marginVertical: 6,
        },
        link: {
          color: palette.accent,
          textDecorationLine: 'underline',
        },
        hr: {
          backgroundColor: palette.border,
          height: 1,
          marginVertical: 10,
        },
      }}
    >
      {children}
    </MarkdownDisplay>
  );
};
