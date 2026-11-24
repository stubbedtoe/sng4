import { Option } from 'effect'
import { type Html, type HtmlBuilder, createLazy } from 'foldkit/html'

import { COLOUR_COUNT_CHOICES, FABRIC_COUNT_CHOICES } from '../constant'
import { CONVERTER_CONFIG } from '../converter/config'
import type { Palette } from '../converter/model'
import { Message } from '../message'
import type { Model } from '../model'
import { colourToHexString } from '../palette'

const sectionClass = 'flex flex-col gap-3'
const headingClass =
  'text-xs font-semibold uppercase tracking-wide text-slate-500'

const buttonBaseClass =
  'rounded-lg px-3 py-2 text-sm font-medium transition-colors'
const activeClass = 'bg-sky-600 text-white shadow-sm'
const inactiveClass = 'bg-slate-200/70 text-slate-700 hover:bg-slate-200'

// Each sidebar section is memoized with createLazy: a section only rebuilds
// when one of its own dependencies changes by value/reference, so messages
// that touch unrelated Model fields skip both VNode construction and DOM
// diffing for the rest of the sidebar. Arguments must be reference-stable
// (Model updates are structurally shared, so unchanged fields qualify).

const paletteSectionView = (
  h: HtmlBuilder<Message>,
  activePalette: Palette | undefined,
  paletteMode: Model['paletteMode'],
  colourCount: number,
  maybeCustomPalette: Model['maybeCustomPalette'],
  customColourDraft: string,
): Html =>
  h.section(
    [h.Class(sectionClass)],
    [
      h.h2([h.Class(headingClass)], ['Palette']),

      h.div(
        [h.Class('grid grid-cols-2 gap-2')],
        [
          h.button(
            [
              h.OnClick(Message.ChangedPaletteMode({ mode: 'from-image' })),
              h.Class(
                `${buttonBaseClass} ${paletteMode === 'from-image' ? activeClass : inactiveClass}`,
              ),
            ],
            ['From image'],
          ),
          h.button(
            [
              h.OnClick(Message.ChangedPaletteMode({ mode: 'custom' })),
              h.Class(
                `${buttonBaseClass} ${paletteMode === 'custom' ? activeClass : inactiveClass}`,
              ),
            ],
            ['Custom'],
          ),
        ],
      ),

      paletteMode === 'from-image'
        ? h.div(
            [h.Class('grid grid-cols-5 gap-2')],
            [
              ...COLOUR_COUNT_CHOICES.map(count =>
                h.button(
                  [
                    h.OnClick(Message.ChangedColourCount({ value: count })),
                    h.Class(
                      `${buttonBaseClass} px-2 py-1.5 text-xs ${colourCount === count ? activeClass : inactiveClass}`,
                    ),
                  ],
                  [String(count)],
                ),
              ),
            ],
          )
        : customPaletteEditorView(h, maybeCustomPalette, customColourDraft),

      activePalette === undefined
        ? h.empty
        : h.div(
            [h.Class('grid grid-cols-8 gap-1')],
            [
              ...activePalette.entries.map((entry, index) =>
                h.div(
                  [
                    h.Class(
                      'flex aspect-square items-center justify-center rounded text-[10px] font-semibold text-white/90',
                    ),
                    h.Style({
                      backgroundColor: colourToHexString(entry.colour),
                    }),
                    h.Title(`${entry.name} (${entry.number})`),
                  ],
                  [String(index + 1)],
                ),
              ),
            ],
          ),
    ],
  )

