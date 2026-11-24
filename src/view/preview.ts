import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { PREVIEW_HOST_ID } from '../constant'
import { Message } from '../message'
import type { Model } from '../model'
import { PreviewStatus, SourceState } from '../model'
import { MountPreview } from '../rendering/pixi/mountPreview'

export const filePickerView = (
  label: string,
  inputId: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.label(
    [
      h.Attribute('for', inputId),
      h.Class(
        'inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-sky-700 transition-colors',
      ),
    ],
    [
      h.span([], [label]),
      h.input([
        h.Id(inputId),
        h.Class('hidden'),
        h.Attribute('type', 'file'),
        h.Attribute('accept', 'image/jpeg,image/png,image/webp'),
        h.OnFileChange(files => Message.SelectedLocalImage({ files })),
      ]),
    ],
  )

const noSourceView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-100 text-slate-600',
      ),
    ],
    [
      h.p(
        [h.Class('text-lg font-medium')],
        ['Turn a photo into a cross-stitch pattern'],
      ),
      h.p(
        [h.Class('text-sm')],
        ['Everything runs locally in your browser. Nothing is uploaded.'],
      ),
      filePickerView('Choose an image', 'atomsphere-image-input-empty', h),
    ],
  )

const loadingSourceView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-600',
      ),
    ],
    [h.p([], ['Decoding image…'])],
  )

const failedSourceView = (reason: string, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-100',
      ),
    ],
    [
      h.p([h.Class('text-sm font-medium text-red-700')], [reason]),
      filePickerView('Try another image', 'atomsphere-image-input-failed', h),
    ],
  )

const canvasHostView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('absolute inset-0 overflow-hidden')],
    [
      h.div([
        h.Id(PREVIEW_HOST_ID),
        h.Class('absolute inset-0'),
        h.AriaLabel('Pattern preview canvas'),
        h.OnMount(MountPreview({ hostId: PREVIEW_HOST_ID })),
      ]),
      previewOverlayView(model, h),
    ],
  )

const previewOverlayView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'pointer-events-none absolute inset-0 flex flex-col justify-between p-3',
      ),
    ],
    [
      h.div(
        [h.Class('flex items-start justify-between gap-2')],
        [
          h.div(
            [h.Class('flex flex-col gap-2')],
            [
              PreviewStatus.match(model.preview, {
                AwaitingSource: () => h.empty,
                Ready: () => h.empty,
                Failed: ({ reason }) =>
                  h.div(
                    [
                      h.Class(
                        'pointer-events-auto rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700 shadow',
                      ),
                    ],
                    [reason],
                  ),
                Processing: () =>
                  h.div(
                    [
                      h.Class(
                        'rounded-md bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-white',
                      ),
                    ],
                    ['Rendering pattern…'],
                  ),
              }),
              model.preview._tag === 'Ready'
                ? Option.match(model.maybePipelineError, {
                    onNone: () => h.empty,
                    onSome: reason =>
                      h.div(
                        [
                          h.Class(
                            'pointer-events-auto rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 shadow',
                          ),
                        ],
                        [`Latest change could not be applied: ${reason}`],
                      ),
                  })
                : h.empty,
              Option.match(model.maybeStitchSelection, {
                onNone: () => h.empty,
                onSome: selection =>
                  h.div(
                    [
                      h.Class(
                        'pointer-events-auto flex items-center gap-2 rounded-md bg-white/95 px-3 py-2 text-xs font-medium text-slate-800 shadow',
                      ),
                    ],
                    [
                      h.span([
                        h.Class(
                          'inline-block h-4 w-4 rounded border border-slate-300',
                        ),
                        h.Style({ backgroundColor: selection.hex }),
                      ]),
                      h.span(
                        [],
                        [
                          `Row ${selection.y}, col ${selection.x} · ${selection.symbol} · ${selection.flossName} (${selection.flossNumber})`,
                        ],
                      ),
                    ],
                  ),
              }),
            ],
          ),
          h.div(
            [h.Class('flex items-center gap-2')],
            [
              h.button(
                [
                  h.OnClick(Message.ClickedZoomOut()),
                  h.AriaLabel('Zoom out'),
                  h.Class(
                    'pointer-events-auto rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white',
                  ),
                ],
                ['−'],
              ),
              h.span(
                [
                  h.Class(
                    'pointer-events-auto rounded-md bg-white/95 px-2 py-1.5 text-xs font-semibold tabular-nums text-slate-700 shadow',
                  ),
                ],
                [`${model.previewZoom}%`],
              ),
              h.button(
                [
                  h.OnClick(Message.ClickedZoomIn()),
                  h.AriaLabel('Zoom in'),
                  h.Class(
                    'pointer-events-auto rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white',
                  ),
                ],
                ['+'],
              ),
              h.button(
                [
                  h.OnClick(Message.ClickedFitPreview()),
                  h.AriaLabel('Zoom to fit'),
                  h.Class(
                    'pointer-events-auto rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white',
                  ),
                ],
                ['Fit'],
              ),
            ],
          ),
        ],
      ),
    ],
  )

export const previewView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        'relative h-[55vh] min-h-72 border-b border-slate-200 bg-slate-100 md:h-auto md:min-h-0 md:flex-1 md:border-b-0',
      ),
    ],
    [
      // The canvas host stays mounted across source states: replacing it
      // would destroy and recreate the whole Pixi/WebGL stack on every new
      // image (and reset the zoom). The state views render as overlays on
      // top of it.
      canvasHostView(model, h),
      SourceState.match(model.source, {
        NoSource: () => noSourceView(h),
        Loading: () => loadingSourceView(h),
        Failed: ({ reason }) => failedSourceView(reason, h),
        Ready: () => h.empty,
      }),
    ],
  )
