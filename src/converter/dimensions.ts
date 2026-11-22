import {
  type FabricSuggestion,
  type FinishedDimensions,
  type StitchDimensions,
  type TargetSide,
} from './model'

export const fitDimensions = (
  source: Readonly<{ width: number; height: number }>,
  targetSide: TargetSide,
  targetStitches: number,
): StitchDimensions => {
  if (targetSide === 'width') {
    return {
      width: Math.max(1, targetStitches),
      height: Math.max(
        1,
        Math.round((source.height * targetStitches) / source.width),
      ),
    }
  }
  return {
    width: Math.max(
      1,
      Math.round((source.width * targetStitches) / source.height),
    ),
    height: Math.max(1, targetStitches),
  }
}

export const computeFinishedDimensions = (
  dimensions: StitchDimensions,
  fabricCount: number,
): FinishedDimensions => {
  const widthIn = dimensions.width / fabricCount
  const heightIn = dimensions.height / fabricCount
  return {
    widthIn,
    heightIn,
    widthCm: widthIn * 2.54,
    heightCm: heightIn * 2.54,
  }
}

export const suggestFabric = (
  dimensions: StitchDimensions,
  fabricCount: number,
  marginCm: number,
): FabricSuggestion => {
  const finished = computeFinishedDimensions(dimensions, fabricCount)
  return {
    count: fabricCount,
    cutWidthCm: finished.widthCm + 2 * marginCm,
    cutHeightCm: finished.heightCm + 2 * marginCm,
  }
}

const METERS_PER_STITCH_PER_STRAND = 0.0025

export const estimateSkeins = (
  stitchCount: number,
  strands: number,
  skeinLengthM: number,
): number => {
  const metresNeeded = stitchCount * strands * METERS_PER_STITCH_PER_STRAND
  return Math.max(1, Math.ceil(metresNeeded / skeinLengthM))
}