const customPaletteEditorView = (
  h: HtmlBuilder<Message>,
  maybeCustomPalette: Model['maybeCustomPalette'],
  customColourDraft: string,
): Html => {
  const isAtColourCap = Option.exists(
    maybeCustomPalette,
    palette => palette.entries.length >= CONVERTER_CONFIG.max_colours,
  )
  return h.div(
    [h.Class('flex flex-col gap-2')],
    [
      Option.match(maybeCustomPalette, {
        onNone: () =>
          h.p([h.Class('text-xs text-slate-500')], ['No custom colours yet.']),
        onSome: palette =>
          h.ul(
            [h.Class('flex flex-col gap-1.5')],
            [
              ...palette.entries.map((entry, index) =>
                h.li(
                  [h.Class('flex items-center gap-1.5')],
                  [
                    h.input([
                      h.Attribute('type', 'color'),
                      h.Attribute('aria-label', `Edit colour ${index + 1}`),
                      h.Value(colourToHexString(entry.colour)),
                      h.Class(
                        'h-8 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5',
                      ),
                      h.OnInput(value =>
                        Message.EditedCustomColour({ index, hex: value }),
                      ),
                    ]),
                    h.span(
                      [
                        h.Class(
                          'min-w-0 flex-1 truncate text-xs text-slate-600',
                        ),
                      ],
                      [`${entry.name} · ${entry.number}`],
                    ),
                    h.button(
                      [
                        h.OnClick(
                          Message.MovedCustomColour({ index, delta: -1 }),
                        ),
                        h.AriaLabel(`Move colour ${index + 1} up`),
                        h.Disabled(index === 0),
                        h.Class(
                          'rounded bg-slate-200/70 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-40',
                        ),
                      ],
                      ['↑'],
                    ),
                    h.button(
                      [
                        h.OnClick(
                          Message.MovedCustomColour({ index, delta: 1 }),
                        ),
                        h.AriaLabel(`Move colour ${index + 1} down`),
                        h.Disabled(index === palette.entries.length - 1),
                        h.Class(
                          'rounded bg-slate-200/70 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-40',
                        ),
                      ],
                      ['↓'],
                    ),
                    h.button(
                      [
                        h.OnClick(Message.RemovedCustomColour({ index })),
                        h.AriaLabel(`Remove colour ${index + 1}`),
                        h.Class(
                          'rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100',
                        ),
                      ],
                      ['×'],
                    ),
                  ],
                ),
              ),
            ],
          ),
      }),
      h.div(
        [h.Class('flex items-center gap-2')],
        [
          h.input([
            h.Attribute('type', 'color'),
            h.Attribute('aria-label', 'New colour'),
            h.Value(customColourDraft),
            h.Class(
              'h-8 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5',
            ),
            h.OnInput(value => Message.UpdatedColourDraft({ value })),
          ]),
          h.button(
            [
              h.OnClick(Message.AddedCustomColour({ hex: customColourDraft })),
              h.Disabled(isAtColourCap),
              h.Class(
                `${buttonBaseClass} bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40`,
              ),
            ],
            ['Add colour'],
          ),
        ],
      ),
    ],
  )
}

const ditheringSectionView = (
  h: HtmlBuilder<Message>,
  dithering: Model['dithering'],
): Html =>
  h.section(
    [h.Class(sectionClass)],
    [
      h.h2([h.Class(headingClass)], ['Dithering']),
      h.div(
        [h.Class('grid grid-cols-2 gap-2')],
        [
          h.button(
            [
              h.OnClick(Message.ChangedDithering({ algorithm: 'None' })),
              h.Class(
                `${buttonBaseClass} ${dithering === 'None' ? activeClass : inactiveClass}`,
              ),
            ],
            ['None'],
          ),
          h.button(
            [
              h.OnClick(
                Message.ChangedDithering({ algorithm: 'FloydSteinberg' }),
              ),
              h.Class(
                `${buttonBaseClass} ${dithering === 'FloydSteinberg' ? activeClass : inactiveClass}`,
              ),
            ],
            ['Floyd-Steinberg'],
          ),
        ],
      ),
    ],
  )

const patternSectionView = (
  h: HtmlBuilder<Message>,
  targetSide: Model['targetSide'],
  targetStitches: number,
  fabricCount: number,
): Html =>
  h.section(
    [h.Class(sectionClass)],
    [
      h.h2([h.Class(headingClass)], ['Pattern']),

      h.div(
        [h.Class('flex items-center gap-2')],
        [
          h.span([h.Class('w-20 text-xs text-slate-600')], ['Fit']),
          h.div(
            [h.Class('grid flex-1 grid-cols-2 gap-2')],
            [
              h.button(
                [
                  h.OnClick(Message.ChangedTargetSide({ side: 'width' })),
                  h.Class(
                    `${buttonBaseClass} px-2 py-1.5 text-xs ${targetSide === 'width' ? activeClass : inactiveClass}`,
                  ),
                ],
                ['By width'],
              ),
              h.button(
                [
                  h.OnClick(Message.ChangedTargetSide({ side: 'height' })),
                  h.Class(
                    `${buttonBaseClass} px-2 py-1.5 text-xs ${targetSide === 'height' ? activeClass : inactiveClass}`,
                  ),
                ],
                ['By height'],
              ),
            ],
          ),
        ],
      ),

      h.label(
        [h.Class('flex items-center gap-2')],
        [
          h.span([h.Class('w-20 text-xs text-slate-600')], ['Stitches']),
          h.input([
            h.Attribute('type', 'number'),
            h.Min('1'),
            h.Max('500'),
            h.Step('1'),
            h.Value(String(targetStitches)),
            h.Class(
              'w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm',
            ),
            h.OnChange(value =>
              Message.ChangedTargetStitches({
                value: Number.parseInt(value, 10) || 0,
              }),
            ),
          ]),
        ],
      ),

      h.div(
        [h.Class('flex items-center gap-2')],
        [
          h.span([h.Class('w-20 text-xs text-slate-600')], ['Fabric']),
          h.div(
            [h.Class('flex flex-wrap gap-1.5')],
            [
              ...FABRIC_COUNT_CHOICES.map(count =>
                h.button(
                  [
                    h.OnClick(Message.ChangedFabricCount({ value: count })),
                    h.Class(
                      `rounded px-2 py-1 text-xs font-medium ${fabricCount === count ? activeClass : inactiveClass}`,
                    ),
                  ],
                  [`${count}-ct`],
                ),
              ),
            ],
          ),
        ],
      ),

      h.button(
        [
          h.OnClick(Message.ClickedGenerate()),
          h.Class(`${buttonBaseClass} bg-sky-600 text-white hover:bg-sky-700`),
        ],
        ['Generate pattern'],
      ),
    ],
  )

