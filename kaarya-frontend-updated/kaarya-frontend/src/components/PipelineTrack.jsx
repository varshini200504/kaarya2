import { Ban, UserCheck, AlertTriangle, ShieldCheck } from 'lucide-react';
import StageTrack from './StageTrack';

/**
 * The architecture, drawn:
 *   Understand → Decide → Policy → Act → Verify
 * with the tail replaced by the human-approval or blocked path.
 *
 * `progress` is how many of the first three stages have completed (0-3).
 * `verified` is null (not applicable), 'checking' or 'ok' — never 'ok' for an
 * action that never happened.
 */
export default function PipelineTrack({
  progress = 0,
  running = false,
  outcome = null,
  resolution = null,
  verified = null,
}) {
  const base = ['Understand', 'Decide', 'Policy'].map((label, i) => ({
    label,
    state: progress > i ? 'done' : running && progress === i ? 'active' : 'idle',
  }));

  const verifyNode = {
    label: 'Verify',
    icon: ShieldCheck,
    state:
      verified === 'ok' ? 'done' : verified === 'checking' ? 'active' : 'idle',
  };

  let tail = [];
  if (outcome === 'AUTO') {
    tail = [{ label: 'Act · refund issued', state: 'done' }, verifyNode];
  } else if (outcome === 'HUMAN') {
    tail = [
      {
        label: 'Human approval',
        state: resolution ? 'done' : 'wait',
        icon: UserCheck,
      },
      {
        label:
          resolution === 'approved'
            ? 'Act · refund issued'
            : resolution === 'escalated'
              ? 'Refund blocked'
              : 'Act',
        state:
          resolution === 'approved'
            ? 'done'
            : resolution === 'escalated'
              ? 'blocked'
              : 'idle',
      },
    ];
    // Verification only belongs on a path where money actually moved.
    if (resolution !== 'escalated') tail.push(verifyNode);
  } else if (outcome === 'BLOCKED') {
    tail = [
      {
        label: resolution === 'escalated' ? 'Escalated' : 'Risk review',
        state: 'risk',
        icon: AlertTriangle,
      },
      { label: 'Refund blocked', state: 'blocked', icon: Ban },
    ];
  } else {
    tail = [{ label: 'Act', state: 'idle' }, verifyNode];
  }

  return <StageTrack steps={base.concat(tail)} />;
}
