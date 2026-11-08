// Injected on demand by the popup (chrome.scripting) - never runs on pages until the user opens ApplyPilot.
import type { Profile, ScanResult } from '../shared/types';
import { clearHighlights, detectFields, fillFields, getPageInfo, setHighlight, uploadResume } from '../services/FieldDetectionService';
import { resolveValue } from '../services/AutofillService';

const api = {
  scan(profile: Profile, coverLetter: string): ScanResult {
    const raw = detectFields();
    const fileInputs = document.querySelectorAll('input[type="file"]').length;
    return {
      fileInputs,
      fields: raw.map((f) => ({
        id: f.id,
        type: f.type,
        confidence: f.confidence,
        label: f.label,
        tag: f.tag,
        inputType: f.inputType,
        currentValue: f.currentValue,
        proposedValue: f.type ? resolveValue(f.type, profile, coverLetter) : null,
      })),
    };
  },
  fill: fillFields,
  highlight(ids: string[], kind: 'unmatched' | 'filled' | null) {
    ids.forEach((id) => setHighlight(id, kind));
  },
  clear: clearHighlights,
  upload: uploadResume,
  pageInfo: getPageInfo,
};

(window as unknown as { __applypilot: typeof api }).__applypilot = api;
