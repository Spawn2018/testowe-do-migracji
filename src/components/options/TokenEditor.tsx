/**
 * wyglad/P8-a — pole treści z klockami danych (E43 „Bez znaczników”: tekst wpisuje się normalnie, dane wstawia przyciskiem;
 * klocka nie da się popsuć, Backspace usuwa cały klocek; przycisku z linkiem w e-mailu logowania nie da się usunąć).
 * Pole jest niekontrolowane: treść startowa z `initial`, każda zmiana wraca jako fragmenty (`onChange`).
 * Wklejanie — tylko zwykły tekst. Bez formatowania i bez cofania przeglądarki (pole zmienia też kod). Nowy początek — `key` u rodzica.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { tokenLabelIn, type Seg, type TokenId } from '../../lib/p8Texts';
import { readSegs } from '../../lib/p8Dom';

export interface TokenEditorHandle {
  /** wstaw klocek w miejscu kursora (albo na końcu, gdy kursora w polu nie było) */
  insert: (id: TokenId) => void;
  focus: () => void;
}

interface Props {
  initial: readonly Seg[];
  onChange: (segs: Seg[]) => void;
  multiline: boolean;
  readOnly: boolean;
  label: string;
  /** napis klocka przycisku w e-mailu logowania */
  buttonLabel?: string;
  /** A4 (wyglad/W-faktura-termin): id wiadomości — w wiadomościach o fakturze klocek linku to „Link do faktury” */
  msgId?: string;
  /** przycisk z linkiem nie do usunięcia (e-mail logowania, E43) */
  lockButton?: boolean;
  describedBy?: string;
  invalid?: boolean;
  onFocus?: () => void;
}

function chipLabel(id: TokenId, buttonLabel?: string, msgId?: string): string {
  return id === 'button' ? `Przycisk „${buttonLabel ?? 'Dołącz'}”` : tokenLabelIn(id, msgId);
}

function chip(id: TokenId, buttonLabel?: string, msgId?: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.contentEditable = 'false';
  s.className = id === 'button' ? 'mt-chip mt-chip-btn' : 'mt-chip';
  s.dataset.tok = id;
  s.textContent = chipLabel(id, buttonLabel, msgId);
  return s;
}

function fill(el: HTMLElement, segs: readonly Seg[], buttonLabel?: string, msgId?: string): void {
  el.textContent = '';
  for (const x of segs) {
    if (x.k === 'txt') el.appendChild(document.createTextNode(x.v));
    else el.appendChild(chip(x.id, buttonLabel, msgId));
  }
  /* za ostatnim klockiem musi być tekst — inaczej klik w puste pole stawia kursor w środku klocka */
  if (segs[segs.length - 1]?.k === 'tok') el.appendChild(document.createTextNode(' '));
}

/** klocek, w którym jest węzeł (albo null) */
function chipOf(n: Node | null, box: HTMLElement): HTMLElement | null {
  const e = n instanceof HTMLElement ? n : n?.parentElement ?? null;
  const c = e?.closest<HTMLElement>('[data-tok]') ?? null;
  return c && box.contains(c) ? c : null;
}

