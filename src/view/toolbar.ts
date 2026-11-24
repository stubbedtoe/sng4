import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'
import { filePickerView } from './preview'

const toolbarButtonClass =
  'rounded-lg bg-slate-800/5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-800/10'

const previewModeToggleView = (
  h: HtmlBuilder<Message>,
  previewMode: Model['previewMode'],
): Html =>
  h.div(
    [h.Class('flex rounded-lg bg-slate-800/5 p-0.5')],
    [
      h.button(
        [
          h.OnClick(Message.ClickedPreviewMode({ mode: 'source' })),
          h.AriaLabel('Show source image'),
          h.Class(
            `rounded-md px-3 py-1 text-xs font-semibold transition-colors ${previewMode === 'source' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`,
          ),
        ],
        ['Source'],
      ),
      h.button(
        [
          h.OnClick(Message.ClickedPreviewMode({ mode: 'pattern' })),
          h.AriaLabel('Show stitch pattern'),
          h.Class(
            `rounded-md px-3 py-1 text-xs font-semibold transition-colors ${previewMode === 'pattern' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`,
          ),
        ],
        ['Pattern'],
      ),
    ],
  )

export const toolbarView = (
  h: HtmlBuilder<Message>,
  source: Model['source'],
  previewMode: Model['previewMode'],
): Html =>
  h.header(
    [
      h.Class(
        'flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3',
      ),
    ],
    [
      h.div(
        [h.Class('mr-auto flex items-baseline gap-2')],
        [
          h.h1([h.Class('text-lg font-bold tracking-tight')], ['Atomsphere']),
          h.span(
            [h.Class('hidden text-xs text-slate-500 sm:inline')],
            ['image to cross-stitch'],
          ),
        ],
      ),
      source._tag === 'NoSource'
        ? filePickerView('Choose an image', 'atomsphere-image-input', h)
        : source._tag === 'Loading'
          ? h.span(
              [h.Class('text-xs font-medium text-slate-500')],
              ['Decoding…'],
            )
          : source._tag === 'Failed'
            ? filePickerView(
                'Choose an image',
                'atomsphere-image-input-failed-toolbar',
                h,
              )
            : h.div(
                [h.Class('flex items-center gap-2')],
                [
                  previewModeToggleView(h, previewMode),
                  h.button(
                    [
                      h.OnClick(Message.ClickedFitPreview()),
                      h.Class(toolbarButtonClass),
                    ],
                    ['Zoom to fit'],
                  ),
                  filePickerView(
                    'New image',
                    'atomsphere-image-input-toolbar',
                    h,
                  ),
                ],
              ),
    ],
  )
