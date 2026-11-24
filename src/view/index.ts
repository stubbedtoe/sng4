import { type Document, type HtmlBuilder, createLazy } from 'foldkit/html'

import type { Message } from '../message'
import type { Model } from '../model'
import { sidebarView } from './controls'
import { previewView } from './preview'
import { toolbarView } from './toolbar'

const toolbarLazy = createLazy()

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Atomsphere',
  body: h.div(
    // Wide devices anchor the shell to exactly the viewport height: the
    // sidebar scrolls internally, so re-renders that grow or shrink its
    // content cannot change the canvas area's height (no resize/shift).
    // Narrow devices keep the scrolling min-height page.
    [
      h.Class(
        'flex min-h-dvh flex-col bg-slate-50 text-slate-900 md:h-dvh md:overflow-hidden',
      ),
    ],
    [
      toolbarLazy(toolbarView, [h, model.source, model.previewMode]),
      h.main(
        [h.Class('flex flex-1 flex-col md:min-h-0 md:flex-row')],
        [previewView(model, h), sidebarView(model, h)],
      ),
    ],
  ),
})
