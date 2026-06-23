import { Chip } from '@mui/material';
import { STATUS_COLORS } from '../../utils/format';

export default function StatusChip({ status, label }) {
  return <Chip size="small" color={STATUS_COLORS[status] || 'default'} label={label || status} />;
}
