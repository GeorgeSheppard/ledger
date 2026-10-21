import { useId, useState } from 'react';
import { Select } from '../../../ui/Select';
import type { Graph } from '../types';
import { NoData } from '../shared/NoData';
import { METRIC_LABELS, STAT_METRICS, statMetric } from './metrics';
import { StatDetail } from './StatDetail';
import { StatTile } from './StatTile';

export const statGraph: Graph = {
  kind: 'stat',
  label: 'Single number',
  defaultWidth: 1,
  defaults: { metric: 'netWorth' },
  title: (widget) => METRIC_LABELS[statMetric(widget.metric)],
  Options({ widget, onChange }) {
    const id = useId();
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          Number
        </label>
        <Select
          id={id}
          value={statMetric(widget.metric)}
          onChange={(e) => onChange({ metric: e.target.value })}
        >
          {STAT_METRICS.map((metric) => (
            <option key={metric} value={metric}>
              {METRIC_LABELS[metric]}
            </option>
          ))}
        </Select>
      </div>
    );
  },
  View(props) {
    const [open, setOpen] = useState(false);
    const { widget, dashboard } = props;
    if (!dashboard) return <NoData>No transactions in these accounts yet.</NoData>;
    const metric = statMetric(widget.metric);
    return (
      <>
        <StatTile dashboard={dashboard} metric={metric} onOpen={() => setOpen(true)} />
        {open && <StatDetail metric={metric} props={props} onClose={() => setOpen(false)} />}
      </>
    );
  },
};
