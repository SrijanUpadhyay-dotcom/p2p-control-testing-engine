// Drafts audit observations from confirmed exceptions.
// The engine fills what the data and the RCM can support; cause and the
// management action plan always come from the reviewer.
import { CONTROLS, RISKS } from './rcm.js';

export function draftObservation(ex, n) {
  const c = CONTROLS[ex.control] || {};
  const rating = ex.severity === 'High' ? 'High' : ex.severity === 'Medium' ? 'Medium' : 'Low';
  const cause = [ex.rootCause, ex.note].filter(Boolean).join('. ');
  return {
    ref: `O${n}`,
    exceptionId: ex.id,
    control: ex.control,
    title: ex.title,
    rating,
    sections: [
      { label: 'Condition', source: 'data', text: ex.condition },
      { label: 'Criteria', source: 'rcm', text: c.criteria || '' },
      { label: 'Cause', source: 'auditor', text: cause || '[To be confirmed with management. The engine can see what happened, not why.]', missing: !cause },
      { label: 'Effect / risk', source: 'rcm', text: `${RISKS[ex.risk]?.id}: ${c.effect || RISKS[ex.risk]?.text || ''}` },
      { label: 'Recommendation', source: 'rcm', text: c.recommendation || '' },
      { label: 'Management action plan', source: 'auditor', text: ex.actionPlan || '[Owner, action and target date agreed with management]', missing: !ex.actionPlan }
    ]
  };
}

export function observationsFor(run, { includeAll = false } = {}) {
  const list = run.exceptions.filter((e) => (includeAll ? e.status !== 'False positive' : e.status === 'Confirmed' || e.status === 'Remediated'));
  return list.sort((a, b) => b.score - a.score).map((e, i) => draftObservation(e, i + 1));
}
