export type StatusTone = 'default' | 'success' | 'error';

export const statusClassName = (tone: StatusTone) => {
  if (tone === 'success') {
    return 'text-sm text-emerald-300';
  }
  if (tone === 'error') {
    return 'text-sm text-rose-300';
  }
  return 'text-sm text-slate-400';
};
