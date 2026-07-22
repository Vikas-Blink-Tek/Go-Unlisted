import { useEffect, useId, useRef } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

function run(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export default function SimpleRichTextEditor({ value, onChange, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastExternal = useRef(value);
  const labelId = useId();

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastExternal.current) {
      el.innerHTML = value || '';
      lastExternal.current = value;
    }
  }, [value]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastExternal.current = html;
    onChange(html);
  };

  const focusEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // Ensure caret exists so list / heading commands apply
    const sel = window.getSelection();
    if (sel && sel.rangeCount === 0) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.addRange(range);
    }
  };

  const wrap = (cmd: string, arg?: string) => {
    focusEditor();
    run(cmd, arg);
    emit();
  };

  const setBlock = (tag: 'h1' | 'h2' | 'h3' | 'p') => {
    focusEditor();
    // Browsers differ: some want <h2>, some want h2
    const ok = document.execCommand('formatBlock', false, `<${tag}>`);
    if (!ok) document.execCommand('formatBlock', false, tag);
    emit();
  };

  const addLink = () => {
    const url = window.prompt('Paste link URL (https://...)');
    if (!url) return;
    focusEditor();
    document.execCommand('createLink', false, url.trim());
    emit();
  };

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Text formatting">
        <button type="button" className="rte-btn" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" className="rte-btn" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('italic')}>
          <em>I</em>
        </button>
        <button type="button" className="rte-btn" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('underline')}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </button>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" title="Heading" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('h1')}>
          Heading
        </button>
        <button type="button" className="rte-btn" title="Subheading" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('h2')}>
          Subheading
        </button>
        <button type="button" className="rte-btn" title="Normal paragraph" onMouseDown={(e) => e.preventDefault()} onClick={() => setBlock('p')}>
          Text
        </button>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" title="Bullet list" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('insertUnorderedList')}>
          • List
        </button>
        <button type="button" className="rte-btn" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('insertOrderedList')}>
          1. List
        </button>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" title="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('justifyLeft')}>
          ⬅
        </button>
        <button type="button" className="rte-btn" title="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('justifyCenter')}>
          ↔
        </button>
        <button type="button" className="rte-btn" title="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('justifyRight')}>
          ➡
        </button>
        <button type="button" className="rte-btn" title="Justify" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('justifyFull')}>
          ≡
        </button>
        <span className="rte-sep" />
        <button type="button" className="rte-btn" title="Add link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}>
          Link
        </button>
      </div>
      <div
        id={labelId}
        ref={editorRef}
        className="rte-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || 'Write your article…'}
        onInput={emit}
        onBlur={emit}
        suppressContentEditableWarning
      />
      <p className="rte-hint">Select text, then use the toolbar — headings, bullets, and alignment work like Word. No HTML needed.</p>
    </div>
  );
}
