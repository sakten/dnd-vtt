import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  title?: ReactNode;
  className?: string;
  backdropClassName?: string;
  children: ReactNode;
}

const stack: symbol[] = [];

/** Общая модалка: портал в body, закрытие по фону и Escape (только верхняя в стеке). */
export default function Modal({ onClose, title, className, backdropClassName, children }: Props) {
  const idRef = useRef<symbol>(Symbol('modal'));
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = idRef.current;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const index = stack.lastIndexOf(id);
      if (index !== -1) stack.splice(index, 1);
    };
  }, []);

  return createPortal(
    <div
      className={`modal-backdrop${backdropClassName ? ` ${backdropClassName}` : ''}`}
      onMouseDown={() => closeRef.current()}
    >
      <div
        className={`modal${className ? ` ${className}` : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && <h3>{title}</h3>}
        {children}
      </div>
    </div>,
    document.body
  );
}
