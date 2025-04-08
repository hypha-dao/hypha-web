import { createGlobPatternsForDependencies } from '@nx/react/tailwind';
import { join } from 'node:path';
import TailwindAnimate from 'tailwindcss-animate';
import TailwindTypography from '@tailwindcss/typography';
import type { PluginUtils } from 'tailwindcss/types/config';
import { withUt } from 'uploadthing/tw';

import type { Config } from 'tailwindcss';

export function buildConfig(appDir: string): Config {
  return withUt({
    darkMode: ['class'],
    safelist: ['dark', 'light'],
    content: [
      join(
        appDir,
        '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}',
      ),
      '../../packages/ui/src/**/*!(*.stories|*.spec).{ts,tsx,html}',
      '../../packages/epics/src/**/*!(*.stories|*.spec).{ts,tsx,html}',
      ...createGlobPatternsForDependencies(appDir),
      './node_modules/uploadthing/**/*.{ts,tsx,html}',
    ],
    theme: {
      screens: {
        sm: '64rem', //     => @media (min-width: 640px) { ... }
        md: '81.2rem', //     => @media (min-width: 812px) { ... }
        lg: '81.2rem', //    => @media (min-width: 812px) { ... }
        xl: '81.2rem', //    => @media (min-width: 812px) { ... }
        '2xl': '81.2rem', // => @media (min-width: 812px) { ... }
      },
      container: {
        center: true,
        padding: {
          DEFAULT: 'var(--spacing-5)',
          sm: 'var(--spacing-5)',
          lg: 'var(--spacing-5)',
          xl: 'var(--spacing-5)',
          '2xl': 'var(--spacing-5)',
        },
      },
      extend: {
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))',
            contrast: 'hsl(var(--accent-contrast))',
            surface: 'hsl(var(--accent-surface))',
            1: 'hsl(var(--accent-1))',
            2: 'hsl(var(--accent-2))',
            3: 'hsl(var(--accent-3))',
            4: 'hsl(var(--accent-4))',
            5: 'hsl(var(--accent-5))',
            6: 'hsl(var(--accent-6))',
            7: 'hsl(var(--accent-7))',
            8: 'hsl(var(--accent-8))',
            9: 'hsl(var(--accent-9))',
            10: 'hsl(var(--accent-10))',
            11: 'hsl(var(--accent-11))',
            12: 'hsl(var(--accent-12))',
          },
          background: {
            DEFAULT: 'hsl(var(--background))',
            1: 'hsl(var(--background-1))',
            2: 'hsl(var(--background-2))',
            3: 'hsl(var(--background-3))',
            4: 'hsl(var(--background-4))',
            5: 'hsl(var(--background-5))',
            6: 'hsl(var(--background-6))',
            7: 'hsl(var(--background-7))',
            8: 'hsl(var(--background-8))',
            9: 'hsl(var(--background-9))',
            10: 'hsl(var(--background-10))',
            11: 'hsl(var(--background-11))',
            12: 'hsl(var(--background-12))',
          },
          black: {
            DEFAULT: 'hsl(var(--black))',
            contrast: 'hsl(var(--black-contrast))',
          },
          white: {
            DEFAULT: 'hsl(var(--white))',
            contrast: 'hsl(var(--white-contrast))',
          },
          error: {
            DEFAULT: 'hsl(var(--error))',
            1: 'hsl(var(--error-1))',
            2: 'hsl(var(--error-2))',
            3: 'hsl(var(--error-3))',
            4: 'hsl(var(--error-4))',
            5: 'hsl(var(--error-5))',
            6: 'hsl(var(--error-6))',
            7: 'hsl(var(--error-7))',
            8: 'hsl(var(--error-8))',
            9: 'hsl(var(--error-9))',
            10: 'hsl(var(--error-10))',
            11: 'hsl(var(--error-11))',
            12: 'hsl(var(--error-12))',
          },
          info: {
            DEFAULT: 'hsl(var(--info))',
            1: 'hsl(var(--info-1))',
            2: 'hsl(var(--info-2))',
            3: 'hsl(var(--info-3))',
            4: 'hsl(var(--info-4))',
            5: 'hsl(var(--info-5))',
            6: 'hsl(var(--info-6))',
            7: 'hsl(var(--info-7))',
            8: 'hsl(var(--info-8))',
            9: 'hsl(var(--info-9))',
            10: 'hsl(var(--info-10))',
            11: 'hsl(var(--info-11))',
            12: 'hsl(var(--info-12))',
          },
          success: {
            DEFAULT: 'hsl(var(--success))',
            1: 'hsl(var(--success-1))',
            2: 'hsl(var(--success-2))',
            3: 'hsl(var(--success-3))',
            4: 'hsl(var(--success-4))',
            5: 'hsl(var(--success-5))',
            6: 'hsl(var(--success-6))',
            7: 'hsl(var(--success-7))',
            8: 'hsl(var(--success-8))',
            9: 'hsl(var(--success-9))',
            10: 'hsl(var(--success-10))',
            11: 'hsl(var(--success-11))',
            12: 'hsl(var(--success-12))',
          },
          neutral: {
            DEFAULT: 'hsl(var(--neutral))',
            1: 'hsl(var(--neutral-1))',
            2: 'hsl(var(--neutral-2))',
            3: 'hsl(var(--neutral-3))',
            4: 'hsl(var(--neutral-4))',
            5: 'hsl(var(--neutral-5))',
            6: 'hsl(var(--neutral-6))',
            7: 'hsl(var(--neutral-7))',
            8: 'hsl(var(--neutral-8))',
            9: 'hsl(var(--neutral-9))',
            10: 'hsl(var(--neutral-10))',
            11: 'hsl(var(--neutral-11))',
            12: 'hsl(var(--neutral-12))',
          },
          warning: {
            DEFAULT: 'hsl(var(--warning))',
            1: 'hsl(var(--warning-1))',
            2: 'hsl(var(--warning-2))',
            3: 'hsl(var(--warning-3))',
            4: 'hsl(var(--warning-4))',
            5: 'hsl(var(--warning-5))',
            6: 'hsl(var(--warning-6))',
            7: 'hsl(var(--warning-7))',
            8: 'hsl(var(--warning-8))',
            9: 'hsl(var(--warning-9))',
            10: 'hsl(var(--warning-10))',
            11: 'hsl(var(--warning-11))',
            12: 'hsl(var(--warning-12))',
          },
          foreground: 'hsl(var(--foreground))',
          'page-background': 'hsl(var(--page-background))',
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))',
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))',
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))',
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))',
          },
          action: {
            DEFAULT: 'rgb(62, 99, 221)',
            foreground: 'rgb(32, 58, 119)',
          },
          'action-light': {
            DEFAULT: 'hsl(var(--action-light))',
            foreground: 'hsl(var(--action-light))',
          },
        },
        borderRadius: {
          lg: `var(--radius)`,
          md: `calc(var(--radius) - 2px)`,
          sm: 'calc(var(--radius) - 4px)',
        },

        keyframes: {
          'accordion-down': {
            from: { height: '0' },
            to: { height: 'var(--radix-accordion-content-height)' },
          },
          'accordion-up': {
            from: { height: 'var(--radix-accordion-content-height)' },
            to: { height: '0' },
          },
        },
        animation: {
          'accordion-down': 'accordion-down 0.2s ease-out',
          'accordion-up': 'accordion-up 0.2s ease-out',
        },
        fontFamily: {
          text: ['var(--font-text)'],
          code: ['var(--font-code)'],
          emphasis: ['var(--font-emphasis)'],
          quote: ['var(--font-quote)'],
        },
        fontWeight: {
          light: 'var(--font-weight-light)',
          regular: 'var(--font-weight-regular)',
          medium: 'var(--font-weight-medium)',
          bold: 'var(--font-weight-bold)',
        },
        lineHeight: {
          '1': 'var(--line-height-1)',
          '2': 'var(--line-height-2)',
          '3': 'var(--line-height-3)',
          '4': 'var(--line-height-4)',
          '5': 'var(--line-height-5)',
          '6': 'var(--line-height-6)',
          '7': 'var(--line-height-7)',
          '8': 'var(--line-height-8)',
          '9': 'var(--line-height-9)',
        },
        fontSize: {
          xs: ['var(--font-size-xs)', 'var(--line-height-1)'],
          sm: ['var(--font-size-sm)', 'var(--line-height-2)'],
          base: ['var(--font-size-base)', 'var(--line-height-3)'],
          lg: ['var(--font-size-lg)', 'var(--line-height-5)'],
          xl: ['var(--font-size-xl)', 'var(--line-height-5)'],
          '2xl': ['var(--font-size-2xl)', 'var(--line-height-6)'],
          '3xl': ['var(--font-size-3xl)', 'var(--line-height-7)'],
          '4xl': ['var(--font-size-4xl)', 'var(--line-height-8)'],
          '5xl': ['var(--font-size-5xl)', '1'],
          '6xl': ['var(--font-size-6xl)', '1'],
          '7xl': ['var(--font-size-7xl)', '1'],
          '8xl': ['var(--font-size-8xl)', '1'],
          '9xl': ['var(--font-size-9xl)', '1'],

          '1': ['var(--font-size-1)', 'var(--line-height-1)'],
          '2': ['var(--font-size-2)', 'var(--line-height-2)'],
          '3': ['var(--font-size-3)', 'var(--line-height-3)'],
          '4': ['var(--font-size-4)', 'var(--line-height-4)'],
          '5': ['var(--font-size-5)', 'var(--line-height-5)'],
          '6': ['var(--font-size-6)', 'var(--line-height-6)'],
          '7': ['var(--font-size-7)', 'var(--line-height-7)'],
          '8': ['var(--font-size-8)', 'var(--line-height-8)'],
          '9': ['var(--font-size-9)', 'var(--line-height-9)'],
        },
        letterSpacing: {
          '1': 'var(--letter-spacing-1)',
          '2': 'var(--letter-spacing-2)',
          '3': 'var(--letter-spacing-3)',
          '4': 'var(--letter-spacing-4)',
          '5': 'var(--letter-spacing-5)',
        },
        spacing: {
          '1': 'var(--spacing-1)',
          '2': 'var(--spacing-2)',
          '3': 'var(--spacing-3)',
          '4': 'var(--spacing-4)',
          '5': 'var(--spacing-5)',
          '6': 'var(--spacing-6)',
          '7': 'var(--spacing-7)',
          '8': 'var(--spacing-8)',
          '9': 'var(--spacing-9)',
          'container-sm': 'var(--spacing-container-sm)',
          'container-md': 'var(--spacing-container-md)',
          'container-lg': 'var(--spacing-container-lg)',
          'container-xl': 'var(--spacing-container-xl)',
          'container-2xl': 'var(--spacing-container-2xl)',
        },
        typography: ({ theme }: PluginUtils) => ({
          DEFAULT: {
            css: {
              // ADDED FOR REFERENCE. ADJUST AS NEEDED.
              // https://github.com/tailwindlabs/tailwindcss-typography/blob/main/README.md#adding-custom-color-themes
              '--tw-prose-body': theme('colors.foreground'),
              '--tw-prose-headings': theme('colors.foreground'),
              '--tw-prose-lead': 'var(--tw-prose-lead)',
              '--tw-prose-links': theme('colors.accent[11]'),
              '--tw-prose-bold': 'var(--tw-prose-bold)',
              '--tw-prose-counters': 'var(--tw-prose-counters)',
              '--tw-prose-bullets': 'var(--tw-prose-bullets)',
              '--tw-prose-hr': 'var(--tw-prose-hr)',
              '--tw-prose-quotes': 'var(--tw-prose-quotes)',
              '--tw-prose-quote-borders': theme('colors.accent[6]'),
              '--tw-prose-captions': 'var(--tw-prose-captions)',
              '--tw-prose-kbd': 'var(--tw-prose-kbd)',
              '--tw-prose-kbd-shadows': 'var(--tw-prose-kbd-shadows)',
              '--tw-prose-code': 'var(--tw-prose-code)',
              '--tw-prose-pre-code': 'var(--tw-prose-pre-code)',
              '--tw-prose-pre-bg': 'var(--tw-prose-pre-bg)',
              '--tw-prose-th-borders': 'var(--tw-prose-th-borders)',
              '--tw-prose-td-borders': 'var(--tw-prose-td-borders)',
              // INVERTED COLORS
              '--tw-prose-invert-body': theme('colors.foreground'),
              '--tw-prose-invert-headings': theme('colors.foreground'),
              '--tw-prose-invert-lead': 'var(--tw-prose-invert-lead)',
              '--tw-prose-invert-links': 'var(--tw-prose-invert-links)',
              '--tw-prose-invert-bold': 'var(--tw-prose-invert-bold)',
              '--tw-prose-invert-counters': 'var(--tw-prose-invert-counters)',
              '--tw-prose-invert-bullets': 'var(--tw-prose-invert-bullets)',
              '--tw-prose-invert-hr': 'var(--tw-prose-invert-hr)',
              '--tw-prose-invert-quotes': 'var(--tw-prose-invert-quotes)',
              '--tw-prose-invert-quote-borders': theme('colors.accent[6]'),
              '--tw-prose-invert-captions': 'var(--tw-prose-invert-captions)',
              '--tw-prose-invert-kbd': 'var(--tw-prose-invert-kbd)',
              '--tw-prose-invert-code': 'var(--tw-prose-invert-code)',
              '--tw-prose-invert-pre-code': 'var(--tw-prose-invert-pre-code)',
              '--tw-prose-invert-pre-bg': 'var(--tw-prose-invert-pre-bg)',
              '--tw-prose-invert-th-borders':
                'var(--tw-prose-invert-th-borders)',
              '--tw-prose-invert-td-borders':
                'var(--tw-prose-invert-td-borders)',
            },
          },
        }),
      },
    },
    plugins: [TailwindAnimate, TailwindTypography],
  });
}
