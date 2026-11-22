import { Layer } from 'effect'
import { Runtime } from 'foldkit'

import { BrowserCrypto } from '@effect/platform-browser'

import { layerOklabColourMatcher } from './domain/Colour'
import { Message, Model, init, update, view } from './main'
import { TransformationRegistry } from './plugins/registry'
import { ImageLoader } from './services/ImageLoader'
import { PdfService } from './services/PdfService'
import { Pipeline } from './services/Pipeline'
import { PixelStore } from './services/PixelStore'

const pixelStoreLayer = PixelStore.layer
const registryLayer = TransformationRegistry.layerBuiltIn

const resources = Layer.mergeAll(
  pixelStoreLayer,
  registryLayer,
  PdfService.layer,
  layerOklabColourMatcher,
  BrowserCrypto.layerSecureRandom,
  ImageLoader.layer.pipe(Layer.provide(pixelStoreLayer)),
  Pipeline.layer.pipe(
    Layer.provide(Layer.mergeAll(pixelStoreLayer, registryLayer)),
  ),
)

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  resources,
  container: document.getElementById('root'),
  // oxlint-disable-next-line foldkit/no-disabling-dev-guardrails -- the Model holds megabyte-scale preview grids; deep-freezing them after every update dominates interaction latency in development.
  freezeModel: false,
  devTools: {
    Message,
  },
})

Runtime.run(application)
