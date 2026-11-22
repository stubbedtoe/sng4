import type { Document, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'
import type { Model } from '../model'
import { sidebarView } from './controls'
import { previewView } from './preview'
import { toolbarView } from './toolbar'

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Atomsphere',
  body: h.div(
    [h.Class('flex min-h-dvh flex-col bg-slate-50 text-slate-900')],
    [
      toolbarView(model, h),
      h.main(
        [h.Class('flex flex-1 flex-col md:min-h-0 md:flex-row')],
        [previewView(model, h), sidebarView(model, h)],
      ),
    ],
  ),
})
