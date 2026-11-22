import type { Html, HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { Model } from '../model'
import { SourceState } from '../model'
import { filePickerView } from './preview'

const toolbarButtonClass =
  'rounded-lg bg-slate-800/5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-800/10'

const previewModeToggleView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex rounded-lg bg-slate-800/5 p-0.5')],
    [
      h.button(
        [
          h.OnClick(Message.ClickedPreviewMode({ mode: 'source' })),
          h.AriaLabel('Show source image'),
          h.Class(
            `rounded-md px-3 py-1 text-xs font-semibold transition-colors ${model.previewMode === 'source' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`,
          ),
        ],
        ['Source'],
      ),
      h.button(
        [
          h.OnClick(Message.ClickedPreviewMode({ mode: 'pattern' })),
          h.AriaLabel('Show stitch pattern'),
          h.Class(
            `rounded-md px-3 py-1 text-xs font-semibold transition-colors ${model.previewMode === 'pattern' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`,
          ),
        ],
        ['Pattern'],
      ),
    ],
  )

export const toolbarView = (model: Model, h: HtmlBuilder<Message>): Html =>
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
      SourceState.match(model.source, {
        NoSource: () =>
          filePickerView('Choose an image', 'atomsphere-image-input', h),
        Loading: () =>
          h.span(
            [h.Class('text-xs font-medium text-slate-500')],
            ['Decoding…'],
          ),
        Failed: () =>
          filePickerView(
            'Choose an image',
            'atomsphere-image-input-failed-toolbar',
            h,
          ),
        Ready: () =>
          h.div(
            [h.Class('flex items-center gap-2')],
            [
              previewModeToggleView(model, h),
              h.button(
                [
                  h.OnClick(Message.ClickedFitPreview()),
                  h.Class(toolbarButtonClass),
                ],
                ['Zoom to fit'],
              ),
              filePickerView('New image', 'atomsphere-image-input-toolbar', h),
            ],
          ),
      }),
    ],
  )
