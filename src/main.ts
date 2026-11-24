import { Option } from 'effect'
import { Runtime } from 'foldkit'

import { CONVERTER_CONFIG } from './converter/config'
import { Message } from './message'
import { Model, PdfStatus, PreviewStatus, SourceState } from './model'
import { update } from './update'
import { view } from './view'

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {
    source: SourceState.NoSource(),
    title: 'Untitled Pattern',
    paletteMode: 'from-image',
    colourCount: 8,
    maybeCustomPalette: Option.none(),
    dithering: 'FloydSteinberg',
    targetSide: 'width',
    targetStitches: 100,
    fabricCount: CONVERTER_CONFIG.default_fabric_count,
    previewMode: 'pattern',
    preview: PreviewStatus.AwaitingSource(),
    maybePipelineError: Option.none(),
    pdf: PdfStatus.Idle(),
    isPreviewMounted: false,
    previewZoom: 100,
    runId: 0,
    customColourDraft: '#b91c1c',
    maybeStitchSelection: Option.none(),
  },
})

export { Message, Model, update, view }
