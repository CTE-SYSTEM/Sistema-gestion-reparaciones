import { useEffect, useRef } from 'react';
import { handleFormNavigationKeyDown } from './formKeyboardNavigation';
import { attachKeyboardWorkflow } from './keyboardWorkflow';

export default function KeyboardWorkspace({ enabled, className, children, showHelp = true }) {
  const ref = useRef(null);
  const implicit = useRef(false);
  useEffect(() => enabled ? attachKeyboardWorkflow(ref.current) : undefined, [enabled]);
  return <div ref={ref} data-keyboard-workspace={enabled ? 'true' : undefined}
    onKeyDownCapture={(event) => { implicit.current = event.key === 'Enter' && event.target.matches?.('input,select,textarea'); }}
    onClickCapture={(event) => { if (event.detail > 0 || !event.target.ownerDocument.activeElement?.matches('input,select,textarea')) implicit.current = false; }}
    onSubmitCapture={(event) => {
      if (enabled && implicit.current && event.target.ownerDocument.activeElement?.matches('input,select,textarea')) {
        event.preventDefault(); event.stopPropagation(); implicit.current = false;
      }
    }}
    onKeyDown={handleFormNavigationKeyDown} className={className}>
    {enabled && showHelp && <p className="keyboard-help">Teclado: Tab / Shift+Tab recorre · Enter avanza en texto y números · Alt+↓/↑ salta campos · Alt+Fin va a Guardar · Enter o Espacio activa botones.</p>}
    {children}
  </div>;
}