const infoSectionView = (
  h: HtmlBuilder<Message>,
  preview: Model['preview'],
): Html => {
  if (preview._tag !== 'Ready') {
    return h.empty
  }
  const { summary } = preview
  return h.section(
    [h.Class(`${sectionClass} rounded-lg bg-slate-100 p-3`)],
    [
      h.h2([h.Class(headingClass)], ['Result']),
      h.dl(
        [h.Class('flex flex-col gap-1 text-xs text-slate-700')],
        [
          h.div(
            [h.Class('flex justify-between')],
            [
              h.dt([], ['Grid']),
              h.dd(
                [],
                [
                  `${summary.stitchDimensions.width} × ${summary.stitchDimensions.height} stitches`,
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('flex justify-between')],
            [
              h.dt([], ['Finished']),
              h.dd(
                [],
                [
                  `${summary.finishedDimensions.widthIn.toFixed(1)} × ${summary.finishedDimensions.heightIn.toFixed(1)} in`,
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('flex justify-between')],
            [
              h.dt([], ['Colours']),
              h.dd([], [String(summary.palette.entries.length)]),
            ],
          ),
          h.div(
            [h.Class('flex justify-between')],
            [
              h.dt([], ['Total stitches']),
              h.dd(
                [],
                [
                  String(
                    summary.stitchDimensions.width *
                      summary.stitchDimensions.height,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

const pdfSectionView = (
  h: HtmlBuilder<Message>,
  title: string,
  pdf: Model['pdf'],
  canExport: boolean,
): Html =>
  h.section(
    [h.Class(sectionClass)],
    [
      h.h2([h.Class(headingClass)], ['Printable PDF']),
      h.input([
        h.Attribute('type', 'text'),
        h.Placeholder('Pattern title'),
        h.Value(title),
        h.Class(
          'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm',
        ),
        h.OnInput(value => Message.UpdatedTitle({ value })),
      ]),
      h.button(
        [
          h.OnClick(Message.ClickedExportPdf()),
          h.Disabled(!canExport),
          h.Class(
            `${buttonBaseClass} bg-slate-800 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40`,
          ),
        ],
        [pdf._tag === 'Working' ? 'Generating PDF…' : 'Download PDF'],
      ),
      pdf._tag === 'Failed'
        ? h.p([h.Class('text-xs font-medium text-red-700')], [pdf.reason])
        : h.empty,
    ],
  )

const paletteSectionLazy = createLazy()
const ditheringSectionLazy = createLazy()
const patternSectionLazy = createLazy()
const infoSectionLazy = createLazy()
const pdfSectionLazy = createLazy()

export const sidebarView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [
      h.Class(
        'flex w-full flex-col gap-6 overflow-y-auto border-t border-slate-200 bg-white p-4 md:w-80 md:border-l md:border-t-0',
      ),
    ],
    [
      paletteSectionLazy(paletteSectionView, [
        h,
        model.preview._tag === 'Ready'
          ? model.preview.summary.palette
          : undefined,
        model.paletteMode,
        model.colourCount,
        model.maybeCustomPalette,
        model.customColourDraft,
      ]),
      ditheringSectionLazy(ditheringSectionView, [h, model.dithering]),
      patternSectionLazy(patternSectionView, [
        h,
        model.targetSide,
        model.targetStitches,
        model.fabricCount,
      ]),
      infoSectionLazy(infoSectionView, [h, model.preview]),
      pdfSectionLazy(pdfSectionView, [
        h,
        model.title,
        model.pdf,
        model.preview._tag === 'Ready' && model.pdf._tag !== 'Working',
      ]),
    ],
  )