export const TokenEditor = forwardRef<TokenEditorHandle, Props>(function TokenEditor(
  { initial, onChange, multiline, readOnly, label, buttonLabel, msgId, lockButton, describedBy, invalid, onFocus }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const range = useRef<Range | null>(null);

  useEffect(() => {
    if (el.current) fill(el.current, initial, buttonLabel, msgId);
    // treść startowa tylko przy montażu; nowy początek — nowy `key`
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (r: Range) => {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
    range.current = r.cloneRange();
  };

  /** Kursor nigdy w środku klocka: przenosi go za klocek (klik w puste miejsce za ostatnim klockiem, strzałki). */
  const fixCaret = () => {
    const box = el.current;
    const sel = window.getSelection();
    if (!box || !sel || !sel.rangeCount || !box.contains(sel.anchorNode)) return;
    const r = sel.getRangeAt(0);
    const a = chipOf(r.startContainer, box);
    const b = chipOf(r.endContainer, box);
    if (!a && !b) { range.current = r.cloneRange(); return; }
    const out = document.createRange();
    if (r.collapsed || a === b) {
      out.setStartAfter((a ?? b)!);
      out.collapse(true);
    } else {
      if (a) out.setStartBefore(a); else out.setStart(r.startContainer, r.startOffset);
      if (b) out.setEndAfter(b); else out.setEnd(r.endContainer, r.endOffset);
    }
    place(out);
  };

  const remember = () => fixCaret();
  const emit = () => { if (el.current) onChange(readSegs(el.current)); };

  /** bieżące miejsce kursora w polu (poza klockiem); bez kursora — koniec pola */
  const currentRange = (): Range | null => {
    const box = el.current;
    if (!box) return null;
    fixCaret();
    const sel0 = window.getSelection();
    let r = sel0 && sel0.rangeCount && box.contains(sel0.anchorNode) ? sel0.getRangeAt(0) : range.current;
    if (!r || !box.contains(r.startContainer) || chipOf(r.startContainer, box)) {
      r = document.createRange();
      r.selectNodeContents(box);
      r.collapse(false);
    }
    return r;
  };

  /** czy zakres obejmuje przycisk z linkiem, którego nie wolno usunąć */
  const hitsButton = (r: Range): boolean => {
    const box = el.current;
    if (!box || !lockButton) return false;
    return [...box.querySelectorAll('[data-tok="button"]')].some((c) => r.intersectsNode(c) && !(r.collapsed));
  };

  const insertNode = (node: Node) => {
    const r = currentRange();
    if (!r) return;
    if (hitsButton(r)) r.collapse(false);
    r.deleteContents();
    r.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    place(after);
    emit();
  };

  /**
   * Zwykły tekst (Enter, wklejanie) wpisany w węzeł tekstu z kursorem za nim — przeglądarka pisze dalej we właściwym
   * miejscu. Nowa linia na samym końcu pola dostaje znak „\n” na zapas, żeby kursor był widoczny w nowej linii;
   * `readSegs` pomija odstępy na końcu.
   */
  const insertText = (str: string) => {
    const box = el.current;
    const r = currentRange();
    if (!box || !r) return;
    if (hitsButton(r)) r.collapse(false);
    r.deleteContents();
    let node: Text;
    let off: number;
    if (r.startContainer.nodeType === Node.TEXT_NODE) {
      node = r.startContainer as Text;
      off = r.startOffset;
      node.insertData(off, str);
    } else {
      node = document.createTextNode(str);
      off = 0;
      r.insertNode(node);
    }
    off += str.length;
    const tail = document.createRange();
    tail.setStart(node, off);
    tail.setEnd(box, box.childNodes.length);
    if (str.endsWith('\n') && tail.toString() === '' && !tail.cloneContents().querySelector('[data-tok]')) node.appendData('\n');
    const at = document.createRange();
    at.setStart(node, off);
    at.collapse(true);
    place(at);
    emit();
  };

  /** znak tuż przed kursorem — żeby klocek nie skleił się z poprzednim słowem */
  const charBefore = (): string => {
    const box = el.current;
    const r = currentRange();
    if (!box || !r) return '';
    const head = document.createRange();
    head.setStart(box, 0);
    head.setEnd(r.startContainer, r.startOffset);
    const frag = head.cloneContents();
    const last = frag.lastChild;
    if (last instanceof HTMLElement && last.dataset.tok) return 'x';
    return (frag.textContent ?? '').slice(-1);
  };

  /** znak tuż za kursorem — przed odstępem i znakiem przestankowym klocek nie dostaje odstępu */
  const charAfter = (): string => {
    const box = el.current;
    const r = currentRange();
    if (!box || !r) return '';
    const tail = document.createRange();
    tail.setStart(r.endContainer, r.endOffset);
    tail.setEnd(box, box.childNodes.length);
    const frag = tail.cloneContents();
    const first = frag.firstChild;
    if (first instanceof HTMLElement && first.dataset.tok) return 'x';
    return (frag.textContent ?? '').charAt(0);
  };

  /* zdarzenia, których React nie obsługuje wprost: Enter z klawiatury ekranowej (insertParagraph), formatowanie,
     cofanie przeglądarki i usuwanie przycisku z linkiem (Backspace, Delete, wycinanie) */
  useEffect(() => {
    const box = el.current;
    if (!box || readOnly) return;
    const onBefore = (e: InputEvent) => {
      const t = e.inputType;
      if (t === 'insertParagraph' || t === 'insertLineBreak') {
        e.preventDefault();
        if (multiline) insertText('\n');
        return;
      }
      if (t.startsWith('format') || t === 'historyUndo' || t === 'historyRedo' || t === 'insertFromDrop') { e.preventDefault(); return; }
      if (lockButton && (t.startsWith('delete') || t === 'insertText' || t === 'insertReplacementText')) {
        const ranges = e.getTargetRanges();
        const hit = ranges.some((sr) => {
          const r = document.createRange();
          r.setStart(sr.startContainer, sr.startOffset);
          r.setEnd(sr.endContainer, sr.endOffset);
          return hitsButton(r);
        });
        if (hit) e.preventDefault();
      }
    };
    const onSel = () => { if (document.activeElement === box) fixCaret(); };
    box.addEventListener('beforeinput', onBefore);
    document.addEventListener('selectionchange', onSel);
    return () => {
      box.removeEventListener('beforeinput', onBefore);
      document.removeEventListener('selectionchange', onSel);
    };
  }, [readOnly, multiline, lockButton]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    insert: (id) => {
      if (readOnly) return;
      const before = charBefore();
      const after = charAfter();
      if (before && !/\s/.test(before) && !/[([„"]/.test(before)) insertNode(document.createTextNode(' '));
      insertNode(chip(id, buttonLabel, msgId));
      /* odstęp po klocku, żeby kursor nie kleił się do niego — chyba że dalej jest odstęp albo znak przestankowy */
      if (!/^[\s.,:;!?)\]”]$/.test(after)) insertNode(document.createTextNode(' '));
      el.current?.focus();
    },
    focus: () => el.current?.focus(),
  }), [readOnly, buttonLabel, msgId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={el}
      className={`mt-ed${multiline ? ' is-multi' : ''}${readOnly ? ' is-ro' : ''}`}
      role="textbox"
      aria-label={label}
      aria-multiline={multiline || undefined}
      aria-readonly={readOnly || undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      tabIndex={0}
      spellCheck={!readOnly}
      onInput={emit}
      onKeyUp={remember}
      onMouseUp={remember}
      onFocus={() => { onFocus?.(); remember(); }}
      onBlur={remember}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (multiline) insertText('\n');
      }}
      onPaste={(e) => {
        e.preventDefault();
        const txt = e.clipboardData.getData('text/plain');
        if (txt) insertText(multiline ? txt.replace(/\r\n?/g, '\n') : txt.replace(/\s*\r?\n\s*/g, ' '));
      }}
      onDrop={(e) => e.preventDefault()}
    />
  );
});
