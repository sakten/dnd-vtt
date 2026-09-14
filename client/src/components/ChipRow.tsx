import { Fragment, type ReactNode } from 'react';

export interface ChipItem {
  key: string;
  title: string;
  node: ReactNode;
}

interface Props {
  items: ChipItem[];
  className: string;
  moreClass: string;
  /** Максимум чипов; null — показать все. */
  max?: number | null;
}

/** Контейнер чипов с обрезкой по max и «+N» в конце. */
export default function ChipRow({ items, className, moreClass, max = null }: Props) {
  if (!items.length) return null;
  const shown = max === null ? items : items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <div className={className}>
      {shown.map((item) => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
      {extra > 0 && (
        <span className={moreClass} title={items.slice(shown.length).map((i) => i.title).join(', ')}>
          +{extra}
        </span>
      )}
    </div>
  );
}
